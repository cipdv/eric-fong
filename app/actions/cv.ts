"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";

type AuthError = Error & { statusCode?: number };

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

export type CvEntry = {
  id: string;
  section: string;
  entry_date: string | null;
  title: string;
  venue: string | null;
  location: string | null;
  details: string | null;
};

export async function getCvEntries(userId: string): Promise<CvEntry[]> {
  const { rows } = await sql<CvEntry>`
    SELECT
      id,
      section,
      to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
      title,
      venue,
      location,
      details
    FROM cv_entries
    WHERE user_id = ${userId}
    ORDER BY
      section ASC,
      entry_date DESC NULLS LAST,
      title ASC;
  `;
  return rows.map((row) => ({
    id: String(row.id),
    section: row.section,
    entry_date: row.entry_date ?? null,
    title: row.title,
    venue: row.venue ?? null,
    location: row.location ?? null,
    details: row.details ?? null,
  }));
}

export async function createCvEntry(input: {
  section: string;
  entry_date?: string | null;
  title: string;
  venue?: string | null;
  location?: string | null;
  details?: string | null;
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const section = input.section.trim();
  const title = input.title.trim();
  if (!section || !title) {
    throw new Error("Section and title are required.");
  }

  const { rows } = await sql`
    INSERT INTO cv_entries (
      user_id,
      section,
      entry_date,
      title,
      venue,
      location,
      details
    )
    VALUES (
      ${userId},
      ${section},
      ${input.entry_date?.trim() || null},
      ${title},
      ${input.venue?.trim() || null},
      ${input.location?.trim() || null},
      ${input.details?.trim() || null}
    )
    RETURNING id;
  `;

  revalidatePath("/app/dashboard/cv");
  return { id: rows[0]?.id as string };
}

export async function updateCvEntry(input: {
  entryId: string;
  section: string;
  entry_date?: string | null;
  title: string;
  venue?: string | null;
  location?: string | null;
  details?: string | null;
}) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  const section = input.section.trim();
  const title = input.title.trim();
  if (!section || !title) {
    throw new Error("Section and title are required.");
  }

  const updated = await sql`
    UPDATE cv_entries
    SET section = ${section},
        entry_date = ${input.entry_date?.trim() || null},
        title = ${title},
        venue = ${input.venue?.trim() || null},
        location = ${input.location?.trim() || null},
        details = ${input.details?.trim() || null}
    WHERE id = ${input.entryId}
      AND user_id = ${userId}
    RETURNING id;
  `;

  if (!updated.rowCount) {
    throw new Error("CV entry not found.");
  }

  revalidatePath("/app/dashboard/cv");
  return { ok: true };
}

export async function deleteCvEntry(entryId: string) {
  const userId = await getUserFromSession();
  ensureAuth(userId);

  await sql`
    DELETE FROM cv_entries
    WHERE id = ${entryId}
      AND user_id = ${userId};
  `;

  revalidatePath("/app/dashboard/cv");
  return { ok: true };
}
