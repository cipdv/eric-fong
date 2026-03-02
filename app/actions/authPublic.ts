"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

async function createSession(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()});
  `;
  return token;
}

type ExistingUserRow = {
  id: string;
  password_hash: string | null;
};

async function fetchExistingUser(email: string): Promise<ExistingUserRow | null> {
  const { rows } = await sql<ExistingUserRow>`
    SELECT id, password_hash
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1;
  `;
  return rows[0] ?? null;
}

export async function registerAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();
  const password = input.password;

  if (!firstName || !lastName || !email || !password) {
    throw new Error("All fields are required.");
  }

  const existing = await fetchExistingUser(email);
  if (existing) {
    throw new Error("Email already registered.");
  }

  const bcryptHash = await bcrypt.hash(password, 10);
  const inserted = await sql<{ id: string }>`
    INSERT INTO users (first_name, last_name, email, password_hash)
    VALUES (${firstName}, ${lastName}, LOWER(${email}), ${bcryptHash})
    RETURNING id;
  `;
  const userId = inserted.rows[0]?.id;

  if (!userId) {
    throw new Error("Could not create account.");
  }

  const token = await createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set("app_session", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

export async function loginAction(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email) throw new Error("Email is required.");
  if (!password) throw new Error("Password is required.");

  const user = await fetchExistingUser(email);
  const storedHash = user?.password_hash?.trim() || null;

  if (!user) {
    throw new Error("Invalid credentials.");
  }
  if (!storedHash) {
    throw new Error("Invalid credentials.");
  }

  let matches = false;
  try {
    matches = await bcrypt.compare(password, storedHash);
  } catch {
    matches = false;
  }
  if (!matches) {
    throw new Error("Invalid credentials.");
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set("app_session", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
