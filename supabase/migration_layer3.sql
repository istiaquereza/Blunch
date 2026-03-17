-- ============================================================
-- Bento POS — Layer 3 Migration
-- Run this in your Supabase SQL Editor
-- Adds missing columns needed for Inventory module
-- ============================================================

-- Add notes column to assets table
alter table assets add column if not exists notes text;

-- Add unit column to product_requisition_items (for display purposes)
alter table product_requisition_items add column if not exists unit text default '';

-- Fix: product_requisitions total_amount should be nullable (already is, but ensure notes column)
alter table product_requisitions add column if not exists notes text;

-- Ensure food_stock has the right unique constraint
-- (for upsert to work on ingredient_id + restaurant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'food_stock_ingredient_restaurant_unique'
  ) THEN
    ALTER TABLE food_stock ADD CONSTRAINT food_stock_ingredient_restaurant_unique
      UNIQUE (ingredient_id, restaurant_id);
  END IF;
END $$;
