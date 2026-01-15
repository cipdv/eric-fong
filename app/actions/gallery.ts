"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { adjustPrintStock } from "@/lib/locationStock";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

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

type AuthError = Error & { statusCode?: number };

function ensureAuth(userId?: string | null) {
  if (!userId) {
    const err = new Error("Unauthorized") as AuthError;
    err.statusCode = 401;
    throw err;
  }
}

export type LocationRecord = {
  id: string;
  name: string;
  notes: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal: string | null;
  country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  start_date: string | null;
  end_date: string | null;
  commission_rate: number | null;
};

type LocationInput = {
  name: string;
  notes?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
  country?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  commission_rate?: number | null;
};

export async function createLocation(input: LocationInput): Promise<LocationRecord> {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const name = input.name?.trim();
  const notes = input.notes?.trim() || null;
  if (!name) throw new Error("Name is required.");
  const address1 = input.address_line1?.trim() || null;
  const address2 = input.address_line2?.trim() || null;
  const city = input.city?.trim() || null;
  const province = input.province?.trim() || null;
  const postal = input.postal?.trim() || null;
  const country = input.country?.trim() || null;
  const contactName = input.contact_name?.trim() || null;
  const contactPhone = input.contact_phone?.trim() || null;
  const contactEmail = input.contact_email?.trim() || null;
  const startDate = input.start_date || null;
  const endDate = input.end_date || null;
  const commission =
    input.commission_rate === null || input.commission_rate === undefined
      ? null
      : Number.isFinite(Number(input.commission_rate))
        ? Number(input.commission_rate)
        : null;

  const insert = await sql<LocationRecord>`
    INSERT INTO locations (
      name,
      notes,
      address_line1,
      address_line2,
      city,
      province,
      postal,
      country,
      contact_name,
      contact_phone,
      contact_email,
      start_date,
      end_date,
      commission_rate
    )
    VALUES (
      ${name},
      ${notes},
      ${address1},
      ${address2},
      ${city},
      ${province},
      ${postal},
      ${country},
      ${contactName},
      ${contactPhone},
      ${contactEmail},
      ${startDate},
      ${endDate},
      ${commission}
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING
      id,
      name,
      notes,
      address_line1,
      address_line2,
      city,
      province,
      postal,
      country,
      contact_name,
      contact_phone,
      contact_email,
      start_date,
      end_date,
      commission_rate;
  `;

  if (!insert.rowCount) {
    const existing = await sql<LocationRecord>`
      SELECT
        id,
        name,
        notes,
        address_line1,
        address_line2,
        city,
        province,
        postal,
        country,
        contact_name,
        contact_phone,
        contact_email,
        start_date,
        end_date,
        commission_rate
      FROM locations
      WHERE name = ${name}
      LIMIT 1;
    `;
    if (!existing.rowCount) {
      throw new Error("Could not create location.");
    }
    return existing.rows[0];
  }

  revalidatePath("/app/dashboard/gallery");
  return insert.rows[0];
}

export async function updateLocationAction(input: {
  locationId: string;
  name: string;
  notes?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
  country?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  commission_rate?: number | null;
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const name = input.name?.trim();
  if (!name) throw new Error("Name is required.");

  const { rows: existingRows } = await sql<{ name: string | null }>`
    SELECT name
    FROM locations
    WHERE id = ${input.locationId}
    LIMIT 1;
  `;
  const existingName = existingRows[0]?.name?.trim().toLowerCase();
  if (existingName === "online shop" && name.trim().toLowerCase() !== "online shop") {
    throw new Error('The "Online shop" location cannot be renamed.');
  }

  const commission =
    input.commission_rate === null || input.commission_rate === undefined
      ? null
      : Number.isFinite(Number(input.commission_rate))
        ? Number(input.commission_rate)
        : null;

  const updated = await sql`
    UPDATE locations
    SET name = ${name},
        notes = ${input.notes?.trim() || null},
        address_line1 = ${input.address_line1?.trim() || null},
        address_line2 = ${input.address_line2?.trim() || null},
        city = ${input.city?.trim() || null},
        province = ${input.province?.trim() || null},
        postal = ${input.postal?.trim() || null},
        country = ${input.country?.trim() || null},
        contact_name = ${input.contact_name?.trim() || null},
        contact_phone = ${input.contact_phone?.trim() || null},
        contact_email = ${input.contact_email?.trim() || null},
        start_date = ${input.start_date || null},
        end_date = ${input.end_date || null},
        commission_rate = ${commission}
    WHERE id = ${input.locationId}
    RETURNING id;
  `;

  if (!updated.rowCount) {
    throw new Error("Location not found.");
  }

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function removeLocationAction(locationId: string) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const { rows } = await sql<{ name: string | null }>`
    SELECT name
    FROM locations
    WHERE id = ${locationId}
    LIMIT 1;
  `;
  const name = rows[0]?.name?.trim().toLowerCase();
  if (name === "online shop") {
    throw new Error('The "Online shop" location cannot be removed.');
  }

  await sql`
    UPDATE locations
    SET status = 'removed'
    WHERE id = ${locationId};
  `;

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

type PrintInput = { id: string; price: string; size: string };

export async function updatePaintingAction(input: {
  paintingId: string;
  title: string;
  details: string;
  medium: string;
  size_original: string;
  price_original: string;
  is_home_image: boolean;
  include_in_gallery: boolean;
  location_id: string | null;
  location_start_date?: string | null;
  location_end_date?: string | null;
  location_commission_rate?: string | null;
  prints: PrintInput[];
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  if (process.env.NODE_ENV !== "production") {
    console.log("[updatePaintingAction] payload", {
      paintingId: input.paintingId,
      location_id: input.location_id,
      is_home_image: input.is_home_image,
    });
  }

  const normalizeDate = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const commissionRate =
    input.location_commission_rate === null ||
    input.location_commission_rate === undefined ||
    input.location_commission_rate === ""
      ? null
      : Number.isFinite(Number(input.location_commission_rate))
        ? Number(input.location_commission_rate)
        : null;

  const updated = await sql`
    UPDATE paintings
    SET title = ${input.title},
        details = ${input.details},
        medium = ${input.medium},
        size_original = ${input.size_original},
        price_original = ${input.price_original},
        is_home_image = ${input.is_home_image},
        include_in_gallery = ${input.include_in_gallery},
        location_id = ${input.location_id},
        location_start_date = ${normalizeDate(input.location_start_date)},
        location_end_date = ${normalizeDate(input.location_end_date)},
        location_commission_rate = ${commissionRate}
    WHERE id = ${input.paintingId}
    RETURNING id;
  `;

  if (!updated.rowCount) {
    throw new Error("Painting not found; could not save changes.");
  }

  // Best-effort legacy column support if present
  try {
    await sql`
      UPDATE paintings
      SET is_home_page = ${input.is_home_image}
      WHERE id = ${input.paintingId};
    `;
  } catch {
    // ignore if column not present
  }

  if (input.is_home_image) {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[updatePaintingAction] setting home", input.paintingId);
      }
      await sql`
        UPDATE paintings
        SET is_home_image = FALSE
        WHERE id <> ${input.paintingId};
      `;
      // legacy column
      await sql`
        UPDATE paintings
        SET is_home_page = FALSE
        WHERE id <> ${input.paintingId};
      `;
    } catch {
      // ignore if column missing
    }
  }

  for (const pr of input.prints || []) {
    if (!pr?.id) continue;
    await sql`
      UPDATE prints
      SET price = ${pr.price}, size = ${pr.size}
      WHERE id = ${pr.id} AND painting_id = ${input.paintingId};
    `;
  }

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function deletePaintingAction(paintingId: string) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  await sql`DELETE FROM prints WHERE painting_id = ${paintingId};`;
  await sql`DELETE FROM paintings WHERE id = ${paintingId};`;

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function adjustPrintInventoryAction(params: {
  printId: string;
  addQuantity?: number;
  removeQuantity?: number;
  reason?: string;
  locationId: string;
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const addQuantity = Math.floor(Number(params.addQuantity ?? 0));
  const removeQuantity = Math.floor(Number(params.removeQuantity ?? 0));
  if ((!addQuantity || addQuantity <= 0) && (!removeQuantity || removeQuantity <= 0)) {
    throw new Error("Specify a quantity to add or remove.");
  }
  const delta = addQuantity > 0 ? addQuantity : removeQuantity > 0 ? -removeQuantity : 0;
  const { totalQuantity, locationQuantity, locationId } = await adjustPrintStock({
    printId: params.printId,
    delta,
    reason: params.reason || "manual_adjust",
    orderId: null,
    locationId: params.locationId,
  });

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { quantity: totalQuantity, locationQuantity, locationId };
}

export async function markPaintingSoldAction(params: {
  paintingId: string;
  pricePaid: number;
  commissionRate?: number | string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shipAddress1?: string | null;
  shipAddress2?: string | null;
  shipCity?: string | null;
  shipProvince?: string | null;
  shipPostal?: string | null;
  shipCountry?: string | null;
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const pricePaid = Number(params.pricePaid);
  if (!Number.isFinite(pricePaid) || pricePaid <= 0) {
    throw new Error("Invalid price paid.");
  }

  const {
    paintingId,
    customerFirstName,
    customerLastName,
    customerEmail,
    customerPhone,
    shipAddress1,
    shipAddress2,
    shipCity,
    shipProvince,
    shipPostal,
    shipCountry,
  } = params;

  const commissionPercent =
    params.commissionRate === null || params.commissionRate === undefined
      ? null
      : Number.isFinite(Number(params.commissionRate))
        ? Number(params.commissionRate)
        : null;

  await sql`BEGIN`;
  try {
    const updatePainting = await sql`
      UPDATE paintings
      SET status = 'sold'
      WHERE id = ${paintingId}
      RETURNING id;
    `;
    if (!updatePainting.rowCount) {
      throw new Error("Painting not found.");
    }

    const orderInsert = await sql`
      INSERT INTO orders (
        user_id,
        status,
        total_amount,
        currency,
        gross_amount,
        hst_collected,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        customer_email,
        customer_first_name,
        customer_last_name,
        customer_phone,
        ship_address1,
        ship_address2,
        ship_city,
        ship_province,
        ship_postal,
        ship_country
      )
      VALUES (
        NULL,
        'fulfilled',
        ${pricePaid},
        'cad',
        ${pricePaid},
        0,
        NULL,
        NULL,
        ${customerEmail ?? null},
        ${customerFirstName ?? null},
        ${customerLastName ?? null},
        ${customerPhone ?? null},
        ${shipAddress1 ?? null},
        ${shipAddress2 ?? null},
        ${shipCity ?? null},
        ${shipProvince ?? null},
        ${shipPostal ?? null},
        ${shipCountry ?? null}
      )
      RETURNING id;
    `;

    const orderId = orderInsert.rows[0]?.id as string;
    if (orderId) {
      await sql`
        UPDATE paintings
        SET sale_order_id = ${orderId}
        WHERE id = ${paintingId};
      `;
    }

    if (commissionPercent !== null) {
      await sql`
        UPDATE paintings
        SET location_commission_rate = ${commissionPercent}
        WHERE id = ${paintingId};
      `;
    }

    if (commissionPercent !== null && commissionPercent > 0) {
      const commissionAmount = Math.round((pricePaid * commissionPercent / 100) * 100) / 100;
      const expenseDate = new Date().toISOString().slice(0, 10);
      const locationResult = await sql`
        SELECT l.name AS location_name
        FROM paintings p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE p.id = ${paintingId};
      `;
      const locationName = locationResult.rows[0]?.location_name as string | null;
      const expenseDetails = `${locationName ?? "Unknown location"} (${commissionPercent}%)`;
      await sql`
        INSERT INTO expenses (user_id, painting_id, amount, category, subcategory, details, date, hst)
        VALUES (${userId}, ${paintingId}, ${commissionAmount}, 'Advertising', 'Finder''s fees', ${expenseDetails}, ${expenseDate}, 0);
      `;
    }

    await sql`COMMIT`;
    revalidatePath("/app/dashboard/gallery");
    revalidatePath("/app/dashboard/orders");
    return { orderId };
  } catch (err) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    throw err;
  }
}

export async function unsellPaintingAction(params: { paintingId: string; nextStatus: string; orderId?: string | null }) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const { paintingId, nextStatus, orderId } = params;

  await sql`BEGIN`;
  try {
    const { rows } = await sql`
      SELECT sale_order_id
      FROM paintings
      WHERE id = ${paintingId}
      FOR UPDATE;
    `;
    const saleOrderId = rows[0]?.sale_order_id as string | null;
    const orderIdToDelete = orderId || saleOrderId;

    if (orderIdToDelete) {
      await sql`DELETE FROM order_items WHERE order_id = ${orderIdToDelete};`;
      await sql`DELETE FROM orders WHERE id = ${orderIdToDelete};`;
    }

    await sql`
      DELETE FROM expenses
      WHERE painting_id = ${paintingId}
        AND category = 'Advertising'
        AND subcategory = 'Finder''s fees';
    `;

    await sql`
      UPDATE paintings
      SET status = ${nextStatus}, sale_order_id = NULL
      WHERE id = ${paintingId};
    `;

    await sql`COMMIT`;
    revalidatePath("/app/dashboard/gallery");
    revalidatePath("/app/dashboard/orders");
    return { ok: true };
  } catch (err) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    throw err;
  }
}

export async function createPaintingAction(formData: FormData) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const title = formData.get("title")?.toString().trim() ?? "";
  const details = formData.get("details")?.toString().trim() ?? "";
  const medium = formData.get("medium")?.toString().trim() ?? "";
  const sizeOriginalHeight = formData.get("sizeOriginalHeight")?.toString().trim() ?? "";
  const sizeOriginalWidth = formData.get("sizeOriginalWidth")?.toString().trim() ?? "";
  const priceOriginal = formData.get("priceOriginal")?.toString().trim() ?? "";
  const printsAvailable = formData.get("printsAvailable")?.toString().toLowerCase() === "true";
  const locationId = formData.get("locationId")?.toString().trim() || null;
  const status = formData.get("status")?.toString().trim() || "available for sale";
  const printsRaw = formData.get("prints")?.toString() ?? "[]";
  const imageFile = formData.get("image");

  if (
    !title ||
    !details ||
    !medium ||
    !sizeOriginalHeight ||
    !sizeOriginalWidth ||
    !priceOriginal ||
    !(imageFile instanceof File)
  ) {
    throw new Error("Missing required fields.");
  }

  type NewPrintPayload = {
    width: string;
    height: string;
    price: string | number;
    quantity: number;
  };
  let prints: NewPrintPayload[] = [];
  if (printsAvailable) {
    try {
      const parsed = JSON.parse(printsRaw);
      if (Array.isArray(parsed)) {
        prints = parsed;
      }
    } catch {
      throw new Error("Invalid prints payload.");
    }
  }

  const blob = await put(`paintings/${crypto.randomUUID()}-${imageFile.name}`, imageFile, {
    access: "public",
    contentType: imageFile.type,
  });

  const insertedPainting = await sql`
    INSERT INTO paintings
      (user_id, title, image_url, details, medium, size_original, price_original, status, prints_available, location_id)
    VALUES
      (${userId}, ${title}, ${blob.url}, ${details}, ${medium}, ${`${sizeOriginalWidth} x ${sizeOriginalHeight} in`}, ${priceOriginal}, ${status || "available for sale"}, ${printsAvailable}, ${locationId})
    RETURNING id;
  `;

  const paintingId = insertedPainting.rows[0].id as string;

  if (printsAvailable && Array.isArray(prints) && prints.length > 0) {
    for (const print of prints) {
      if (!print?.width || !print?.height || !print?.price || print.quantity === undefined) {
        continue;
      }
      await sql`
        INSERT INTO prints (painting_id, size, price, quantity)
        VALUES (${paintingId}, ${`${print.width} x ${print.height} in`}, ${print.price}, ${print.quantity});
      `;
    }
  }

  revalidatePath("/app/dashboard/gallery");
  return { paintingId };
}
