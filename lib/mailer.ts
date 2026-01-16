import nodemailer from "nodemailer";

type MailerConfig = {
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export function getMailerConfig(): MailerConfig | null {
  const user = process.env.CONTACT_EMAIL_TO;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!user || !clientId || !clientSecret || !refreshToken) {
    return null;
  }
  return { user, clientId, clientSecret, refreshToken };
}

export function createMailer() {
  const config = getMailerConfig();
  if (!config) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: config.user,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
    },
  });
}
