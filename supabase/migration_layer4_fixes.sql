-- ============================================================
-- Layer 4 & 5 fixes
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Fix tables schema (hook uses "name" + "capacity", schema only had "table_number") ──
ALTER TABLE tables ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 0;
-- Migrate existing rows: copy table_number → name
UPDATE tables SET name = table_number WHERE name IS NULL;

-- ── 2. RLS Policies ──────────────────────────────────────────────────────────
-- ingredients (has restaurant_id)
CREATE POLICY "Users manage ingredients"
  ON ingredients FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- food_items (no restaurant_id — linked via food_item_restaurants)
-- Allow any authenticated user to insert; restrict reads/deletes via join
CREATE POLICY "Authenticated users insert food_items"
  ON food_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users view and manage their food_items"
  ON food_items FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT fir.food_item_id
      FROM food_item_restaurants fir
      JOIN restaurants r ON r.id = fir.restaurant_id
      WHERE r.user_id = auth.uid()
    )
    OR id NOT IN (SELECT food_item_id FROM food_item_restaurants)
  );

CREATE POLICY "Users update their food_items"
  ON food_items FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users delete their food_items"
  ON food_items FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- customers
CREATE POLICY "Users manage customers"
  ON customers FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- orders
CREATE POLICY "Users manage orders"
  ON orders FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- transactions
CREATE POLICY "Users manage transactions"
  ON transactions FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- ── 3. Supabase Storage bucket for restaurant logos ──────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Public read logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users delete logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos');
