import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";

// Call only after session authentication or verification of an order-specific token.
export async function markOrderFulfilled(orderId: string) {
  // Inventory is reserved when the paid order is recorded, not at fulfillment.
  const updated = await sql`
    UPDATE orders SET status = 'fulfilled', updated_at = NOW()
    WHERE id = ${orderId} AND status = 'paid'
    RETURNING id;
  `;
  if (!updated.rowCount) {
    const { rows } = await sql<{ status: string }>`SELECT status FROM orders WHERE id = ${orderId};`;
    if (!rows[0]) throw new Error("Order not found.");
    if (rows[0].status !== "fulfilled") throw new Error("This order is not awaiting fulfillment.");
  }
  for (const path of ["/app/dashboard/finances", "/app/dashboard/orders", "/app/dashboard", "/orders/fulfill"]) {
    revalidatePath(path);
  }
  return { ok: true, alreadyFulfilled: !updated.rowCount };
}
