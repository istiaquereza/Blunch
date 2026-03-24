-- ============================================================
-- Role-Based RLS Fix
-- Allows app_user_roles members (manager/cashier/viewer) to
-- access their assigned restaurant's data.
-- Run in Supabase SQL Editor after creating app_user_roles table.
-- ============================================================

-- Helper: reusable access check function
-- Returns true if the current user is the restaurant owner
-- OR has an active role record in app_user_roles for that restaurant.
CREATE OR REPLACE FUNCTION user_has_restaurant_access(rid uuid)
RETURNS boolean AS $$
  SELECT
    EXISTS (SELECT 1 FROM restaurants WHERE id = rid AND user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM app_user_roles
      WHERE restaurant_id = rid
        AND email = (auth.jwt() ->> 'email')
        AND is_active = true
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── ingredients ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can manage ingredients" ON ingredients;
CREATE POLICY "Users manage ingredients" ON ingredients FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- ── customers ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage customers" ON customers;
DROP POLICY IF EXISTS "Users can manage customers" ON customers;
CREATE POLICY "Users manage customers" ON customers FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- ── benefit_packages ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own benefit_packages" ON benefit_packages;
CREATE POLICY "Users manage own benefit_packages" ON benefit_packages FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- ── staff ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own staff" ON staff;
CREATE POLICY "Users manage own staff" ON staff FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- ── staff_leaves ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own staff_leaves" ON staff_leaves;
CREATE POLICY "Users manage own staff_leaves" ON staff_leaves FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- ── food_stock_logs ──────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage their own stock logs" ON food_stock_logs;
CREATE POLICY "Users manage their own stock logs" ON food_stock_logs FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- Verify
SELECT 'Role-based RLS policies applied successfully.' AS status;
