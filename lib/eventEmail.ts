import type { EventType, SubEvent } from "@/lib/eventSchedule";

export type EmailListRecipient = {
  subscribed: boolean;
  first_name: string | null;
  email_address: string;
};

export type EventEmailDetails = {
  name: string;
  imageUrl?: string | null;
  eventType: EventType;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  address: string | null;
  details: string | null;
  subEvents: SubEvent[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "pm" : "am"}`;
}

function times(start: string | null, end: string | null) {
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  if (start) return formatTime(start);
  if (end) return `Ends at ${formatTime(end)}`;
  return null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

export function buildEventEmail(event: EventEmailDetails, firstName: string | null) {
  const name = firstName?.trim().replace(/[\r\n]+/g, " ");
  const type = event.eventType === "single_day" ? "Upcoming event" : "Upcoming exhibition";
  const dateLabel = event.endDate && event.endDate !== event.date
    ? `${formatDate(event.date)} – ${formatDate(event.endDate)}` : formatDate(event.date);
  const timeLabel = times(event.startTime, event.endTime);
  const lines = [
    ...(name ? [`Hi ${name},`, ""] : []),
    `${type}: ${event.name}`, "",
    `Date: ${dateLabel}`,
    ...(timeLabel ? [`Time: ${timeLabel}`] : []),
    ...(event.location ? [`Location: ${event.location}`] : []),
    ...(event.address ? [`Address: ${event.address}`] : []),
    ...(event.details ? ["", event.details] : []),
  ];
  if (event.subEvents.length) {
    lines.push("", "During this event:");
    for (const sub of [...event.subEvents].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time))) {
      const subTime = times(sub.start_time, sub.end_time);
      lines.push("", sub.title, `Date: ${formatDate(sub.event_date)}`);
      if (subTime) lines.push(`Time: ${subTime}`);
      if (sub.location) lines.push(`Location: ${sub.location}`);
      if (sub.details) lines.push(sub.details);
    }
  }
  let imageUrl: string | null = null;
  if (event.imageUrl?.trim()) {
    try {
      const url = new URL(event.imageUrl.trim(), "https://eric-fong.ca");
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) imageUrl = url.href;
    } catch {
      // An invalid optional image should not prevent the announcement from sending.
    }
  }
  const headingLength = name ? 4 : 2;
  const headingHtml = escapeHtml(lines.slice(0, headingLength).join("\n")).replace(/\n/g, "<br />");
  const imageHtml = imageUrl
    ? `<p style="margin:16px 0"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(event.name)}" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0" /></p>`
    : "";
  const detailsHtml = escapeHtml(lines.slice(headingLength).join("\n")).replace(/\n/g, "<br />");
  const bodyHtml = `${headingHtml}<br />${imageHtml}${detailsHtml}`;
  if (imageUrl) lines.push("", `Event image: ${imageUrl}`);
  lines.push("", "Visit eric-fong.ca for event information.", "", "Eric Fong");
  const text = lines.join("\n");
  return {
    subject: `${type}: ${event.name}`.replace(/[\r\n]+/g, " "),
    text,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#262626;max-width:640px">${bodyHtml}<br /><br />Visit <a href="https://eric-fong.ca">eric-fong.ca</a> for event information.<br /><br />Eric Fong</div>`,
  };
}

export async function deliverEventEmails(
  event: EventEmailDetails,
  recipients: EmailListRecipient[],
  send: (recipient: string, message: ReturnType<typeof buildEventEmail>) => Promise<boolean>,
) {
  let sent = 0;
  let failed = 0;
  const unique = [...new Map(recipients.filter((recipient) => recipient.subscribed === true)
    .map((recipient) => [recipient.email_address.trim().toLowerCase(), recipient])).values()];
  // Small batches keep SMTP concurrency bounded. Never expose other recipients.
  for (let offset = 0; offset < unique.length; offset += 3) {
    await Promise.all(unique.slice(offset, offset + 3).map(async (recipient) => {
      try {
        const email = recipient.email_address.trim();
        if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) {
          failed++;
          return;
        }
        const accepted = await send(email, buildEventEmail(event, recipient.first_name));
        if (accepted) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }));
  }
  return { total: unique.length, sent, failed };
}
