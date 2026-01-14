import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const items: { printId: string; quantity: number }[] = Array.isArray(payload?.items)
      ? payload.items
      : [];
    if (!items.length) {
      return NextResponse.json({ error: "No items to checkout." }, { status: 400 });
    }

    const customer = payload?.customer || {};
    const { rows: prints } = await sql<{
      id: string;
      price: string;
      title: string | null;
      size: string | null;
    }>`
      SELECT prints.id, prints.price, prints.size, paintings.title
      FROM prints
      LEFT JOIN paintings ON paintings.id = prints.painting_id
      WHERE prints.id = ANY(${items.map((i) => i.printId)});
    `;

    const lineItems = items.map((item) => {
      const pr = prints.find((p) => p.id === item.printId);
      if (!pr) throw new Error("One or more items are invalid.");
      const unitAmount = Math.round(Number(pr.price) * 100);
      return {
        price_data: {
          currency: "cad",
          product_data: {
            name: `${pr.title || "Print"} - ${pr.size || ""}`.trim(),
            metadata: { printId: pr.id },
          },
          unit_amount: unitAmount,
        },
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
      };
    });

    const baseEnv =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL;
    const baseUrl = baseEnv
      ? baseEnv.startsWith("http://") || baseEnv.startsWith("https://")
        ? baseEnv
        : `https://${baseEnv}`
      : "http://localhost:3000";

    const allowedCountries = customer.country ? [customer.country.toUpperCase()] : ["CA", "US"];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${baseUrl}/order/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cart`,
      customer_email: customer.email || undefined,
      shipping_address_collection: {
        allowed_countries:
          allowedCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
      },
      phone_number_collection: { enabled: true },
      metadata: {
        items: JSON.stringify(
          items.map((i) => {
            const pr = prints.find((p) => p.id === i.printId);
            return {
              printId: i.printId,
              quantity: i.quantity,
              unitPrice: pr ? Number(pr.price) : undefined,
            };
          })
        ),
        customerName: customer.name || "",
        customerEmail: customer.email || "",
        customerPhone: customer.phone || "",
        customerAddress1: customer.address1 || "",
        customerAddress2: customer.address2 || "",
        customerCity: customer.city || "",
        customerProvince: customer.province || "",
        customerPostal: customer.postal || "",
        customerCountry: customer.country || "",
      },
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("[api/checkout/session] error", err);
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }
}
