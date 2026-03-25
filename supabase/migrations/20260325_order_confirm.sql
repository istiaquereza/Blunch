-- Customer order confirmation fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'staff',           -- 'staff' | 'customer'
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER,             -- admin-set prep time in minutes
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;              -- when admin confirmed the order
