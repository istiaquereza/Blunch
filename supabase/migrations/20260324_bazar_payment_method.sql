-- Add payment_method_id to product_requisitions
-- Tracks how the bazar purchase was/will be paid
ALTER TABLE product_requisitions
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;
