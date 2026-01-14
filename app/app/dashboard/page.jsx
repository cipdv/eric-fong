import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import OrdersList from "@/app/components/OrdersList";

async function getOrders() {
  const { rows } = await sql`
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
    LIMIT 50;
  `;
  return rows;
}

async function getPaintingsToRetrieve(userId) {
  const { rows } = await sql`
    SELECT
      p.id,
      p.title,
      p.location_end_date,
      l.name AS location_name
    FROM paintings p
    LEFT JOIN locations l ON l.id = p.location_id
    WHERE p.user_id = ${userId}
      AND p.location_id IS NOT NULL
      AND p.location_end_date IS NOT NULL
      AND p.location_end_date < CURRENT_DATE
    ORDER BY p.location_end_date ASC;
  `;
  return rows;
}

async function markPaintingRetrievedAction(formData) {
  "use server";

  const paintingId = formData.get("paintingId");
  if (!paintingId || typeof paintingId !== "string") {
    throw new Error("Missing painting.");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  if (!token) throw new Error("Unauthorized");

  const { rows } = await sql`
    SELECT users.id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;
  const userId = rows[0]?.id;
  if (!userId) throw new Error("Unauthorized");

  await sql`
    UPDATE paintings
    SET location_id = NULL,
        location_start_date = NULL,
        location_end_date = NULL,
        location_commission_rate = NULL
    WHERE id = ${paintingId}
      AND user_id = ${userId};
  `;

  revalidatePath("/app/dashboard");
  revalidatePath("/app/dashboard/gallery");
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("app_session");

  if (!sessionCookie) {
    return (
      <div className="pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Not authenticated
        </h1>
      </div>
    );
  }

  const { rows } = await sql`
    SELECT users.id, users.first_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${sessionCookie.value}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;
  const user = rows[0];
  const firstName = user?.first_name ?? "friend";
  const orders = await getOrders();
  const paintingsToRetrieve = user?.id
    ? await getPaintingsToRetrieve(user.id)
    : [];

  return (
    <div className="pb-12 space-y-4 mt-8">
      <h1 className="text-3xl font-semibold text-neutral-900">
        Hi {firstName}
      </h1>
      {paintingsToRetrieve.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="text-base font-semibold text-amber-950">
            Paintings to retrieve
          </div>
          <ul className="space-y-2">
            {paintingsToRetrieve.map((painting) => (
              <li
                key={painting.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-white px-3 py-2"
              >
                <div className="text-sm text-amber-900">
                  <span className="font-semibold">{painting.title}</span>
                  {painting.location_name
                    ? ` · ${painting.location_name}`
                    : ""}
                  {painting.location_end_date
                    ? ` · ended ${new Date(
                        painting.location_end_date
                      ).toLocaleDateString("en-CA")}`
                    : ""}
                </div>
                <form action={markPaintingRetrievedAction}>
                  <input type="hidden" name="paintingId" value={painting.id} />
                  <button
                    type="submit"
                    className="rounded border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
                  >
                    Retrieved
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
      {orders.length === 0 ? (
        <p className="text-sm text-neutral-700">
          You have fulfilled all your orders.
        </p>
      ) : (
        <OrdersList orders={orders} />
      )}
    </div>
  );
}
