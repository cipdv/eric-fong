"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql, type VercelPoolClient } from "@vercel/postgres";
import { adjustPrintStock } from "@/lib/locationStock";
import { del, put } from "@vercel/blob";
import crypto from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAINTING_STATUSES = new Set([
  "available for sale",
  "sold",
  "not available for sale",
]);
const INVENTORY_REASONS = new Set([
  "manual_add",
  "manual_adjust",
  "damaged",
  "sold",
  "other",
]);

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

function ensureAuth(userId?: string | null): asserts userId is string {
  if (!userId) {
    const err = new Error("Unauthorized") as AuthError;
    err.statusCode = 401;
    throw err;
  }
}

function assertUuid(value: unknown, label: string) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID_RE.test(id)) {
    throw new Error(`${label} is invalid.`);
  }
  return id;
}

function cleanText(value: unknown, label: string, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error(`${label} is required.`);
  return text;
}

function nullableText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function parseMoney(value: unknown, label: string, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  const amount = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be a valid amount.`);
  }
  return amount;
}

function parsePositiveMoney(value: unknown, label: string) {
  const amount = parseMoney(value, label, true);
  if (amount === null || amount <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return amount;
}

function parseNonNegativeInteger(value: unknown, label: string) {
  const qty = Math.floor(Number(value ?? 0));
  if (!Number.isFinite(qty) || qty < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return qty;
}

function parseCommission(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("Commission rate must be between 0 and 100.");
  }
  return rate;
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!DATE_RE.test(trimmed)) throw new Error("Date must use YYYY-MM-DD format.");
  return trimmed;
}

function assertStatus(value: unknown) {
  const status = cleanText(value, "Status", true);
  if (!PAINTING_STATUSES.has(status)) {
    throw new Error("Status is invalid.");
  }
  return status;
}

function assertInventoryReason(value: unknown, fallback: string) {
  const reason = cleanText(value, "Reason") || fallback;
  if (!INVENTORY_REASONS.has(reason)) {
    throw new Error("Inventory reason is invalid.");
  }
  return reason;
}

async function assertPrintOwner(printId: string, userId: string) {
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

async function withTransaction<T>(
  work: (client: VercelPoolClient) => Promise<T>,
) {
  const client = await sql.connect();
  try {
    await client.sql`BEGIN`;
    const result = await work(client);
    await client.sql`COMMIT`;
    return result;
  } catch (err) {
    try {
      await client.sql`ROLLBACK`;
    } catch {}
    throw err;
  } finally {
    client.release();
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
  const startDate = normalizeDate(input.start_date);
  const endDate = normalizeDate(input.end_date);
  const commission =
    parseCommission(input.commission_rate);

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

  const locationId = assertUuid(input.locationId, "Location ID");
  const name = cleanText(input.name, "Name", true);

  const { rows: existingRows } = await sql<{ name: string | null }>`
    SELECT name
    FROM locations
    WHERE id = ${locationId}
    LIMIT 1;
  `;
  const existingName = existingRows[0]?.name?.trim().toLowerCase();
  if (existingName === "online shop" && name.trim().toLowerCase() !== "online shop") {
    throw new Error('The "Online shop" location cannot be renamed.');
  }

  const commission = parseCommission(input.commission_rate);

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
        start_date = ${normalizeDate(input.start_date)},
        end_date = ${normalizeDate(input.end_date)},
        commission_rate = ${commission}
    WHERE id = ${locationId}
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
  const id = assertUuid(locationId, "Location ID");

  const { rows } = await sql<{ name: string | null }>`
    SELECT name
    FROM locations
    WHERE id = ${id}
    LIMIT 1;
  `;
  const name = rows[0]?.name?.trim().toLowerCase();
  if (name === "online shop") {
    throw new Error('The "Online shop" location cannot be removed.');
  }

  await sql`
    UPDATE locations
    SET status = 'removed'
    WHERE id = ${id};
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
  is_home_image_second: boolean;
  include_in_gallery: boolean;
  location_id: string | null;
  location_start_date?: string | null;
  location_end_date?: string | null;
  location_commission_rate?: string | null;
  prints: PrintInput[];
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);
  const paintingId = assertUuid(input.paintingId, "Painting ID");
  const locationId = input.location_id
    ? assertUuid(input.location_id, "Location ID")
    : null;
  const title = cleanText(input.title, "Title", true);
  const details = cleanText(input.details, "Details");
  const medium = cleanText(input.medium, "Medium", true);
  const sizeOriginal = cleanText(input.size_original, "Original size", true);
  const priceOriginal = parseMoney(input.price_original, "Original price", true);
  if (input.is_home_image && input.is_home_image_second) {
    throw new Error("Choose different paintings for the first and second homepage images.");
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[updatePaintingAction] payload", {
      paintingId,
      location_id: input.location_id,
      is_home_image: input.is_home_image,
    });
  }

  const commissionRate =
    parseCommission(input.location_commission_rate);

  const updated = await sql`
    UPDATE paintings
    SET title = ${title},
        details = ${details},
        medium = ${medium},
        size_original = ${sizeOriginal},
        price_original = ${priceOriginal},
        is_home_image = ${input.is_home_image},
        is_home_image_second = ${input.is_home_image_second},
        include_in_gallery = ${input.include_in_gallery},
        location_id = ${locationId},
        location_start_date = ${normalizeDate(input.location_start_date)},
        location_end_date = ${normalizeDate(input.location_end_date)},
        location_commission_rate = ${commissionRate}
    WHERE id = ${paintingId}
      AND user_id = ${userId}
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
      WHERE id = ${paintingId}
        AND user_id = ${userId};
    `;
  } catch {
    // ignore if column not present
  }

  if (input.is_home_image) {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[updatePaintingAction] setting home", paintingId);
      }
      await sql`
        UPDATE paintings
        SET is_home_image = FALSE
        WHERE id <> ${paintingId}
          AND user_id = ${userId};
      `;
      // legacy column
      await sql`
        UPDATE paintings
        SET is_home_page = FALSE
        WHERE id <> ${paintingId}
          AND user_id = ${userId};
      `;
    } catch {
      // ignore if column missing
    }
  }

  if (input.is_home_image_second) {
    await sql`
      UPDATE paintings
      SET is_home_image_second = FALSE
      WHERE id <> ${paintingId}
        AND user_id = ${userId};
    `;
  }

  revalidatePath("/");

  for (const pr of input.prints || []) {
    if (!pr?.id) continue;
    const printId = assertUuid(pr.id, "Print ID");
    const printSize = cleanText(pr.size, "Print size", true);
    const printPrice = parseMoney(pr.price, "Print price", true);
    await sql`
      UPDATE prints
      SET price = ${printPrice}, size = ${printSize}
      WHERE id = ${printId} AND painting_id = ${paintingId};
    `;
  }

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { ok: true };
}

export async function updateGalleryOrderAction(input: { orderedIds: string[] }) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const orderedIds = Array.isArray(input.orderedIds)
    ? Array.from(
        new Set(
          input.orderedIds
            .map((id) => assertUuid(id, "Painting ID"))
            .filter(Boolean),
        ),
      )
    : [];
  if (!orderedIds.length) {
    throw new Error("No paintings provided.");
  }

  const orderedJson = JSON.stringify(orderedIds);
  await sql`
    WITH ordered AS (
      SELECT value::uuid AS id, ord::int AS sort_order
      FROM jsonb_array_elements_text(${orderedJson}::jsonb) WITH ORDINALITY AS t(value, ord)
    )
    UPDATE paintings AS p
    SET gallery_sort_order = ordered.sort_order
    FROM ordered
    WHERE p.id = ordered.id
      AND p.user_id = ${userId};
  `;

  revalidatePath("/gallery");
  revalidatePath("/app/dashboard/gallery");
  return { ok: true };
}

export async function deletePaintingAction(paintingId: string) {
  const userId = await getUserFromSession();
  ensureAuth(userId);
  const id = assertUuid(paintingId, "Painting ID");

  await withTransaction(async (client) => {
    const { rowCount } = await client.sql`
      SELECT 1
      FROM paintings
      WHERE id = ${id}
        AND user_id = ${userId}
      FOR UPDATE;
    `;
    if (!rowCount) {
      throw new Error("Painting not found.");
    }
    await client.sql`
      DELETE FROM prints
      WHERE painting_id = ${id};
    `;
    await client.sql`
      DELETE FROM paintings
      WHERE id = ${id}
        AND user_id = ${userId};
    `;
  });

  revalidatePath("/");
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
  const printId = assertUuid(params.printId, "Print ID");
  const locationId = assertUuid(params.locationId, "Location ID");
  await assertPrintOwner(printId, userId);

  const addQuantity = parseNonNegativeInteger(params.addQuantity ?? 0, "Add quantity");
  const removeQuantity = parseNonNegativeInteger(
    params.removeQuantity ?? 0,
    "Remove quantity",
  );
  if ((!addQuantity || addQuantity <= 0) && (!removeQuantity || removeQuantity <= 0)) {
    throw new Error("Specify a quantity to add or remove.");
  }
  const delta = addQuantity > 0 ? addQuantity : removeQuantity > 0 ? -removeQuantity : 0;
  const reason = assertInventoryReason(params.reason, "manual_adjust");
  const {
    totalQuantity,
    locationQuantity,
    locationId: adjustedLocationId,
  } = await adjustPrintStock({
    printId,
    delta,
    reason,
    orderId: null,
    locationId,
  });

  revalidatePath("/app/dashboard/gallery");
  revalidatePath("/app/dashboard/inventory");
  return { quantity: totalQuantity, locationQuantity, locationId: adjustedLocationId };
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

  const pricePaid = parsePositiveMoney(params.pricePaid, "Price paid");
  const {
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
  const paintingId = assertUuid(params.paintingId, "Painting ID");

  const commissionPercent = parseCommission(params.commissionRate);

  return await withTransaction(async (client) => {
    const updatePainting = await client.sql`
      UPDATE paintings
      SET status = 'sold'
      WHERE id = ${paintingId}
        AND user_id = ${userId}
      RETURNING id;
    `;
    if (!updatePainting.rowCount) {
      throw new Error("Painting not found.");
    }

    const orderInsert = await client.sql`
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
        ${userId},
        'fulfilled',
        ${pricePaid},
        'cad',
        ${pricePaid},
        0,
        NULL,
        NULL,
        ${nullableText(customerEmail)},
        ${nullableText(customerFirstName)},
        ${nullableText(customerLastName)},
        ${nullableText(customerPhone)},
        ${nullableText(shipAddress1)},
        ${nullableText(shipAddress2)},
        ${nullableText(shipCity)},
        ${nullableText(shipProvince)},
        ${nullableText(shipPostal)},
        ${nullableText(shipCountry)}
      )
      RETURNING id;
    `;

    const orderId = orderInsert.rows[0]?.id as string;
    if (orderId) {
      await client.sql`
        UPDATE paintings
        SET sale_order_id = ${orderId}
        WHERE id = ${paintingId}
          AND user_id = ${userId};
      `;
    }

    if (commissionPercent !== null) {
      await client.sql`
        UPDATE paintings
        SET location_commission_rate = ${commissionPercent}
        WHERE id = ${paintingId}
          AND user_id = ${userId};
      `;
    }

    if (commissionPercent !== null && commissionPercent > 0) {
      const commissionAmount = Math.round((pricePaid * commissionPercent / 100) * 100) / 100;
      const expenseDate = new Date().toISOString().slice(0, 10);
      const locationResult = await client.sql`
        SELECT l.name AS location_name
        FROM paintings p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE p.id = ${paintingId}
          AND p.user_id = ${userId};
      `;
      const locationName = locationResult.rows[0]?.location_name as string | null;
      const expenseDetails = `${locationName ?? "Unknown location"} (${commissionPercent}%)`;
      await client.sql`
        INSERT INTO expenses (user_id, painting_id, amount, category, subcategory, details, date, hst)
        VALUES (${userId}, ${paintingId}, ${commissionAmount}, 'Advertising', 'Finder''s fees', ${expenseDetails}, ${expenseDate}, 0);
      `;
    }

    revalidatePath("/app/dashboard/gallery");
    revalidatePath("/app/dashboard/orders");
    return { orderId };
  });
}

export async function unsellPaintingAction(params: { paintingId: string; nextStatus: string; orderId?: string | null }) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const paintingId = assertUuid(params.paintingId, "Painting ID");
  const nextStatus = assertStatus(params.nextStatus);
  const orderId = params.orderId ? assertUuid(params.orderId, "Order ID") : null;

  return await withTransaction(async (client) => {
    const { rows } = await client.sql`
      SELECT sale_order_id
      FROM paintings
      WHERE id = ${paintingId}
        AND user_id = ${userId}
      FOR UPDATE;
    `;
    if (!rows.length) {
      throw new Error("Painting not found.");
    }
    const saleOrderId = rows[0]?.sale_order_id as string | null;
    const orderIdToDelete = orderId || saleOrderId;

    if (orderIdToDelete) {
      await client.sql`DELETE FROM order_items WHERE order_id = ${orderIdToDelete};`;
      await client.sql`
        DELETE FROM orders
        WHERE id = ${orderIdToDelete}
          AND (user_id = ${userId} OR user_id IS NULL);
      `;
    }

    await client.sql`
      DELETE FROM expenses
      WHERE painting_id = ${paintingId}
        AND user_id = ${userId}
        AND category = 'Advertising'
        AND subcategory = 'Finder''s fees';
    `;

    await client.sql`
      UPDATE paintings
      SET status = ${nextStatus}, sale_order_id = NULL
      WHERE id = ${paintingId}
        AND user_id = ${userId};
    `;

    revalidatePath("/app/dashboard/gallery");
    revalidatePath("/app/dashboard/orders");
    return { ok: true };
  });
}

export async function createPaintingAction(formData: FormData) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const title = cleanText(formData.get("title")?.toString(), "Title", true);
  const details = cleanText(formData.get("details")?.toString(), "Details");
  const medium = cleanText(formData.get("medium")?.toString(), "Medium", true);
  const sizeOriginalHeight = cleanText(
    formData.get("sizeOriginalHeight")?.toString(),
    "Original height",
    true,
  );
  const sizeOriginalWidth = cleanText(
    formData.get("sizeOriginalWidth")?.toString(),
    "Original width",
    true,
  );
  const priceOriginal = parseMoney(
    formData.get("priceOriginal")?.toString(),
    "Original price",
    true,
  );
  const printsAvailable = formData.get("printsAvailable")?.toString().toLowerCase() === "true";
  const locationId = formData.get("locationId")?.toString().trim()
    ? assertUuid(formData.get("locationId")?.toString(), "Location ID")
    : null;
  const status = assertStatus(
    formData.get("status")?.toString().trim() || "available for sale",
  );
  const printsRaw = formData.get("prints")?.toString() ?? "[]";
  const imageFile = formData.get("image");

  if (!(imageFile instanceof File)) {
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
  const validPrints = printsAvailable
    ? prints
        .map((print) => ({
          width: cleanText(print?.width, "Print width"),
          height: cleanText(print?.height, "Print height"),
          price: parseMoney(print?.price, "Print price"),
          quantity: parseNonNegativeInteger(print?.quantity ?? 0, "Print quantity"),
        }))
        .filter((print) => print.width && print.height && print.price !== null)
    : [];

  const blob = await put(`paintings/${crypto.randomUUID()}-${imageFile.name}`, imageFile, {
    access: "public",
    contentType: imageFile.type,
  });

  try {
    return await withTransaction(async (client) => {
      const insertedPainting = await client.sql`
        INSERT INTO paintings
          (user_id, title, image_url, details, medium, size_original, price_original, status, prints_available, location_id, gallery_sort_order)
        VALUES
          (
            ${userId},
            ${title},
            ${blob.url},
            ${details},
            ${medium},
            ${`${sizeOriginalWidth} x ${sizeOriginalHeight} in`},
            ${priceOriginal},
            ${status},
            ${printsAvailable},
            ${locationId},
            (
              SELECT COALESCE(MAX(gallery_sort_order), 0) + 1
              FROM paintings
              WHERE user_id = ${userId}
            )
          )
        RETURNING id;
      `;

      const paintingId = insertedPainting.rows[0].id as string;

      for (const print of validPrints) {
        await client.sql`
          INSERT INTO prints (painting_id, size, price, quantity)
          VALUES (${paintingId}, ${`${print.width} x ${print.height} in`}, ${print.price}, ${print.quantity});
        `;
      }

      revalidatePath("/app/dashboard/gallery");
      return { paintingId };
    });
  } catch (err) {
    try {
      await del(blob.url);
    } catch {}
    throw err;
  }
}
