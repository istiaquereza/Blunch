-- ============================================================
-- Super Admin RLS Fix
-- Allows super_admin users to access all restaurants and all
-- restaurant data across all tenants.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. Helper: check if current user has super_admin role ────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_user_roles
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
      AND role = 'super_admin'
      AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 2. Update user_has_restaurant_access to bypass for super_admin ──
CREATE OR REPLACE FUNCTION user_has_restaurant_access(rid uuid)
RETURNS boolean AS $$
  SELECT
    -- Super admin: full access to all restaurants
    is_super_admin()
    OR
    -- Restaurant owner (original creator)
    EXISTS (SELECT 1 FROM restaurants WHERE id = rid AND user_id = auth.uid())
    OR
    -- Active role member for this specific restaurant
    EXISTS (
      SELECT 1 FROM app_user_roles
      WHERE restaurant_id = rid
        AND lower(email) = lower(auth.jwt() ->> 'email')
        AND is_active = true
    )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 3. Fix restaurants table RLS ──────────────────────────────
-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can manage their restaurants" ON restaurants;

-- New policy: super_admin sees all, owners manage their own
CREATE POLICY "Users can manage their restaurants"
  ON restaurants FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM app_user_roles
      WHERE restaurant_id = restaurants.id
        AND lower(email) = lower(auth.jwt() ->> 'email')
        AND is_active = true
    )
  )
  WITH CHECK (
    is_super_admin()
    OR auth.uid() = user_id
  );

-- ── 4. Add siiisiiir@gmail.com as super_admin ─────────────────
-- Inserts a super_admin entry tied to the first restaurant in the
-- system (satisfies FK constraint). is_super_admin() checks across
-- all restaurants so this grants platform-wide access.
INSERT INTO app_user_roles (restaurant_id, email, name, role, is_active)
SELECT r.id, 'siiisiiir@gmail.com', 'Super Admin', 'super_admin', true
FROM restaurants r
ORDER BY r.created_at
LIMIT 1
ON CONFLICT (restaurant_id, email) DO UPDATE
  SET role = 'super_admin', is_active = true;

SELECT 'Super admin RLS policies applied successfully.' AS status;
