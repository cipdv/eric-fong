import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const result = await sql`
    SELECT id, first_name, password_hash
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1;
  `;

  if (!result.rowCount) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash as string);
  if (!isMatch) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${sessionToken}, ${user.id}, ${expiresAt.toISOString()});
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
