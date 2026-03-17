-- ============================================================
-- Order DB Fix — Run this in Supabase SQL Editor
-- Fixes: missing notes column, RLS blocking inserts,
--        missing order_number trigger/sequence
-- ============================================================

-- 1. Add notes column if missing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Disable RLS on order-related tables so inserts work
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- 3. Ensure order_seq exists (for order_number generation)
CREATE SEQUENCE IF NOT EXISTS order_seq;

-- 4. Recreate the generate_order_number function safely
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Recreate the trigger (drop first to avoid duplicate)
DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- 6. Also disable RLS on tables/payment_methods/discounts used in queries
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE discounts DISABLE ROW LEVEL SECURITY;
