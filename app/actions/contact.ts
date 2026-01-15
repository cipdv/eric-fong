"use server";

import nodemailer from "nodemailer";

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
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!toAddress || !host || !user || !pass) {
    return {
      status: "error",
      message: "Email service is not configured.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

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
      message: "Message sent. We'll be in touch soon.",
    };
  } catch (error) {
    console.error("[sendContactMessage] Failed to send message", error);
    return {
      status: "error",
      message: "Could not send your message. Please try again later.",
    };
  }
}
