import type { Metadata } from "next";
import { sql } from "@vercel/postgres";
import { verifyFulfillmentToken } from "@/lib/orderFulfillmentToken";
import OrderFulfillmentConfirmation from "@/app/components/OrderFulfillmentConfirmation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirm order fulfillment",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function FulfillOrderPage({ searchParams }: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const orderId = verifyFulfillmentToken(token, process.env.ORDER_ACTION_SECRET || "");
  if (!orderId) {
    return <p>This fulfillment link is invalid or expired. Open the latest reminder email or visit the orders dashboard.</p>;
  }
  const { rows } = await sql<{ status: string; customer_name: string | null; created_at: string }>`
    SELECT status, NULLIF(CONCAT_WS(' ', customer_first_name, customer_last_name), '') AS customer_name,
      created_at::text
    FROM orders WHERE id = ${orderId};
  `;
  const order = rows[0];
  if (!order) return <p>This order no longer exists.</p>;
  return (
    <div className="max-w-xl space-y-5 rounded-xl border border-neutral-200 p-6">
      <h1 className="text-2xl font-semibold">Confirm order fulfillment</h1>
      <dl className="space-y-2 text-sm text-neutral-700">
        <div><dt className="font-semibold">Order</dt><dd className="break-all">{orderId}</dd></div>
        {order.customer_name && <div><dt className="font-semibold">Customer</dt><dd>{order.customer_name}</dd></div>}
        <div><dt className="font-semibold">Placed</dt><dd>{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date(order.created_at))}</dd></div>
      </dl>
      {order.status === "paid" ? <OrderFulfillmentConfirmation token={token} />
        : <p>{order.status === "fulfilled" ? "This order has already been fulfilled." : "This order is not awaiting fulfillment."}</p>}
    </div>
  );
}
