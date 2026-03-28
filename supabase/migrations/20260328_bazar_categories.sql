-- Create bazar_categories table for organizing bazar requisitions
CREATE TABLE IF NOT EXISTS bazar_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE bazar_categories ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage categories for their restaurants
CREATE POLICY "bazar_categories_restaurant_access"
  ON bazar_categories FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Add bazar_category_id FK to product_requisitions
ALTER TABLE product_requisitions
  ADD COLUMN IF NOT EXISTS bazar_category_id UUID REFERENCES bazar_categories(id) ON DELETE SET NULL;
