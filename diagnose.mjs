import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gbulhthscfuaiwhzuqhp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdidWxodGhzY2Z1YWl3aHp1cWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIwMDk5OSwiZXhwIjoyMDg4Nzc2OTk5fQ.FTCQ8fIMsQHoq4zkpxxQvFrPzXYWlUmpdXFWo0LZhQ8";
const LUNCH_BOX_ID = "85f9850a-5ecb-445d-a6a4-f409940e283b";
const SUPER_ADMIN_EMAIL = "siiisiiir@gmail.com";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Check app_user_roles for super admin + lunch box
console.log("=== 1. app_user_roles for super admin + Lunch Box ===");
const { data: roles } = await admin.from("app_user_roles")
  .select("*").eq("restaurant_id", LUNCH_BOX_ID).eq("email", SUPER_ADMIN_EMAIL);
console.log(JSON.stringify(roles, null, 2));

// 2. Check food_items for Lunch Box
console.log("\n=== 2. food_items count for Lunch Box ===");
const { count: foodCount } = await admin.from("food_items")
  .select("id", { count: "exact", head: true }).eq("restaurant_id", LUNCH_BOX_ID);
console.log("food_items count:", foodCount);

// 3. Check orders for Lunch Box
console.log("\n=== 3. orders count for Lunch Box ===");
const { count: orderCount } = await admin.from("orders")
  .select("id", { count: "exact", head: true }).eq("restaurant_id", LUNCH_BOX_ID);
console.log("orders count:", orderCount);

// 4. Check categories for Lunch Box
console.log("\n=== 4. food_categories count for Lunch Box ===");
const { count: catCount } = await admin.from("food_categories")
  .select("id", { count: "exact", head: true }).eq("restaurant_id", LUNCH_BOX_ID);
console.log("categories count:", catCount);

// 5. Check all app_user_roles for siiisiiir
console.log("\n=== 5. All app_user_roles for super admin ===");
const { data: allRoles } = await admin.from("app_user_roles")
  .select("restaurant_id, role, is_active").eq("email", SUPER_ADMIN_EMAIL);
console.log(`Total entries: ${allRoles?.length}`);
allRoles?.forEach(r => console.log(`  ${r.restaurant_id} — ${r.role} — active: ${r.is_active}`));

// 6. Check Lunch Box restaurant user_id
console.log("\n=== 6. Lunch Box owner ===");
const { data: lb } = await admin.from("restaurants").select("name, user_id").eq("id", LUNCH_BOX_ID);
console.log(JSON.stringify(lb, null, 2));
