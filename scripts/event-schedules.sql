-- Run before deploying the event date ranges and sub-events.
-- Existing event_date values remain the start dates; existing events are single-day.
BEGIN;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS sub_events JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_end_date_check' AND conrelid = 'events'::regclass) THEN
    ALTER TABLE events ADD CONSTRAINT events_end_date_check
      CHECK (end_date IS NULL OR end_date >= event_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_sub_events_array_check' AND conrelid = 'events'::regclass) THEN
    ALTER TABLE events ADD CONSTRAINT events_sub_events_array_check
      CHECK (jsonb_typeof(sub_events) = 'array');
  END IF;
END $$;
COMMIT;
