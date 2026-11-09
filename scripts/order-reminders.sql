-- Prevent overlapping cron invocations from sending the same daily reminder.
CREATE TABLE IF NOT EXISTS order_reminder_runs (
  run_date DATE PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'sent', 'empty', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
