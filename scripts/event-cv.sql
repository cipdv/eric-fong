-- Run after event-types.sql, before deploying exhibition-to-CV support.
BEGIN;
ALTER TABLE events ADD COLUMN IF NOT EXISTS add_to_cv BOOLEAN NOT NULL DEFAULT FALSE;

-- The existing 'exhibition' value now represents a solo exhibition.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_dates_check;
ALTER TABLE events ADD CONSTRAINT events_type_dates_check CHECK (
  (event_type = 'single_day' AND end_date IS NULL)
  OR (event_type IN ('exhibition', 'group_exhibition')
      AND end_date IS NOT NULL AND end_date >= event_date)
);

-- Keep CV history if its source event is deleted; one linked CV entry per event.
ALTER TABLE cv_entries ADD COLUMN IF NOT EXISTS source_event_id UUID
  REFERENCES events(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cv_entries_source_event_id_uidx
  ON cv_entries(source_event_id);
COMMIT;
