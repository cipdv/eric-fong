import { createHmac, timingSafeEqual } from "node:crypto";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createFulfillmentToken(orderId: string, secret: string, now = Date.now()) {
  if (!uuid.test(orderId) || secret.length < 32) throw new Error("Invalid fulfillment link configuration.");
  const payload = Buffer.from(JSON.stringify({ orderId, purpose: "fulfill-order", expires: now + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyFulfillmentToken(token: string, secret: string, now = Date.now()): string | null {
  if (!secret || secret.length < 32 || token.length > 1024) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.purpose !== "fulfill-order" || typeof data.orderId !== "string" || !uuid.test(data.orderId)
      || !Number.isSafeInteger(data.expires) || data.expires <= now) return null;
    return data.orderId;
  } catch {
    return null;
  }
}
