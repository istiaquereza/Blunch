-- Inventory history log: tracks every stock change and its cause
CREATE TABLE IF NOT EXISTS food_stock_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  order_number text,
  food_item_name text,
  quantity_change numeric(10,3) NOT NULL, -- negative = reduction, positive = addition
  reason text NOT NULL DEFAULT 'order_completion',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE food_stock_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own stock logs" ON food_stock_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = food_stock_logs.restaurant_id AND r.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_food_stock_logs_ingredient ON food_stock_logs(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_food_stock_logs_restaurant ON food_stock_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_food_stock_logs_created ON food_stock_logs(created_at DESC);
