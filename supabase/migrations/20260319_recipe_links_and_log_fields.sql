-- Add recipe_links array to food_items
alter table food_items
  add column if not exists recipe_links text[] default '{}';

-- Add quantity and trial_cost to recipe_logs
alter table recipe_logs
  add column if not exists quantity integer default 1,
  add column if not exists trial_cost numeric(10,2);
