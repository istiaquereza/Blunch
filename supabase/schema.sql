-- ============================================================
-- Bento POS — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- RESTAURANTS & OUTLETS
-- ============================================================

create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('restaurant', 'outlet')),
  parent_id uuid references restaurants(id),
  location text,
  address text,
  phone text,
  logo_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists restaurant_social_links (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  title text not null,
  url text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- PAYMENT METHODS
-- ============================================================

create table if not exists payment_methods (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  name text not null,
  fee_type text check (fee_type in ('percentage', 'amount')) default 'percentage',
  fee_value numeric(10,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FOOD CATEGORIES & MENU
-- ============================================================

create table if not exists food_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists inventory_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ingredients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit_type text not null check (unit_type in ('weight', 'volume', 'unit', 'quantity')),
  default_unit text not null,
  unit_price numeric(10,2) not null default 0,
  inventory_group_id uuid references inventory_groups(id),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists food_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  food_category_id uuid references food_categories(id),
  sell_price numeric(10,2) not null default 0,
  image_url text,
  is_active boolean default true,
  is_recipe boolean default false,
  recipe_status text check (recipe_status in ('research', 'trial', 'testing', 'launch')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists food_item_restaurants (
  food_item_id uuid references food_items(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  primary key (food_item_id, restaurant_id)
);

create table if not exists food_item_ingredients (
  id uuid primary key default uuid_generate_v4(),
  food_item_id uuid references food_items(id) on delete cascade not null,
  ingredient_id uuid references ingredients(id) on delete cascade not null,
  quantity numeric(10,3) not null default 0,
  unit text not null,
  created_at timestamptz default now()
);

create table if not exists food_item_addons (
  id uuid primary key default uuid_generate_v4(),
  food_item_id uuid references food_items(id) on delete cascade not null,
  name text not null,
  price numeric(10,2) default 0,
  created_at timestamptz default now()
);

create table if not exists food_item_option_groups (
  id uuid primary key default uuid_generate_v4(),
  food_item_id uuid references food_items(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists food_item_options (
  id uuid primary key default uuid_generate_v4(),
  option_group_id uuid references food_item_option_groups(id) on delete cascade not null,
  label text not null,
  created_at timestamptz default now()
);

create table if not exists recipe_logs (
  id uuid primary key default uuid_generate_v4(),
  food_item_id uuid references food_items(id) on delete cascade not null,
  comment text not null,
  status text,
  logged_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- ============================================================
-- INVENTORY
-- ============================================================

create table if not exists food_stock (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid references ingredients(id) on delete cascade not null,
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  quantity numeric(10,3) default 0,
  updated_at timestamptz default now(),
  unique (ingredient_id, restaurant_id)
);

create table if not exists asset_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  asset_group_id uuid references asset_groups(id),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  quantity numeric(10,0) default 0,
  price numeric(10,2) default 0,
  condition text check (condition in ('good', 'average', 'low')) default 'good',
  purchase_date date,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists asset_checkins (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid references assets(id) on delete cascade not null,
  quantity_in numeric(10,0) default 0,
  quantity_out numeric(10,0) default 0,
  note text,
  checkin_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists product_requisitions (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  requisition_date date not null default current_date,
  status text check (status in ('submitted', 'approved', 'rejected')) default 'submitted',
  total_amount numeric(10,2) default 0,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists product_requisition_items (
  id uuid primary key default uuid_generate_v4(),
  requisition_id uuid references product_requisitions(id) on delete cascade not null,
  ingredient_id uuid references ingredients(id) on delete cascade not null,
  quantity numeric(10,3) not null,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) generated always as (quantity * unit_price) stored,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending'
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================

create table if not exists expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('expense', 'income')),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  category_id uuid references expense_categories(id),
  type text not null check (type in ('expense', 'income')),
  description text,
  amount numeric(10,2) not null,
  payment_method_id uuid references payment_methods(id),
  status text check (status in ('paid', 'due')) default 'paid',
  transaction_date date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ORDERS
-- ============================================================

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  table_number text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique not null,
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  customer_id uuid references customers(id),
  table_id uuid references tables(id),
  type text not null check (type in ('dine_in', 'takeaway')) default 'dine_in',
  status text not null check (status in ('active', 'billed', 'completed', 'cancelled')) default 'active',
  payment_method_id uuid references payment_methods(id),
  subtotal numeric(10,2) default 0,
  discount_amount numeric(10,2) default 0,
  service_charge numeric(10,2) default 0,
  vat_amount numeric(10,2) default 0,
  total numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  food_item_id uuid references food_items(id) not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  addons jsonb default '[]',
  options jsonb default '{}',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- BILLING SETTINGS
-- ============================================================

create table if not exists billing_settings (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null unique,
  vat_percentage numeric(5,2) default 0,
  vat_apply_on text check (vat_apply_on in ('order', 'item')) default 'order',
  service_charge_percentage numeric(5,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists discounts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  name text not null,
  discount_type text check (discount_type in ('percentage', 'amount')) default 'percentage',
  discount_value numeric(10,2) default 0,
  apply_on text check (apply_on in ('order', 'item')) default 'order',
  food_item_id uuid references food_items(id),
  start_date date,
  end_date date,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- PRINT SETTINGS
-- ============================================================

create table if not exists print_settings (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null unique,
  show_logo boolean default true,
  show_address boolean default true,
  show_phone boolean default true,
  show_social boolean default false,
  biin text,
  greeting text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table restaurants enable row level security;
alter table food_items enable row level security;
alter table ingredients enable row level security;
alter table orders enable row level security;
alter table transactions enable row level security;
alter table customers enable row level security;

-- Basic RLS: users can only see their own restaurants
create policy "Users can manage their restaurants"
  on restaurants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTION: auto-generate order numbers
-- ============================================================

create or replace function generate_order_number()
returns trigger as $$
begin
  new.order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_seq')::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create sequence if not exists order_seq;

create trigger set_order_number
  before insert on orders
  for each row
  execute function generate_order_number();

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_food_items_category on food_items(food_category_id);
create index if not exists idx_ingredients_restaurant on ingredients(restaurant_id);
create index if not exists idx_orders_restaurant on orders(restaurant_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_transactions_restaurant on transactions(restaurant_id);
create index if not exists idx_transactions_date on transactions(transaction_date);
