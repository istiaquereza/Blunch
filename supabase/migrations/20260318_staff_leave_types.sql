-- Drop old check constraint and add leave_date_end + new leave types
ALTER TABLE staff_leaves DROP CONSTRAINT IF EXISTS staff_leaves_leave_type_check;

ALTER TABLE staff_leaves
  ADD COLUMN IF NOT EXISTS leave_date_end date;

-- Migrate old type values → new ones
UPDATE staff_leaves SET leave_type = 'sick_leave'     WHERE leave_type = 'sick';
UPDATE staff_leaves SET leave_type = 'personal_leave' WHERE leave_type IN ('casual', 'annual', 'unpaid');

ALTER TABLE staff_leaves ALTER COLUMN leave_type SET DEFAULT 'sick_leave';

ALTER TABLE staff_leaves
  ADD CONSTRAINT staff_leaves_leave_type_check
  CHECK (leave_type IN ('sick_leave', 'personal_leave', 'paid_leave'));
