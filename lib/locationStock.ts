import { sql } from "@vercel/postgres";

export type LocationRecord = {
  id: string;
  name: string;
  notes: string | null;
};

export async function ensureDefaultLocation(): Promise<string> {
  const { rows } = await sql`
    INSERT INTO locations (name)
    VALUES ('Unassigned')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id;
  `;
  return rows[0].id as string;
}

type AdjustArgs = {
  printId: string;
  delta: number;
  reason: string;
  orderId?: string | null;
  locationId?: string | null;
};

export async function adjustPrintStock({
  printId,
  delta,
  reason,
  orderId = null,
  locationId = null,
}: AdjustArgs): Promise<{
  totalQuantity: number;
  locationQuantity: number;
  locationId: string;
}> {
  const targetLocationId = locationId || (await ensureDefaultLocation());

  if (locationId) {
    const { rowCount } = await sql`
      SELECT 1
      FROM locations
      WHERE id = ${locationId}
      LIMIT 1;
    `;
    if (!rowCount) {
      throw new Error("Location not found.");
    }
  }

  const { rows: availabilityRows } = await sql<{ total: string | null }>`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM print_location_stock
    WHERE print_id = ${printId};
  `;
  const totalAvailable = Number(availabilityRows[0]?.total ?? 0);
  if (delta < 0 && totalAvailable + delta < 0) {
    throw new Error("Not enough quantity available.");
  }

  if (delta < 0 && locationId) {
    const { rows: locationCheck } = await sql<{ quantity: number | null }>`
      SELECT quantity
      FROM print_location_stock
      WHERE print_id = ${printId} AND location_id = ${locationId}
      LIMIT 1;
    `;
    const atLocation = Number(locationCheck[0]?.quantity ?? 0);
    if (atLocation + delta < 0) {
      throw new Error("Not enough quantity at this location.");
    }
  }

  const { rows: upsertRows } = await sql<{ quantity: number | null }>`
    INSERT INTO print_location_stock (print_id, location_id, quantity)
    VALUES (${printId}, ${targetLocationId}, GREATEST(${delta}, 0))
    ON CONFLICT (print_id, location_id)
    DO UPDATE SET quantity = GREATEST(print_location_stock.quantity + ${delta}, 0)
    RETURNING quantity;
  `;
  const locationQuantity = Number(upsertRows[0]?.quantity ?? 0);

  const { rows: totalRows } = await sql<{ total: string | null }>`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM print_location_stock
    WHERE print_id = ${printId};
  `;
  const totalQuantity = Number(totalRows[0]?.total ?? 0);

  await sql`
    UPDATE prints
    SET quantity = ${totalQuantity}
    WHERE id = ${printId};
  `;

  await sql`
    INSERT INTO print_inventory_events (print_id, delta, reason, order_id)
    VALUES (${printId}, ${delta}, ${reason}, ${orderId});
  `;

  await sql`
    INSERT INTO print_location_events (print_id, from_location_id, to_location_id, delta, reason)
    VALUES (${printId}, ${delta < 0 ? targetLocationId : null}, ${delta > 0 ? targetLocationId : null}, ${delta}, ${reason});
  `;

  return { totalQuantity, locationQuantity, locationId: targetLocationId };
}
