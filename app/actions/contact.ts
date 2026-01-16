"use server";

import { createMailer, getMailerConfig } from "@/lib/mailer";

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

  if (!name || !email || !message) {
    return {
      status: "error",
      message: "Please provide your name, email, and a message.",
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

  try {
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
