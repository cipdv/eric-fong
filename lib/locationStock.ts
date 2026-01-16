import { sql } from "@vercel/postgres";
import { createMailer, getMailerConfig } from "@/lib/mailer";

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
  let previousLocationQty = 0;

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
    const { rows: prevRows } = await sql<{ quantity: number | null }>`
      SELECT quantity
      FROM print_location_stock
      WHERE print_id = ${printId} AND location_id = ${locationId}
      LIMIT 1;
    `;
    previousLocationQty = Number(prevRows[0]?.quantity ?? 0);
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

  if (delta > 0 && locationId && previousLocationQty === 0 && locationQuantity > 0) {
    try {
      const { rows: locationRows } = await sql<{ name: string | null }>`
        SELECT name
        FROM locations
        WHERE id = ${targetLocationId}
        LIMIT 1;
      `;
      const locationName = locationRows[0]?.name;
      if (locationName === "Online shop") {
        const { rows: notifyRows } = await sql<{
          id: string;
          email: string;
          name: string | null;
        }>`
          SELECT id, email, name
          FROM print_restock_requests
          WHERE print_id = ${printId}
            AND notified_at IS NULL;
        `;
        if (notifyRows.length) {
          const toAddress = process.env.CONTACT_EMAIL_TO;
          const mailerConfig = getMailerConfig();
          if (toAddress && mailerConfig) {
            const { rows: printRows } = await sql<{
              title: string | null;
              size: string | null;
            }>`
              SELECT paintings.title, prints.size
              FROM prints
              LEFT JOIN paintings ON paintings.id = prints.painting_id
              WHERE prints.id = ${printId}
              LIMIT 1;
            `;
            const title = printRows[0]?.title || "Print";
            const size = printRows[0]?.size ? ` (${printRows[0]?.size})` : "";
            const baseEnv =
              process.env.NEXT_PUBLIC_BASE_URL ||
              process.env.VERCEL_PROJECT_PRODUCTION_URL ||
              process.env.VERCEL_URL;
            const baseUrl = baseEnv
              ? baseEnv.startsWith("http://") || baseEnv.startsWith("https://")
                ? baseEnv
                : `https://${baseEnv}`
              : "http://localhost:3000";
            const transporter = createMailer();
            if (transporter) {
              for (const request of notifyRows) {
              await transporter.sendMail({
                from: toAddress,
                to: request.email,
                replyTo: toAddress,
                subject: `${title}${size} is back in stock`,
                text: [
                  `Hi${request.name ? ` ${request.name.split(" ")[0]}` : ""},`,
                  `Good news, ${title}${size} is back in stock at ${baseUrl}/prints.`,
                  "Order yours today.",
                  "Thanks, -Eric",
                ].join("\n"),
              });
              }
              const idsParam = notifyRows.map((row) => row.id) as unknown as string;
              await sql`
                UPDATE print_restock_requests
                SET notified_at = NOW()
                WHERE id = ANY(${idsParam}::uuid[]);
              `;
            }
          }
        }
      }
    } catch (err) {
      console.error("[locationStock] restock notification failed", err);
    }
  }

  return { totalQuantity, locationQuantity, locationId: targetLocationId };
}
