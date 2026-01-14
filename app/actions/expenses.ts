"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";

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

export async function createExpenseAction(input: {
  amount: string;
  category: string;
  subcategory?: string;
  details?: string;
  date: string;
  hstIncluded: boolean;
}) {
  const userId = await getUserFromSession();
  if (!userId) throw new Error("Unauthorized");

  const amountNumber = Number(input.amount);
  if (!input.amount || Number.isNaN(amountNumber) || !input.category || !input.date) {
    throw new Error("Missing required fields.");
  }

  if (input.category === "Home office expenses" && !input.subcategory) {
    throw new Error("Home office type is required.");
  }

  const hstValue =
    Math.round(
      (input.hstIncluded ? amountNumber * (13 / 113) : amountNumber * 0.13) * 100
    ) / 100;

  const subcategoryValue = input.subcategory || null;

  const detailsValue = input.details?.trim() || null;

  await sql`
    INSERT INTO expenses (user_id, amount, category, subcategory, details, date, hst)
    VALUES (${userId}, ${amountNumber}, ${input.category}, ${subcategoryValue}, ${detailsValue}, ${input.date}, ${hstValue});
  `;

  revalidatePath("/app/dashboard/finances");
  return { ok: true };
}
