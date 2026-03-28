export type AppUserRoleType = "super_admin" | "owner" | "manager" | "cashier" | "viewer";

export interface AppUserRole {
  id: string;
  restaurant_id: string;
  email: string;
  name: string;
  role: AppUserRoleType;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface Restaurant {
  id: string;
  user_id: string;
  name: string;
  type: "restaurant" | "outlet";
  parent_id?: string;
  location?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  social_links?: SocialLink[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryGroup {
  id: string;
  name: string;
  restaurant_id: string;
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit_type: "weight" | "volume" | "unit" | "quantity";
  default_unit: string;
  unit_price: number;
  inventory_group_id?: string;
  restaurant_id: string;
  created_at: string;
  inventory_groups?: { id: string; name: string } | null;
}

export interface FoodCategory {
  id: string;
  name: string;
  restaurant_id: string;
  is_active: boolean;
  created_at: string;
}

export interface FoodItemIngredient {
  id: string;
  food_item_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredients?: Ingredient;
}

export interface FoodItemAddon {
  id: string;
  food_item_id: string;
  name: string;
  price: number;
}

export interface FoodItemOption {
  id: string;
  option_group_id: string;
  label: string;
}

export interface FoodItemOptionGroup {
  id: string;
  food_item_id: string;
  name: string;
  food_item_options?: FoodItemOption[];
}

export interface RecipeLog {
  id: string;
  food_item_id: string;
  comment: string;
  status?: string;
  logged_at: string;
  quantity?: number;
  trial_cost?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  food_category_id?: string;
  sell_price: number;
  image_url?: string;
  is_active: boolean;
  is_recipe: boolean;
  recipe_status?: "research" | "trial" | "testing" | "launch";
  notes?: string;
  recipe_links?: string[];
  availability_type?: "premade" | "quantity";
  available_quantity?: number;
  created_at: string;
  food_categories?: FoodCategory | null;
  food_item_restaurants?: { restaurant_id: string; restaurants: Restaurant }[];
  food_item_ingredients?: FoodItemIngredient[];
  food_item_addons?: FoodItemAddon[];
  food_item_option_groups?: FoodItemOptionGroup[];
  recipe_logs?: RecipeLog[];
}

// Inventory Types
export interface AssetGroup {
  id: string;
  name: string;
  restaurant_id: string;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  asset_group_id?: string;
  restaurant_id: string;
  quantity: number;
  price: number;
  purchase_date?: string;
  condition: "good" | "average" | "low";
  notes?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  asset_groups?: AssetGroup | null;
}

export interface AssetCheckin {
  id: string;
  asset_id: string;
  checkin_date: string;
  quantity_in: number;
  quantity_out: number;
  note?: string;
  created_at: string;
}

export interface FoodStock {
  id: string;
  ingredient_id: string;
  restaurant_id: string;
  quantity: number;
  updated_at: string;
  ingredients?: Ingredient | null;
}

export interface ProductRequisition {
  id: string;
  restaurant_id: string;
  requisition_date: string;
  status: "submitted" | "approved" | "rejected";
  payment_status: "paid" | "due";
  notes?: string;
  memo_url?: string;
  vendor_id?: string;
  payment_method_id?: string;
  bazar_category_id?: string;
  created_at: string;
  updated_at: string;
  product_requisition_items?: ProductRequisitionItem[];
  vendors?: Vendor | null;
  payment_methods?: { id: string; name: string } | null;
  bazar_categories?: { id: string; name: string } | null;
}

export interface Vendor {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface ProductRequisitionItem {
  id: string;
  requisition_id: string;
  ingredient_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit?: string;
  ingredients?: Ingredient | null;
}
