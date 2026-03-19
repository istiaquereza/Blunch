-- ──────────────────────────────────────────────
-- Staff Management Tables
-- ──────────────────────────────────────────────

-- Benefit packages (reusable templates)
CREATE TABLE IF NOT EXISTS benefit_packages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  details         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{label,value}]
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE benefit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own benefit_packages" ON benefit_packages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = benefit_packages.restaurant_id AND r.user_id = auth.uid())
  );

-- Staff records
CREATE TABLE IF NOT EXISTS staff (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id       uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name                text NOT NULL,
  phone               text,
  address             text,
  photo_url           text,
  document_url        text,
  joining_date        date,
  food_category_ids   uuid[] NOT NULL DEFAULT '{}',
  benefit_package_id  uuid REFERENCES benefit_packages(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own staff" ON staff
  FOR ALL USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = staff.restaurant_id AND r.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON staff(restaurant_id);

-- Staff leaves
CREATE TABLE IF NOT EXISTS staff_leaves (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  staff_id      uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  leave_date    date NOT NULL,
  leave_type    text NOT NULL DEFAULT 'annual' CHECK (leave_type IN ('annual','sick','casual','unpaid')),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE staff_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own staff_leaves" ON staff_leaves
  FOR ALL USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = staff_leaves.restaurant_id AND r.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff      ON staff_leaves(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_restaurant ON staff_leaves(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_date       ON staff_leaves(leave_date);
