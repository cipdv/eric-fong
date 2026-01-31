"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

type AuthError = Error & { statusCode?: number };

type EventRecord = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  name: string;
  location: string | null;
  street_number: string | null;
  street_name: string | null;
  postal_code: string | null;
  province: string | null;
  city: string | null;
  details: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

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

function ensureAuth(userId?: string | null) {
  if (!userId) {
    const err = new Error("Unauthorized") as AuthError;
    err.statusCode = 401;
    throw err;
  }
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export async function getEventsAction(): Promise<EventRecord[]> {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const { rows } = await sql<EventRecord>`
    SELECT
      id,
      to_char(event_date, 'YYYY-MM-DD') AS event_date,
      to_char(start_time, 'HH24:MI') AS start_time,
      to_char(end_time, 'HH24:MI') AS end_time,
      name,
      location,
      street_number,
      street_name,
      postal_code,
      province,
      city,
      details,
      image_url,
      to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
    FROM events
    WHERE user_id = ${userId}
    ORDER BY event_date ASC, start_time ASC NULLS LAST, created_at DESC;
  `;

  return rows.map((row) => ({
    ...row,
    start_time: row.start_time ? String(row.start_time) : null,
    end_time: row.end_time ? String(row.end_time) : null,
    event_date: String(row.event_date),
    name: String(row.name),
    location: row.location ? String(row.location) : null,
    street_number: row.street_number ? String(row.street_number) : null,
    street_name: row.street_name ? String(row.street_name) : null,
    postal_code: row.postal_code ? String(row.postal_code) : null,
    province: row.province ? String(row.province) : null,
    city: row.city ? String(row.city) : null,
    details: row.details ? String(row.details) : null,
    image_url: row.image_url ? String(row.image_url) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function createEventAction(formData: FormData) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const name = formData.get("name")?.toString().trim();
  const date = formData.get("event_date")?.toString().trim();
  if (!name) throw new Error("Event name is required.");
  if (!date) throw new Error("Event date is required.");

  const imageUrlInput = formData.get("image_url")?.toString().trim() || "";
  const imageFile = formData.get("image_file");
  let imageUrl: string | null =
    imageUrlInput.length > 0 ? imageUrlInput : null;

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await put(
      `events/${crypto.randomUUID()}-${imageFile.name}`,
      imageFile,
      {
        access: "public",
        contentType: imageFile.type || undefined,
      }
    );
    imageUrl = uploaded.url;
  }

  const insert = await sql<EventRecord>`
    INSERT INTO events (
      user_id,
      event_date,
      start_time,
      end_time,
      name,
      location,
      street_number,
      street_name,
      postal_code,
      province,
      city,
      details,
      image_url
    )
    VALUES (
      ${userId},
      ${date},
      ${formData.get("start_time")?.toString().trim() || null},
      ${formData.get("end_time")?.toString().trim() || null},
      ${name},
      ${normalizeText(formData.get("location")?.toString() || null)},
      ${normalizeText(formData.get("street_number")?.toString() || null)},
      ${normalizeText(formData.get("street_name")?.toString() || null)},
      ${normalizeText(formData.get("postal_code")?.toString() || null)},
      ${normalizeText(formData.get("province")?.toString() || null)},
      ${normalizeText(formData.get("city")?.toString() || null)},
      ${normalizeText(formData.get("details")?.toString() || null)},
      ${imageUrl}
    )
    RETURNING id;
  `;

  if (!insert.rowCount) {
    throw new Error("Could not create event.");
  }

  revalidatePath("/app/dashboard/events");
  return { id: insert.rows[0].id as string };
}

export async function updateEventAction(formData: FormData) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const id = formData.get("id")?.toString().trim();
  const name = formData.get("name")?.toString().trim();
  const date = formData.get("event_date")?.toString().trim();
  if (!id) throw new Error("Event id is required.");
  if (!name) throw new Error("Event name is required.");
  if (!date) throw new Error("Event date is required.");

  const imageUrlInput = formData.get("image_url")?.toString().trim() || "";
  const imageFile = formData.get("image_file");
  let imageUrl: string | null =
    imageUrlInput.length > 0 ? imageUrlInput : null;

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await put(
      `events/${crypto.randomUUID()}-${imageFile.name}`,
      imageFile,
      {
        access: "public",
        contentType: imageFile.type || undefined,
      }
    );
    imageUrl = uploaded.url;
  }

  const updated = await sql`
    UPDATE events
    SET event_date = ${date},
        start_time = ${formData.get("start_time")?.toString().trim() || null},
        end_time = ${formData.get("end_time")?.toString().trim() || null},
        name = ${name},
        location = ${normalizeText(formData.get("location")?.toString() || null)},
        street_number = ${normalizeText(
          formData.get("street_number")?.toString() || null
        )},
        street_name = ${normalizeText(formData.get("street_name")?.toString() || null)},
        postal_code = ${normalizeText(formData.get("postal_code")?.toString() || null)},
        province = ${normalizeText(formData.get("province")?.toString() || null)},
        city = ${normalizeText(formData.get("city")?.toString() || null)},
        details = ${normalizeText(formData.get("details")?.toString() || null)},
        image_url = ${imageUrl},
        updated_at = NOW()
    WHERE id = ${id}
      AND user_id = ${userId}
    RETURNING id;
  `;

  if (!updated.rowCount) {
    throw new Error("Event not found.");
  }

  revalidatePath("/app/dashboard/events");
  return { ok: true };
}

export async function deleteEventAction(id: string) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const deleted = await sql`
    DELETE FROM events
    WHERE id = ${id}
      AND user_id = ${userId}
    RETURNING id;
  `;

  if (!deleted.rowCount) {
    throw new Error("Event not found.");
  }

  revalidatePath("/app/dashboard/events");
  return { ok: true };
}
