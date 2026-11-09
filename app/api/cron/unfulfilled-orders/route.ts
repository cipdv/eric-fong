import { timingSafeEqual } from "node:crypto";
import { sql } from "@vercel/postgres";
import { createMailer, getMailerConfig } from "@/lib/mailer";
import { buildOrderReminderEmail, type OverdueOrder } from "@/lib/orderReminderEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(auth) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actionSecret = process.env.ORDER_ACTION_SECRET;
  const mailConfig = getMailerConfig();
  const mailer = createMailer();
  if (!actionSecret || actionSecret.length < 32 || !mailConfig || !mailer) {
    return Response.json({ error: "Order reminder email or signing secret is not configured." }, { status: 503 });
  }
  let runDate: string | undefined;
  let accepted = false;
  try {
    const origin = new URL(process.env.SITE_URL || "https://eric-fong.ca");
    if (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost")) {
      throw new Error("Invalid site URL");
    }
    const claim = await sql<{ run_date: string }>`
      INSERT INTO order_reminder_runs (run_date, status)
      VALUES ((NOW() AT TIME ZONE 'America/Toronto')::date, 'running')
      ON CONFLICT (run_date) DO UPDATE SET status = 'running', started_at = NOW(), completed_at = NULL
        WHERE order_reminder_runs.status = 'failed'
      RETURNING run_date::text;
    `;
    runDate = claim.rows[0]?.run_date;
    if (!runDate) return Response.json({ skipped: true, reason: "Already processed or running today." });
    const { rows } = await sql<OverdueOrder>`
      SELECT o.id, o.created_at::text,
        NULLIF(CONCAT_WS(' ', o.customer_first_name, o.customer_last_name), '') AS customer_name,
        STRING_AGG(CONCAT(COALESCE(paintings.title, 'Print'), ' (', COALESCE(prints.size, ''), ') x', oi.quantity), E'\n')
          FILTER (WHERE oi.id IS NOT NULL) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN prints ON prints.id = oi.print_id
      LEFT JOIN paintings ON paintings.id = prints.painting_id
      WHERE o.status = 'paid' AND o.created_at < NOW() - INTERVAL '7 days'
      GROUP BY o.id
      ORDER BY o.created_at ASC, o.id;
    `;
    if (!rows.length) {
      await sql`UPDATE order_reminder_runs SET status = 'empty', completed_at = NOW() WHERE run_date = ${runDate};`;
      return Response.json({ sent: false, orders: 0 });
    }
    const email = buildOrderReminderEmail(rows, origin.origin, actionSecret);
    const result = await mailer.sendMail({ from: mailConfig.user, to: mailConfig.user, ...email });
    if (!result.accepted.length) throw new Error("Reminder email was not accepted");
    accepted = true;
    await sql`UPDATE order_reminder_runs SET status = 'sent', completed_at = NOW() WHERE run_date = ${runDate};`;
    return Response.json({ sent: true, orders: rows.length });
  } catch {
    // Do not permit a second send if SMTP accepted the message but recording it failed.
    if (runDate && !accepted) {
      try { await sql`UPDATE order_reminder_runs SET status = 'failed', completed_at = NOW() WHERE run_date = ${runDate};`; } catch {}
    }
    return Response.json({ error: "Order reminder failed. Check email configuration and the reminder database migration." }, { status: 500 });
  }
}
