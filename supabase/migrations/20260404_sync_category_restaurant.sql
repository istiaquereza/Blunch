-- Sync old expense_categories (restaurant_id IS NULL) to the restaurant
-- that uses them most in transactions. This links legacy categories to
-- their correct restaurant so they appear in per-restaurant manage modals.

UPDATE expense_categories ec
SET restaurant_id = (
  SELECT t.restaurant_id
  FROM transactions t
  WHERE t.category_id = ec.id
  GROUP BY t.restaurant_id
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
WHERE ec.restaurant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM transactions t WHERE t.category_id = ec.id
  );
