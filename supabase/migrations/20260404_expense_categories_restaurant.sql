-- Add restaurant_id to expense_categories so categories are scoped per restaurant
ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- Existing rows keep restaurant_id = NULL (they remain global/legacy)
-- New categories will always have a restaurant_id set

-- Update RLS: allow access when user owns the row OR the restaurant belongs to the user
DROP POLICY IF EXISTS "Users can manage their own categories" ON expense_categories;

CREATE POLICY "expense_categories_access"
  ON expense_categories FOR ALL
  USING (
    user_id = auth.uid()
    OR restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );
