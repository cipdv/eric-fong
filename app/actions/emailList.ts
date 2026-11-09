"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { createMailer, getMailerConfig } from "@/lib/mailer";
import { deliverListEmail, validateContact, validateListMessage, type ContactInput, type EmailContact } from "@/lib/emailList";

async function requireSession() {
  const token = (await cookies()).get("app_session")?.value;
  if (!token) throw new Error("Please sign in to manage the email list.");
  const { rows } = await sql`
    SELECT users.id FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token} AND sessions.expires_at > NOW() LIMIT 1;
  `;
  if (!rows[0]) throw new Error("Please sign in to manage the email list.");
}

function validateId(id: string) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid contact ID.");
  }
}

function saveError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new Error("This email address is already on the list.");
  }
  throw error;
}

export async function getEmailContacts(): Promise<EmailContact[]> {
  await requireSession();
  const { rows } = await sql<EmailContact>`
    SELECT id, first_name, last_name, email_address, phone_number, address, subscribed,
      created_at::text
    FROM email_list ORDER BY LOWER(email_address), id;
  `;
  return rows;
}

export async function createEmailContact(input: ContactInput): Promise<EmailContact> {
  await requireSession();
  const contact = validateContact(input);
  try {
    const { rows } = await sql<EmailContact>`
      INSERT INTO email_list (first_name, last_name, email_address, phone_number, address, subscribed)
      VALUES (${contact.first_name}, ${contact.last_name}, ${contact.email_address}, ${contact.phone_number}, ${contact.address}, ${contact.subscribed})
      RETURNING id, first_name, last_name, email_address, phone_number, address, subscribed, created_at::text;
    `;
    revalidatePath("/app/dashboard/email-list");
    return rows[0];
  } catch (error) { return saveError(error); }
}

export async function updateEmailContact(id: string, input: ContactInput): Promise<EmailContact> {
  await requireSession();
  validateId(id);
  const contact = validateContact(input);
  try {
    const { rows } = await sql<EmailContact>`
      UPDATE email_list SET first_name = ${contact.first_name}, last_name = ${contact.last_name},
        email_address = ${contact.email_address}, phone_number = ${contact.phone_number},
        address = ${contact.address}, subscribed = ${contact.subscribed}
      WHERE id = ${id}
      RETURNING id, first_name, last_name, email_address, phone_number, address, subscribed, created_at::text;
    `;
    if (!rows[0]) throw new Error("Contact not found. Refresh the page and try again.");
    revalidatePath("/app/dashboard/email-list");
    return rows[0];
  } catch (error) { return saveError(error); }
}

export async function deleteEmailContact(id: string) {
  await requireSession();
  validateId(id);
  await sql`DELETE FROM email_list WHERE id = ${id};`;
  revalidatePath("/app/dashboard/email-list");
  return { ok: true };
}

export async function sendEmailToList(input: { subject: string; body: string }) {
  await requireSession();
  const { subject, body } = validateListMessage(input.subject, input.body);
  const { rows } = await sql<EmailContact>`
    SELECT first_name, email_address, subscribed FROM email_list
    WHERE subscribed IS TRUE ORDER BY created_at, id;
  `;
  if (!rows.length) return { total: 0, sent: 0, failed: 0 };
  const config = getMailerConfig();
  const mailer = createMailer();
  if (!config || !mailer) throw new Error("Email sending is not configured.");
  return deliverListEmail(rows, subject, body, async (email, message) => {
    const result = await mailer.sendMail({
      from: { name: "Eric Fong", address: config.user },
      to: { name: "", address: email },
      ...message,
    });
    return result.accepted.length > 0;
  });
}
