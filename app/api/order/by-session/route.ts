import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { recordOrderFromSessionId } from "@/lib/orderRecorder";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  try {
    // Try to ensure the order exists (hydrate from Stripe if needed)
    if (process.env.STRIPE_SECRET_KEY) {
      await recordOrderFromSessionId(sessionId);
    }
  } catch (err) {
    // ignore; we'll still try to read from DB
    console.error("[api/order/by-session] record attempt failed", err);
  }

  const { rows } = await sql`
    SELECT
      id,
      status,
      gross_amount,
      hst_collected,
      total_amount
    FROM orders
    WHERE stripe_checkout_session_id = ${sessionId}
    LIMIT 1;
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const row = rows[0];
  return NextResponse.json({
    id: row.id,
    status: row.status,
    grossAmount: Number(row.gross_amount ?? 0),
    hstCollected: Number(row.hst_collected ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
  });
}
