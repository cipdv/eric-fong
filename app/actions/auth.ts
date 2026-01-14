"use server";

import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;

  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token};`;
  }

  cookieStore.set("app_session", "", { path: "/", maxAge: 0 });
  revalidatePath("/");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
