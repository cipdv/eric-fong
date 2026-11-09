-- Run before deploying the two-image homepage and gallery editor.
ALTER TABLE paintings
ADD COLUMN IF NOT EXISTS is_home_image_second BOOLEAN NOT NULL DEFAULT FALSE;
