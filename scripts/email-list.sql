CREATE TABLE IF NOT EXISTS email_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email_address TEXT NOT NULL,
  phone_number TEXT,
  address TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_list_email_address_check CHECK (
    email_address = BTRIM(email_address)
    AND email_address ~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$'
  )
);

-- Also upgrade an email_list table created with the earlier script.
ALTER TABLE email_list
  ADD COLUMN IF NOT EXISTS subscribed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS email_list_email_address_uidx
  ON email_list (LOWER(email_address));
