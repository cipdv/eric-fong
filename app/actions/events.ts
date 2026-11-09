"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { parseEventSchedule, type EventType, type SubEvent } from "@/lib/eventSchedule";
import { createMailer, getMailerConfig } from "@/lib/mailer";
import { deliverEventEmails, type EmailListRecipient } from "@/lib/eventEmail";

type AuthError = Error & { statusCode?: number };

type EventRecord = {
  id: string;
  event_date: string;
  end_date: string | null;
  event_type: EventType;
  add_to_cv: boolean;
  sub_events: SubEvent[];
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
      to_jsonb(events)->>'end_date' AS end_date,
      COALESCE(to_jsonb(events)->>'event_type',
        CASE WHEN to_jsonb(events)->>'end_date' IS NULL THEN 'single_day' ELSE 'exhibition' END) AS event_type,
      COALESCE(to_jsonb(events)->'sub_events', '[]'::jsonb) AS sub_events,
      COALESCE((to_jsonb(events)->>'add_to_cv')::boolean, FALSE) AS add_to_cv,
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
  const { date, endDate, eventType, subEvents, addToCv } = parseEventSchedule(formData);
  if (!name) throw new Error("Event name is required.");
  if (!date) throw new Error("Event date is required.");

  const sendToEmailList = formData.get("send_to_email_list") === "true";
  let recipients: EmailListRecipient[] = [];
  let mailer: ReturnType<typeof createMailer> = null;
  let fromAddress: string | undefined;
  if (sendToEmailList) {
    // Check prerequisites before creating anything, so setup errors are safe to retry.
    try {
      const result = await sql<EmailListRecipient>`
        SELECT first_name, email_address, subscribed
        FROM email_list
        WHERE subscribed IS TRUE
        ORDER BY created_at, id;
      `;
      recipients = result.rows;
    } catch {
      throw new Error("Could not load the email list. Check that it has been set up before sending an announcement.");
    }
    if (recipients.length) {
      fromAddress = getMailerConfig()?.user;
      mailer = createMailer();
      if (!mailer || !fromAddress) {
        throw new Error("Email sending is not configured. Configure the email account or uncheck Send to email list.");
      }
    }
  }

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
    WITH saved_event AS (
    INSERT INTO events (
      user_id,
      event_date,
      end_date,
      event_type,
      add_to_cv,
      sub_events,
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
      ${endDate},
      ${eventType},
      ${addToCv},
      ${JSON.stringify(subEvents)}::jsonb,
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
    RETURNING *
    ), synced_cv AS (
      INSERT INTO cv_entries (user_id, source_event_id, section, entry_date, title, venue, location, details)
      SELECT user_id, id,
        CASE WHEN event_type = 'group_exhibition' THEN 'Selected Group Exhibitions' ELSE 'Solo Exhibitions' END,
        event_date, name, location,
        NULLIF(CONCAT_WS(', ', NULLIF(city, ''), NULLIF(province, '')), ''), details
      FROM saved_event
      WHERE add_to_cv = TRUE AND event_type IN ('exhibition', 'group_exhibition')
      ON CONFLICT (source_event_id) DO UPDATE
      SET section = EXCLUDED.section,
          entry_date = EXCLUDED.entry_date,
          title = EXCLUDED.title,
          venue = EXCLUDED.venue,
          location = EXCLUDED.location,
          details = EXCLUDED.details
      WHERE cv_entries.user_id = EXCLUDED.user_id
      RETURNING id
    )
    SELECT id FROM saved_event;
  `;

  if (!insert.rowCount) {
    throw new Error("Could not create event.");
  }

  revalidatePath("/app/dashboard/events");
  revalidatePath("/app/dashboard/cv");
  revalidatePath("/cv");
  revalidatePath("/");
  // The event (and optional CV entry) is committed before any email is sent.
  const delivery = sendToEmailList ? await deliverEventEmails({
    name, eventType, date, endDate, subEvents, imageUrl,
    startTime: normalizeText(formData.get("start_time")?.toString()),
    endTime: normalizeText(formData.get("end_time")?.toString()),
    location: normalizeText(formData.get("location")?.toString()),
    address: [
      [formData.get("street_number"), formData.get("street_name")].filter(Boolean).join(" ").trim(),
      formData.get("city"), formData.get("province"), formData.get("postal_code"),
    ].filter(Boolean).join(", ") || null,
    details: normalizeText(formData.get("details")?.toString()),
  }, recipients, async (recipient, message) => {
    if (!mailer || !fromAddress) return false;
    const result = await mailer.sendMail({
      from: { name: "Eric Fong", address: fromAddress },
      to: { address: recipient, name: "" },
      ...message,
    });
    return result.accepted.length > 0;
  }) : null;
  return { id: insert.rows[0].id as string, delivery };
}

export async function updateEventAction(formData: FormData) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const id = formData.get("id")?.toString().trim();
  const name = formData.get("name")?.toString().trim();
  const { date, endDate, eventType, subEvents, addToCv } = parseEventSchedule(formData);
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
    WITH saved_event AS (
    UPDATE events
    SET event_date = ${date},
        end_date = ${endDate},
        event_type = ${eventType},
        add_to_cv = ${addToCv},
        sub_events = ${JSON.stringify(subEvents)}::jsonb,
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
    RETURNING *
    ), synced_cv AS (
      INSERT INTO cv_entries (user_id, source_event_id, section, entry_date, title, venue, location, details)
      SELECT user_id, id,
        CASE WHEN event_type = 'group_exhibition' THEN 'Selected Group Exhibitions' ELSE 'Solo Exhibitions' END,
        event_date, name, location,
        NULLIF(CONCAT_WS(', ', NULLIF(city, ''), NULLIF(province, '')), ''), details
      FROM saved_event
      WHERE add_to_cv = TRUE AND event_type IN ('exhibition', 'group_exhibition')
      ON CONFLICT (source_event_id) DO UPDATE
      SET section = EXCLUDED.section,
          entry_date = EXCLUDED.entry_date,
          title = EXCLUDED.title,
          venue = EXCLUDED.venue,
          location = EXCLUDED.location,
          details = EXCLUDED.details
      WHERE cv_entries.user_id = EXCLUDED.user_id
      RETURNING id
    )
    SELECT id FROM saved_event;
  `;

  if (!updated.rowCount) {
    throw new Error("Event not found.");
  }

  revalidatePath("/app/dashboard/events");
  revalidatePath("/app/dashboard/cv");
  revalidatePath("/cv");
  revalidatePath("/");
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
  revalidatePath("/app/dashboard/cv");
  revalidatePath("/cv");
  revalidatePath("/");
  return { ok: true };
}
