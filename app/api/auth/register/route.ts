import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export async function POST(request: Request) {
  const body = await request.json();
  const { firstName, lastName, email, password } = body ?? {};

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  const existing = await sql`
    SELECT id FROM users WHERE lower(email) = lower(${email}) LIMIT 1;
  `;
  if (existing.rowCount && existing.rows.length > 0) {
    return NextResponse.json(
      { error: "User with that email already exists." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await sql`
    INSERT INTO users (first_name, last_name, email, password_hash)
    VALUES (${firstName}, ${lastName}, ${email}, ${passwordHash})
    RETURNING id, first_name;
  `;

  const userId = inserted.rows[0].id as string;
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${sessionToken}, ${userId}, ${expiresAt.toISOString()});
  `;

  const response = NextResponse.json({ ok: true });
  response.cookies.set("app_session", sessionToken, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  return response;
}
