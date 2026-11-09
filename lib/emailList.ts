export type EmailContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_address: string;
  phone_number: string | null;
  address: string | null;
  subscribed: boolean;
  created_at: string;
};

export type ContactInput = {
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number: string;
  address: string;
  subscribed: boolean;
};

export function validateContact(input: ContactInput) {
  const optional = (value: unknown, label: string, max: number) => {
    if (typeof value !== "string") throw new Error(`${label} must be text.`);
    const text = value.trim();
    if (text.length > max) throw new Error(`${label} is too long.`);
    return text || null;
  };
  const email = typeof input.email_address === "string" ? input.email_address.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (typeof input.subscribed !== "boolean") throw new Error("Choose a subscription status.");
  return {
    email_address: email,
    first_name: optional(input.first_name, "First name", 200),
    last_name: optional(input.last_name, "Last name", 200),
    phone_number: optional(input.phone_number, "Phone number", 100),
    address: optional(input.address, "Address", 2000),
    subscribed: input.subscribed,
  };
}

export function validateListMessage(subjectInput: string, bodyInput: string) {
  const subject = typeof subjectInput === "string" ? subjectInput.trim() : "";
  const body = typeof bodyInput === "string" ? bodyInput.trim() : "";
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) throw new Error("Enter a subject of 1–200 characters on one line.");
  if (!body || body.length > 20000) throw new Error("Enter a message of 1–20,000 characters.");
  return { subject, body };
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function buildListEmail(subject: string, body: string, firstName: string | null) {
  const name = firstName?.trim().replace(/[\r\n]+/g, " ");
  const text = `${name ? `Hi ${name},\n\n` : ""}${body}`;
  return {
    subject, text,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#262626;max-width:640px">${escapeHtml(text).replace(/\r?\n/g, "<br />")}</div>`,
  };
}

export async function deliverListEmail(
  recipients: Pick<EmailContact, "first_name" | "email_address" | "subscribed">[],
  subject: string,
  body: string,
  send: (email: string, message: ReturnType<typeof buildListEmail>) => Promise<boolean>,
) {
  const unique = [...new Map(recipients.filter((recipient) => recipient.subscribed === true)
    .map((recipient) => [recipient.email_address.trim().toLowerCase(), recipient])).values()];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < unique.length; i += 3) {
    await Promise.all(unique.slice(i, i + 3).map(async (recipient) => {
      try {
        const email = recipient.email_address.trim();
        if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) { failed++; return; }
        if (await send(email, buildListEmail(subject, body, recipient.first_name))) sent++;
        else failed++;
      } catch { failed++; }
    }));
  }
  return { total: unique.length, sent, failed };
}
