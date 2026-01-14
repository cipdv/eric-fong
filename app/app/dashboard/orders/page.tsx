import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import OrdersList from "@/app/components/OrdersList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderItem = {
  printId: string | null;
  quantity: number | null;
  unitPrice: string | null;
  size: string | null;
  paintingTitle: string | null;
};

type Order = {
  id: string;
  status: string;
  total_amount: string;
  currency: string;
  created_at: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  ship_address1: string | null;
  ship_address2: string | null;
  ship_city: string | null;
  ship_province: string | null;
  ship_postal: string | null;
  ship_country: string | null;
  items: OrderItem[] | null;
};

async function getCurrentUser() {
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

  return rows[0] ?? null;
}

async function getOrders() {
  const { rows } = await sql<Order>`
    SELECT
      orders.id,
      orders.status,
      orders.total_amount,
      orders.currency,
      orders.created_at,
      orders.user_id,
      users.first_name,
      users.last_name,
      orders.customer_first_name,
      orders.customer_last_name,
      orders.customer_email,
      orders.customer_phone,
      orders.ship_address1,
      orders.ship_address2,
      orders.ship_city,
      orders.ship_province,
      orders.ship_postal,
      orders.ship_country,
      COALESCE(
        json_agg(
          json_build_object(
            'printId', order_items.print_id,
            'quantity', order_items.quantity,
            'unitPrice', order_items.unit_price,
            'size', prints.size,
            'paintingTitle', paintings.title
          )
        ) FILTER (WHERE order_items.id IS NOT NULL),
        '[]'
      ) as items
    FROM orders
    LEFT JOIN users ON users.id = orders.user_id
    LEFT JOIN order_items ON order_items.order_id = orders.id
    LEFT JOIN prints ON prints.id = order_items.print_id
    LEFT JOIN paintings ON paintings.id = prints.painting_id
    WHERE orders.status <> 'fulfilled'
    GROUP BY orders.id, users.first_name, users.last_name
    ORDER BY orders.created_at DESC
    LIMIT 100;
  `;
  return rows;
}

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="pb-12 space-y-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Not authenticated
        </h1>
      </div>
    );
  }

  const orders = await getOrders();

  return (
    <div className="pb-12 space-y-4 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Orders</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-700">You have fulfilled all your orders.</p>
      ) : (
        <OrdersList orders={orders} />
      )}
    </div>
  );
}
