import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import InventoryList from "@/app/components/InventoryList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InventoryPainting = {
  id: string;
  title: string;
  image_url: string | null;
  status?: string | null;
  prints: {
    id: string;
    size: string;
    price: number;
    quantity: number;
    location_stock: {
      location_id: string;
      location_name: string | null;
      quantity: number;
      commission_rate: number | null;
      price_override: number | null;
    }[];
  }[];
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

type LocationOption = {
  id: string;
  name: string;
};

async function getInventory(userId: string): Promise<InventoryPainting[]> {
  const { rows } = await sql<{
    painting_id: string;
    painting_title: string;
    painting_status: string | null;
    painting_image_url: string | null;
    print_id: string | null;
    size: string | null;
    price: number | null;
    quantity: number | null;
    location_id: string | null;
    location_quantity: number | null;
    location_name: string | null;
    location_commission_rate: number | null;
    location_price_override: number | null;
  }>`
    SELECT
      paintings.id AS painting_id,
      paintings.title AS painting_title,
      paintings.status AS painting_status,
      paintings.image_url AS painting_image_url,
      prints.id AS print_id,
      prints.size,
      prints.price,
      prints.quantity,
      pls.location_id,
      pls.quantity AS location_quantity,
      loc.name AS location_name,
      loc.commission_rate AS location_commission_rate,
      pls.price_override AS location_price_override
    FROM paintings
    LEFT JOIN prints ON prints.painting_id = paintings.id
    LEFT JOIN print_location_stock AS pls ON pls.print_id = prints.id
    LEFT JOIN locations AS loc ON loc.id = pls.location_id
    WHERE paintings.user_id = ${userId}
    ORDER BY paintings.title ASC, prints.created_at ASC NULLS LAST;
  `;

  const byPainting = new Map<string, InventoryPainting>();
  const printMaps = new Map<
    string,
    Map<string, InventoryPainting["prints"][number]>
  >();
  for (const row of rows) {
    if (!byPainting.has(row.painting_id)) {
      byPainting.set(row.painting_id, {
        id: row.painting_id,
        title: row.painting_title,
        status: row.painting_status,
        image_url: row.painting_image_url,
        prints: [],
      });
    }
    if (!row.print_id) continue;

    if (!printMaps.has(row.painting_id)) {
      printMaps.set(row.painting_id, new Map());
    }
    const paintingPrints = printMaps.get(row.painting_id)!;
    if (!paintingPrints.has(row.print_id)) {
      paintingPrints.set(row.print_id, {
        id: row.print_id,
        size: row.size || "",
        price: Number(row.price ?? 0),
        quantity: Number(row.quantity ?? 0),
        location_stock: [],
      });
    }
    if (row.location_id) {
      paintingPrints.get(row.print_id)!.location_stock.push({
        location_id: row.location_id,
        location_name: row.location_name,
        quantity: Number(row.location_quantity ?? 0),
        commission_rate:
          row.location_commission_rate !== null &&
          row.location_commission_rate !== undefined
            ? Number(row.location_commission_rate)
            : null,
        price_override:
          row.location_price_override !== null &&
          row.location_price_override !== undefined
            ? Number(row.location_price_override)
            : null,
      });
    }
  }

  for (const [paintingId, painting] of byPainting.entries()) {
    const prints = printMaps.get(paintingId);
    if (prints) {
      painting.prints = Array.from(prints.values());
    }
  }

  return Array.from(byPainting.values());
}

async function getLocations(): Promise<LocationOption[]> {
  const { rows } = await sql`
    SELECT id, name
    FROM locations
    ORDER BY name ASC;
  `;
  return rows as LocationOption[];
}

export default async function InventoryPage() {
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

  const [inventory, locations] = await Promise.all([
    getInventory(user.id),
    getLocations(),
  ]);

  return (
    <div className="pb-12 space-y-4 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Print inventory
      </h1>

      <InventoryList inventory={inventory} locations={locations} />
    </div>
  );
}
