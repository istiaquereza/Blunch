-- Add availability_type and available_quantity to food_items
ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS availability_type text NOT NULL DEFAULT 'premade'
    CHECK (availability_type IN ('premade', 'quantity')),
  ADD COLUMN IF NOT EXISTS available_quantity integer NOT NULL DEFAULT 0;
