"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { adjustPrintStock } from "@/lib/locationStock";

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

async function ensurePrintOwnership(printId: string, userId: string) {
  const { rowCount } = await sql`
    SELECT 1
    FROM prints
    JOIN paintings ON paintings.id = prints.painting_id
    WHERE prints.id = ${printId}
      AND paintings.user_id = ${userId}
    LIMIT 1;
  `;
  if (!rowCount) {
    throw new Error("Print not found.");
  }
}

async function ensurePaintingOwnership(paintingId: string, userId: string) {
  const { rowCount } = await sql`
    SELECT 1
    FROM paintings
    WHERE id = ${paintingId}
      AND user_id = ${userId}
    LIMIT 1;
  `;
  if (!rowCount) {
    throw new Error("Painting not found.");
  }
}

export async function addPrintSizeAction(params: {
  paintingId: string;
  size: string;
  price: string | number;
  initialQuantity?: string | number;
  locationId?: string | null;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  const size = params.size.trim();
  if (!size) throw new Error("Print size is required.");

  const priceNumber = Number(params.price);
  if (!Number.isFinite(priceNumber) || priceNumber < 0) {
    throw new Error("Price must be a valid number.");
  }

  await ensurePaintingOwnership(params.paintingId, userId);

  const { rows } = await sql<{ id: string }>`
    INSERT INTO prints (painting_id, size, price, quantity)
    VALUES (${params.paintingId}, ${size}, ${priceNumber}, 0)
    RETURNING id;
  `;
  const printId = rows[0]?.id as string;
  if (!printId) {
    throw new Error("Failed to create print.");
  }

  const initialQty = Math.floor(Number(params.initialQuantity ?? 0));
  if (initialQty > 0) {
    await adjustPrintStock({
      printId,
      delta: initialQty,
      reason: "new_print",
      orderId: null,
      locationId: params.locationId || null,
    });
  }

  revalidatePath("/app/dashboard/inventory");
  revalidatePath("/app/dashboard/gallery");
  return { printId };
}

export async function movePrintInventoryAction(params: {
  printId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: string | number;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  await ensurePrintOwnership(params.printId, userId);

  const quantity = Math.floor(Number(params.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  if (params.fromLocationId === params.toLocationId) {
    return { ok: true };
  }

  await adjustPrintStock({
    printId: params.printId,
    delta: -quantity,
    reason: "transfer",
    orderId: null,
    locationId: params.fromLocationId,
  });

  await adjustPrintStock({
    printId: params.printId,
    delta: quantity,
    reason: "transfer",
    orderId: null,
    locationId: params.toLocationId,
  });

  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function updatePrintPriceAction(params: {
  printId: string;
  price: string | number;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  await ensurePrintOwnership(params.printId, userId);

  const priceNumber = Number(params.price);
  if (!Number.isFinite(priceNumber) || priceNumber < 0) {
    throw new Error("Price must be a valid number.");
  }

  await sql`
    UPDATE prints
    SET price = ${priceNumber}
    WHERE id = ${params.printId};
  `;

  revalidatePath("/app/dashboard/inventory");
  revalidatePath("/app/dashboard/gallery");
  return { ok: true };
}

export async function addPrintInventoryAction(params: {
  printId: string;
  quantity: string | number;
  locationId: string | null;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  await ensurePrintOwnership(params.printId, userId);

  const quantity = Math.floor(Number(params.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  await adjustPrintStock({
    printId: params.printId,
    delta: quantity,
    reason: "manual_add",
    orderId: null,
    locationId: params.locationId || null,
  });

  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function removePrintInventoryAction(params: {
  printId: string;
  quantity: string | number;
  locationId: string | null;
  reason: string;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  await ensurePrintOwnership(params.printId, userId);

  const quantity = Math.floor(Number(params.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  await adjustPrintStock({
    printId: params.printId,
    delta: -quantity,
    reason: params.reason,
    orderId: null,
    locationId: params.locationId || null,
  });

  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function sellPrintInventoryAction(params: {
  printId: string;
  quantity: string | number;
  locationId: string | null;
  totalPrice: string | number;
  commissionRate?: string | number | null;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  await ensurePrintOwnership(params.printId, userId);

  const quantity = Math.floor(Number(params.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const totalPrice = Number(params.totalPrice);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error("Total price must be greater than zero.");
  }

  const commissionRate =
    params.commissionRate === null || params.commissionRate === undefined || params.commissionRate === ""
      ? 0
      : Number(params.commissionRate);
  if (!Number.isFinite(commissionRate) || commissionRate < 0) {
    throw new Error("Commission rate must be valid.");
  }

  const commissionAmount = Math.round((totalPrice * commissionRate / 100) * 100) / 100;
  const netOrderAmount = Math.max(0, totalPrice - commissionAmount);

  await sql`BEGIN`;
  try {
    await adjustPrintStock({
      printId: params.printId,
      delta: -quantity,
      reason: "sold",
      orderId: null,
      locationId: params.locationId || null,
    });

    const printInfo = await sql`
      SELECT p.painting_id, l.name AS location_name
      FROM prints p
      LEFT JOIN locations l ON l.id = ${params.locationId}
      WHERE p.id = ${params.printId};
    `;
    const paintingId = printInfo.rows[0]?.painting_id as string | null;
    const locationName = printInfo.rows[0]?.location_name as string | null;

    await sql`
      INSERT INTO orders (
        user_id,
        status,
        total_amount,
        currency,
        gross_amount,
        hst_collected
      )
      VALUES (
        ${userId},
        'fulfilled',
        ${netOrderAmount},
        'cad',
        ${netOrderAmount},
        0
      );
    `;

    if (commissionAmount > 0) {
      const expenseDate = new Date().toISOString().slice(0, 10);
      const expenseDetails = `${locationName ?? "Unknown location"} (${commissionRate}%)`;
      await sql`
        INSERT INTO expenses (user_id, painting_id, amount, category, subcategory, details, date, hst)
        VALUES (${userId}, ${paintingId}, ${commissionAmount}, 'Advertising', 'Finder''s fee', ${expenseDetails}, ${expenseDate}, 0);
      `;
    }

    await sql`COMMIT`;
  } catch (err) {
    await sql`ROLLBACK`;
    throw err;
  }

  revalidatePath("/app/dashboard/inventory");
  revalidatePath("/app/dashboard/finances");
  return { ok: true };
}

export async function updatePrintLocationPriceAction(params: {
  printId: string;
  locationId: string;
  priceOverride: string | number | null;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  await ensurePrintOwnership(params.printId, userId);

  const priceOverride =
    params.priceOverride === null || params.priceOverride === undefined || params.priceOverride === ""
      ? null
      : Number.isFinite(Number(params.priceOverride))
        ? Number(params.priceOverride)
        : null;

  if (priceOverride !== null && priceOverride < 0) {
    throw new Error("Price must be a valid number.");
  }

  await sql`
    INSERT INTO print_location_stock (print_id, location_id, quantity, price_override)
    VALUES (${params.printId}, ${params.locationId}, 0, ${priceOverride})
    ON CONFLICT (print_id, location_id)
    DO UPDATE SET price_override = ${priceOverride};
  `;

  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}
