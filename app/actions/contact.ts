"use server";

import { createMailer, getMailerConfig } from "@/lib/mailer";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { validateContact } from "@/lib/emailList";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function sendContactMessage(
  prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const email = (formData.get("email") ?? "").toString().trim();
  const phone = (formData.get("phone") ?? "").toString().trim();
  const message = (formData.get("message") ?? "").toString().trim();
  const subscribe = formData.get("newsletter") === "on";

  if (!name || !email || !message) {
    return {
      status: "error",
      message: "Please provide your name, email, and a message.",
    };
  }

  let contact: ReturnType<typeof validateContact> | undefined;
  if (subscribe) {
    const [firstName, ...lastName] = name.split(/\s+/);
    try {
      contact = validateContact({
        first_name: firstName,
        last_name: lastName.join(" "),
        email_address: email,
        phone_number: phone,
        address: "",
        subscribed: true,
      });
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Please check your contact details.",
      };
    }
  }

  const toAddress = process.env.CONTACT_EMAIL_TO;
  const mailerConfig = getMailerConfig();

  if (!toAddress || !mailerConfig) {
    return {
      status: "error",
      message: "Email service is not configured.",
    };
  }

  try {
    const transporter = createMailer();
    if (!transporter) {
      return {
        status: "error",
        message: "Email service is not configured.",
      };
    }

    if (contact) {
      await sql`
        INSERT INTO email_list (first_name, last_name, email_address, phone_number, subscribed)
        VALUES (${contact.first_name}, ${contact.last_name}, ${contact.email_address}, ${contact.phone_number}, TRUE)
        ON CONFLICT (LOWER(email_address)) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone_number = EXCLUDED.phone_number,
          subscribed = TRUE;
      `;
      revalidatePath("/app/dashboard/email-list");
    }

    await transporter.sendMail({
      from: toAddress,
      to: toAddress,
      replyTo: email,
      subject: `New contact from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || "N/A"}`,
        "",
        message,
      ].join("\n"),
    });

    return {
      status: "success",
      message: "Message sent. I'll be in touch soon.",
    };
  } catch (error) {
    console.error("[sendContactMessage] Failed to send message", error);
    return {
      status: "error",
      message: "Could not send your message. Please try again later.",
    };
  }
}
