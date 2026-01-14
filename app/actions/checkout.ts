"use server";

type CheckoutItem = { printId: string; quantity: number };

type CheckoutPayload = {
  items: CheckoutItem[];
  customer?: Record<string, unknown>;
};

function getBaseUrl() {
  const baseEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (!baseEnv) return "http://localhost:3000";
  if (baseEnv.startsWith("http://") || baseEnv.startsWith("https://")) {
    return baseEnv;
  }
  return `https://${baseEnv}`;
}

export async function createCheckoutSessionAction(payload: CheckoutPayload) {
  const res = await fetch(`${getBaseUrl()}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not create checkout session.");
  }
  return data;
}
