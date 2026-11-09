import { createFulfillmentToken } from "@/lib/orderFulfillmentToken";

export type OverdueOrder = {
  id: string;
  created_at: string;
  customer_name: string | null;
  items: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function buildOrderReminderEmail(orders: OverdueOrder[], origin: string, secret: string) {
  const subject = `${orders.length} unfulfilled order${orders.length === 1 ? "" : "s"} older than a week`;
  const intro = "These paid orders were placed more than seven days ago and are still awaiting fulfillment.";
  const text = [subject, "", intro];
  const cards = orders.map((order) => {
    const url = new URL("/orders/fulfill", origin);
    url.searchParams.set("token", createFulfillmentToken(order.id, secret));
    const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date(order.created_at));
    const customer = order.customer_name || "Customer name unavailable";
    text.push("", `Order ${order.id}`, `Placed: ${date}`, customer, order.items || "", `Confirm fulfillment: ${url.href}`);
    return `<section style="border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0"><h2 style="font-size:18px">Order ${escapeHtml(order.id)}</h2><p>Placed: ${escapeHtml(date)}<br />${escapeHtml(customer)}</p><p>${escapeHtml(order.items || "").replace(/\n/g, "<br />")}</p><a href="${escapeHtml(url.href)}" style="display:inline-block;background:#171717;color:#fff;padding:12px 18px;border-radius:4px;text-decoration:none">Mark order fulfilled</a></section>`;
  });
  text.push("", "Each button opens a confirmation page. Links expire after seven days.");
  return {
    subject, text: text.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#262626;max-width:680px"><h1 style="font-size:24px">${escapeHtml(subject)}</h1><p>${intro}</p>${cards.join("")}<p>Each button opens a confirmation page. Links expire after seven days.</p></div>`,
  };
}
