import nodemailer from "nodemailer";

type MailerConfig = {
  user: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  password?: string;
};

export function getMailerConfig(): MailerConfig | null {
  const user = process.env.CONTACT_EMAIL_TO;
  const password = process.env.CONTACT_EMAIL_PASSWORD;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!user) {
    return null;
  }
  if (password) {
    return { user, password };
  }
  if (clientId && clientSecret && refreshToken) {
    return { user, clientId, clientSecret, refreshToken };
  }
  return null;
}

export function createMailer() {
  const config = getMailerConfig();
  if (!config) return null;
  if (config.password) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: config.user,
      clientId: config.clientId ?? "",
      clientSecret: config.clientSecret ?? "",
      refreshToken: config.refreshToken ?? "",
    },
  });
}
