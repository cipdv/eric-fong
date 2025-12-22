import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe =
  stripeSecret &&
  new Stripe(stripeSecret, {
    apiVersion: "2024-06-20",
  });

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const printId = body?.printId?.toString();
    const quantity = Math.max(1, Number(body?.quantity ?? 1));
    const customer = body?.customer ?? {};

    if (!printId) {
      return NextResponse.json({ error: "Missing printId." }, { status: 400 });
    }

    const printResult = await sql`
      SELECT id, price, quantity, size
      FROM prints
      WHERE id = ${printId}
      LIMIT 1;
    `;

    if (!printResult.rowCount) {
      return NextResponse.json({ error: "Print not found." }, { status: 404 });
    }

    const print = printResult.rows[0];
    const available = Number(print.quantity ?? 0);
    if (available < quantity) {
      return NextResponse.json(
        { error: "Not enough quantity available." },
        { status: 400 }
      );
    }

    const unitPrice = Number(print.price);
    const amount = Math.round(unitPrice * quantity * 100);

    // Create pending order and line
    const orderInsert = await sql`
      INSERT INTO orders (user_id, status, total_amount, currency)
      VALUES (NULL, 'pending', ${unitPrice * quantity}, 'cad')
      RETURNING id;
    `;
    const orderId = orderInsert.rows[0].id;

    await sql`
      INSERT INTO order_items (order_id, print_id, quantity, unit_price)
      VALUES (${orderId}, ${printId}, ${quantity}, ${unitPrice});
    `;

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "cad",
      payment_method_types: ["card"], // limit to card only (no Klarna/Affirm)
      metadata: {
        orderId,
        printId,
        quantity,
      },
      shipping: customer?.name
        ? {
            name: customer.name,
            address: {
              line1: customer.address1 ?? "",
              line2: customer.address2 ?? "",
              city: customer.city ?? "",
              state: customer.province ?? "",
              postal_code: customer.postal ?? "",
              country: customer.country ?? "",
            },
          }
        : undefined,
      receipt_email: customer?.email,
    });

    await sql`
      UPDATE orders
      SET stripe_payment_intent_id = ${intent.id}
      WHERE id = ${orderId};
    `;

    return NextResponse.json({
      clientSecret: intent.client_secret,
      orderId,
    });
  } catch (error) {
    console.error("checkout-intent error", error);
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 });
  }
}
