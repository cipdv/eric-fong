-- Add unique constraint to prevent duplicate orders per Stripe PaymentIntent
ALTER TABLE orders
ADD CONSTRAINT IF NOT EXISTS unique_stripe_payment_intent_id
UNIQUE (stripe_payment_intent_id);

-- Add checkout session id for reliable lookup from success page polling
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_uidx
ON orders(stripe_checkout_session_id);

-- Locations for originals and prints
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Current location for each original painting
ALTER TABLE IF EXISTS paintings
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

CREATE INDEX IF NOT EXISTS idx_paintings_location ON paintings(location_id);

-- Gallery ordering
ALTER TABLE IF EXISTS paintings
ADD COLUMN IF NOT EXISTS gallery_sort_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_paintings_gallery_sort ON paintings(user_id, gallery_sort_order);

WITH ordered_paintings AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC NULLS LAST, title ASC) AS sort_order
  FROM paintings
)
UPDATE paintings p
SET gallery_sort_order = ordered_paintings.sort_order
FROM ordered_paintings
WHERE p.id = ordered_paintings.id
  AND p.gallery_sort_order IS NULL;

-- Per-location stock for each print
CREATE TABLE IF NOT EXISTS print_location_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_id UUID NOT NULL REFERENCES prints(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE (print_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_print_location_stock_print ON print_location_stock(print_id);
CREATE INDEX IF NOT EXISTS idx_print_location_stock_location ON print_location_stock(location_id);

-- Optional history of inventory transfers between locations
CREATE TABLE IF NOT EXISTS print_location_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_id UUID NOT NULL REFERENCES prints(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default catch-all location and backfill existing print quantities
INSERT INTO locations (name, notes)
VALUES ('Unassigned', 'Default location for existing inventory')
ON CONFLICT (name) DO NOTHING;

INSERT INTO print_location_stock (print_id, location_id, quantity)
SELECT id, (SELECT id FROM locations WHERE name = 'Unassigned' LIMIT 1), quantity
FROM prints
ON CONFLICT (print_id, location_id) DO NOTHING;
