import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

async function getUserFromSession() {
  const token = cookies().get("app_session")?.value;
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

export async function POST(request: Request) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const about = form.get("about")?.toString() ?? "";
    const file = form.get("profilePhoto");

    let photoUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      const blob = await put(
        `profiles/${crypto.randomUUID()}-${file.name}`,
        file,
        {
          access: "public",
          contentType: file.type,
        }
      );
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

    return NextResponse.json({ ok: true, photoUrl });
  } catch (error) {
    console.error("Profile update error", error);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
