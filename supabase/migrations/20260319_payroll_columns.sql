-- Add payroll tracking columns to transactions
alter table transactions
  add column if not exists staff_id uuid references staff(id) on delete set null,
  add column if not exists payroll_month date;

-- Index for efficient payroll queries
create index if not exists idx_transactions_staff_id on transactions(staff_id);
create index if not exists idx_transactions_payroll_month on transactions(payroll_month);
