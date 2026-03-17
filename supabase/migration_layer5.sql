-- ============================================================
-- Migration Layer 5 — Run in Supabase SQL Editor
-- ============================================================

-- 1. food_items: add availability_type + available_quantity
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS availability_type text
  CHECK (availability_type IN ('premade', 'quantity')) DEFAULT 'premade';
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS available_quantity integer DEFAULT 0;

-- 2. tables: add name + capacity columns (hook uses these)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 0;
-- Backfill name from table_number for existing rows
UPDATE tables SET name = table_number WHERE name IS NULL;

-- 3. product_requisitions: add restaurant_id if missing (should exist already)
-- Already has restaurant_id from schema

-- 4. RLS policies for all tables (comprehensive)

-- ingredients
DROP POLICY IF EXISTS "Users can manage ingredients" ON ingredients;
CREATE POLICY "Users can manage ingredients" ON ingredients FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- food_items (no direct restaurant link — via food_item_restaurants)
ALTER TABLE food_items DISABLE ROW LEVEL SECURITY;

-- food_item_restaurants
ALTER TABLE food_item_restaurants DISABLE ROW LEVEL SECURITY;

-- food_categories
ALTER TABLE food_categories DISABLE ROW LEVEL SECURITY;

-- food_item_ingredients, addons, options
ALTER TABLE food_item_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE food_item_addons DISABLE ROW LEVEL SECURITY;
ALTER TABLE food_item_option_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE food_item_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_logs DISABLE ROW LEVEL SECURITY;

-- inventory
ALTER TABLE inventory_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE food_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_checkins DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_requisitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_requisition_items DISABLE ROW LEVEL SECURITY;

-- transactions
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- orders
DROP POLICY IF EXISTS "Users can manage customers" ON customers;
CREATE POLICY "Users can manage customers" ON customers FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- settings
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE discounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE print_settings DISABLE ROW LEVEL SECURITY;

-- restaurant_social_links
ALTER TABLE restaurant_social_links DISABLE ROW LEVEL SECURITY;

-- 5. Supabase Storage: food-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-images', 'asset-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public food images" ON storage.objects;
CREATE POLICY "Public food images" ON storage.objects FOR SELECT
  USING (bucket_id = 'food-images');

DROP POLICY IF EXISTS "Auth upload food images" ON storage.objects;
CREATE POLICY "Auth upload food images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'food-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public asset images" ON storage.objects;
CREATE POLICY "Public asset images" ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-images');

DROP POLICY IF EXISTS "Auth upload asset images" ON storage.objects;
CREATE POLICY "Auth upload asset images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'asset-images' AND auth.role() = 'authenticated');
