import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";

export async function POST() {
  const cookieStore = cookies();
  const token = cookieStore.get("app_session")?.value;

  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token};`;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("app_session", "", { path: "/", maxAge: 0 });
  return res;
}
