"use server";

import { sql } from "@vercel/postgres";
import { createMailer, getMailerConfig } from "@/lib/mailer";

export type RestockRequestState = {
  status: "idle" | "success" | "error";
  message?: string;
};

type PrintMeta = {
  id: string;
  title: string | null;
  size: string | null;
};

export async function requestRestockNotification(
  prevState: RestockRequestState,
  formData: FormData
): Promise<RestockRequestState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const email = (formData.get("email") ?? "").toString().trim();
  const phone = (formData.get("phone") ?? "").toString().trim();
  const message = (formData.get("message") ?? "").toString().trim();
  const printIds = formData
    .getAll("printIds")
    .map((value) => value.toString())
    .filter(Boolean);

  if (!name || !email || printIds.length === 0) {
    return {
      status: "error",
      message: "Name, email, and at least one print are required.",
    };
  }

  const toAddress = process.env.CONTACT_EMAIL_TO;
  const mailerConfig = getMailerConfig();

  if (!toAddress || !mailerConfig) {
    return {
      status: "error",
      message: "Email service is not configured.",
    };
  }

  const idsParam = printIds as unknown as string;
  const { rows: printRows } = await sql<PrintMeta>`
    SELECT prints.id, prints.size, paintings.title
    FROM prints
    LEFT JOIN paintings ON paintings.id = prints.painting_id
    WHERE prints.id = ANY(${idsParam}::uuid[]);
  `;

  if (!printRows.length) {
    return {
      status: "error",
      message: "Selected prints were not found.",
    };
  }

  await sql`BEGIN`;
  try {
    for (const printId of printIds) {
      await sql`
        INSERT INTO print_restock_requests (print_id, name, email, phone, message)
        VALUES (${printId}, ${name}, ${email}, ${phone || null}, ${message || null});
      `;
    }
    await sql`COMMIT`;
  } catch {
    try {
      await sql`ROLLBACK`;
    } catch {}
    return {
      status: "error",
      message: "Could not save your request. Please try again.",
    };
  }

  const lines = printRows.map((row) => {
    const size = row.size ? ` (${row.size})` : "";
    return `${row.title || "Print"}${size}`;
  });

  const transporter = createMailer();
  if (!transporter) {
    return {
      status: "error",
      message: "Email service is not configured.",
    };
  }

  await transporter.sendMail({
    from: toAddress,
    to: toAddress,
    replyTo: email,
    subject: "Restock request received",
    text: [
      "A visitor requested a restock notification.",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "N/A"}`,
      "",
      "Requested prints:",
      ...lines,
      "",
      message ? `Message:\n${message}` : "Message: (none)",
    ].join("\n"),
  });

  return {
    status: "success",
    message: "Thanks! We'll let you know when those prints are back in stock.",
  };
}
