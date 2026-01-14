"use server";

import { sql } from "@vercel/postgres";

export async function getPrintByIdAction(printId: string) {
  const { rows } = await sql<{
    id: string;
    price: string;
    quantity: number;
    size: string;
    title: string | null;
  }>`
    SELECT prints.id, prints.price, prints.quantity, prints.size, paintings.title
    FROM prints
    LEFT JOIN paintings ON paintings.id = prints.painting_id
    WHERE prints.id = ${printId}
    LIMIT 1;
  `;
  const print = rows[0];
  if (!print) {
    throw new Error("Print not found.");
  }

  return {
    id: print.id,
    price: Number(print.price),
    quantity: Number(print.quantity ?? 0),
    size: print.size,
    title: print.title,
  };
}

export async function getPrintsBulkAction(ids: string[]) {
  if (!ids.length) return [];
  const idsParam = ids as unknown as any;
  const { rows } = await sql`
    SELECT
      prints.id,
      prints.size,
      prints.price,
      prints.quantity,
      paintings.title,
      paintings.image_url
    FROM prints
    LEFT JOIN paintings ON paintings.id = prints.painting_id
    WHERE prints.id = ANY(${idsParam})
  `;
  return rows.map((row) => ({
    id: row.id,
    size: row.size,
    price: Number(row.price ?? 0),
    quantity: Number(row.quantity ?? 0),
    title: row.title as string | null,
    image_url: row.image_url as string | null,
  }));
}
