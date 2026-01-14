import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { recordOrderFromSessionId } from "@/lib/orderRecorder";

export const runtime = "nodejs";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session | any) {
  if (!session?.id) {
    console.error("[webhook] missing session id in event payload");
    return;
  }

  console.log("[webhook] checkout.session.completed received", {
    sessionId: session.id,
    paymentIntent: session.payment_intent,
  });

  const result = await recordOrderFromSessionId(session.id as string);
  if (!result.ok) {
    console.error("[webhook] failed to record order", {
      sessionId: session.id,
      error: result.error,
    });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent?.id;
  if (!paymentIntentId) {
    console.error("[webhook] payment_intent.succeeded missing id");
    return;
  }

  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    const session = sessions.data[0];
    if (!session) {
      console.error("[webhook] no checkout session found for payment intent", paymentIntentId);
      return;
    }
    await handleCheckoutCompleted(session);
  } catch (err) {
    console.error("[webhook] failed to map payment intent to session", paymentIntentId, err);
  }
}

export async function POST(req: Request) {
  console.log("[webhook] HIT", new Date().toISOString());

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const body = await req.text();
  console.log("[webhook] raw length", body.length);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    console.log("[webhook] event", event.type, "session:", (event.data?.object as any)?.id);
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  } else if (event.type === "payment_intent.succeeded") {
    console.log("[webhook] event", event.type, "pi:", (event.data?.object as any)?.id);
    await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
  } else {
    console.log("[webhook] ignored event", event.type);
  }

  return NextResponse.json({ ok: true });
}
