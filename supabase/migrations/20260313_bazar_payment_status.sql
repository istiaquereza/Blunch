-- Add payment_status to product_requisitions
-- Tracks whether the bazar purchase was paid immediately or is due/outstanding
ALTER TABLE product_requisitions
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid'
  CHECK (payment_status IN ('paid', 'due'));

-- Add requisition_id to transactions for linking expenses back to their source requisition
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS requisition_id UUID REFERENCES product_requisitions(id) ON DELETE SET NULL;
