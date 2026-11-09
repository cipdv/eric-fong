"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { adjustPrintStock } from "@/lib/locationStock";
import { markOrderFulfilled } from "@/lib/fulfillOrder";
import { verifyFulfillmentToken } from "@/lib/orderFulfillmentToken";

async function getUserFromSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  if (!token) return null;

  const { rows } = await sql`
    SELECT users.id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;

  return rows[0]?.id as string | undefined;
}

export async function fulfillOrder(orderId: string) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");
  return markOrderFulfilled(orderId);
}

export async function fulfillOrderFromEmail(token: string) {
  const orderId = verifyFulfillmentToken(token, process.env.ORDER_ACTION_SECRET || "");
  if (!orderId) throw new Error("This fulfillment link is invalid or expired. Use the latest reminder email or the orders dashboard.");
  return markOrderFulfilled(orderId);
}
export async function deleteOrder(orderId: string) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  try {
    await sql`BEGIN`;

    const { rows: items } = await sql`
      SELECT print_id, quantity
      FROM order_items
      WHERE order_id = ${orderId}
      FOR UPDATE;
    `;

    for (const item of items) {
      if (!item?.print_id || item.quantity === null) continue;
      await adjustPrintStock({
        printId: item.print_id,
        delta: item.quantity,
        reason: "order_deleted",
        orderId,
      });
    }

    await sql`DELETE FROM order_items WHERE order_id = ${orderId};`;
    await sql`DELETE FROM orders WHERE id = ${orderId};`;
    await sql`COMMIT`;
  } catch (error) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    throw error;
  }

  revalidatePath("/app/dashboard/finances");
  revalidatePath("/app/dashboard/orders");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
