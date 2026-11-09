-- Run before deploying event type selection. Safe to run again.
BEGIN;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS sub_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Preserve existing exhibitions, including those with matching start/end dates.
UPDATE events
SET event_type = CASE WHEN end_date IS NULL THEN 'single_day' ELSE 'exhibition' END
WHERE event_type IS NULL;

ALTER TABLE events
  ALTER COLUMN event_type SET DEFAULT 'single_day',
  ALTER COLUMN event_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_type_dates_check' AND conrelid = 'events'::regclass) THEN
    ALTER TABLE events ADD CONSTRAINT events_type_dates_check CHECK (
      (event_type = 'single_day' AND end_date IS NULL)
      OR (event_type = 'exhibition' AND end_date IS NOT NULL AND end_date >= event_date)
    );
  END IF;
END $$;
COMMIT;
