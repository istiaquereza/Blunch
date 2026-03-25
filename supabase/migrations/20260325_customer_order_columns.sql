-- Add columns needed for customer (QR) order flow
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Index for fast lookup of customer orders
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
