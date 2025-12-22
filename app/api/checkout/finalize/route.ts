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
    const paymentIntentId = body?.paymentIntentId?.toString();
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Missing paymentIntentId" },
        { status: 400 }
      );
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not completed." },
        { status: 400 }
      );
    }

    const orderId = intent.metadata?.orderId;
    const printId = intent.metadata?.printId;
    const quantity = Number(intent.metadata?.quantity ?? 0);

    if (!orderId || !printId || !quantity || Number.isNaN(quantity)) {
      return NextResponse.json(
        { error: "Missing order metadata." },
        { status: 400 }
      );
    }

    try {
      await sql`BEGIN`;

      const updatePrint = await sql`
        UPDATE prints
        SET quantity = quantity - ${quantity}
        WHERE id = ${printId} AND quantity >= ${quantity}
        RETURNING id;
      `;

      if (!updatePrint.rowCount) {
        await sql`ROLLBACK`;
        return NextResponse.json(
          { error: "Insufficient inventory." },
          { status: 400 }
        );
      }

      await sql`
        UPDATE orders
        SET status = 'paid',
            stripe_payment_intent_id = ${intent.id},
            updated_at = NOW()
        WHERE id = ${orderId};
      `;

      await sql`
        INSERT INTO print_inventory_events (print_id, delta, reason, order_id)
        VALUES (${printId}, ${-quantity}, 'sale', ${orderId});
      `;

      await sql`COMMIT`;
    } catch (err) {
      try {
        await sql`ROLLBACK`;
      } catch {}
      throw err;
    }

    return NextResponse.json({ ok: true, orderId });
  } catch (error) {
    console.error("finalize error", error);
    return NextResponse.json({ error: "Finalize failed." }, { status: 500 });
  }
}
