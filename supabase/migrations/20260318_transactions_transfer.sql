-- Allow 'transfer' as a transaction type and add to_payment_method_id
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'transfer'));

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_payment_method_id uuid REFERENCES payment_methods(id);
