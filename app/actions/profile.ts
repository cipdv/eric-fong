"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
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

export async function updateProfileAction(formData: FormData) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  const about = formData.get("about")?.toString() ?? "";
  const file = formData.get("profilePhoto");

  let photoUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const blob = await put(`profiles/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
      contentType: file.type,
    });
    photoUrl = blob.url;
  }

  if (photoUrl) {
    await sql`
      UPDATE users
      SET about = ${about}, profile_photo = ${photoUrl}
      WHERE id = ${userId}
    `;
  } else {
    await sql`
      UPDATE users
      SET about = ${about}
      WHERE id = ${userId}
    `;
  }

  revalidatePath("/app/dashboard/profile");
  return { ok: true, photoUrl };
}
