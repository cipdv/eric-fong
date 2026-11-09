# Overdue order reminders

1. Run `scripts/order-reminders.sql` in the production database.
2. Set these Vercel production environment variables:
   - `CRON_SECRET`: a random secret protecting the scheduled endpoint.
   - `ORDER_ACTION_SECRET`: a separate random secret of at least 32 characters, used to sign fulfillment links.
   - `CONTACT_EMAIL_TO` and `CONTACT_EMAIL_PASSWORD`: the existing Gmail sender/recipient and app password.
   - `SITE_URL` (optional): the canonical public origin, default `https://eric-fong.ca`.
3. Deploy to production. `vercel.json` schedules `/api/cron/unfulfilled-orders` daily at 14:00 UTC (9 am Toronto in winter, 10 am in summer).

Generate each secret separately with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not commit secret values.

The cron checks paid orders strictly older than seven days and sends one digest to `CONTACT_EMAIL_TO`. No overdue orders means no email. It repeats daily until orders are fulfilled. Cancelled/refunded/non-paid orders are excluded. Database claims prevent concurrent or repeated invocations from sending another digest on the same Toronto calendar date. Failed runs can be retried through the Vercel cron dashboard; a process terminated during sending may leave a `running` row, which suppresses further sends that day. The next day's run proceeds normally. SMTP acceptance cannot guarantee inbox delivery.

Each email contains a signed, order-specific link that expires after seven days. Opening the link is read-only. The recipient explicitly confirms fulfillment on the page; submitting the confirmation validates the token again and updates `status` and `updated_at`. No login is needed for a valid link; treat it as private. Repeated confirmation is harmless. Fulfillment does not reduce inventory again, because checkout already reserves stock.

Tests use mocked email/database services and do not send live reminders. Activating production cron requires the migration, environment variables, and deployment above.

Reference: https://vercel.com/docs/cron-jobs/manage-cron-jobs
