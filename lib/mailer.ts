import nodemailer from "nodemailer";

type MailerConfig = {
  user: string;
  password: string;
};

export function getMailerConfig(): MailerConfig | null {
  const user = process.env.CONTACT_EMAIL_TO;
  const password = process.env.CONTACT_EMAIL_PASSWORD;
  if (!user || !password) {
    return null;
  }
  return { user, password };
}

export function createMailer() {
  const config = getMailerConfig();
  if (!config) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}
