import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rid: string }> }
) {
  const { rid } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[menu] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Use anon key — this is a public route, no auth needed
  // If your RLS blocks anon reads on food_items/restaurants, add SUPABASE_SERVICE_ROLE_KEY to Vercel and swap below
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Fetch restaurant, tables, billing settings, and discounts in parallel
  const [
    { data: restaurant, error: restaurantErr },
    { data: tables },
    { data: billing },
    { data: discounts },
  ] = await Promise.all([
    supabase.from("restaurants").select("id, name, logo_url").eq("id", rid).single(),
    supabase.from("tables").select("id, name, table_number").eq("restaurant_id", rid).eq("is_active", true).order("name"),
    supabase.from("billing_settings").select("vat_percentage, service_charge_percentage").eq("restaurant_id", rid).maybeSingle(),
    supabase.from("discounts").select("id, name, discount_type, discount_value").eq("restaurant_id", rid).eq("is_active", true).eq("apply_on", "order"),
  ]);

  if (!restaurant) {
    const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.error(`[menu] restaurant fetch failed. rid=${rid} usingServiceRole=${usingServiceRole} error=${JSON.stringify(restaurantErr)}`);
    return NextResponse.json({ error: "Restaurant not found", detail: restaurantErr?.message }, { status: 404 });
  }

  // Fetch food items via food_item_restaurants join (same as useFoodItems hook)
  const { data: items } = await supabase
    .from("food_items")
    .select(`
      id, name, sell_price, notes, image_url, food_category_id, is_active,
      food_categories(id, name),
      food_item_restaurants!inner(restaurant_id)
    `)
    .eq("food_item_restaurants.restaurant_id", rid)
    .eq("is_active", true)
    .order("name");

  // Derive unique categories from items
  const categoryMap = new Map<string, { id: string; name: string }>();
  for (const item of items ?? []) {
    const cat = (item as any).food_categories;
    if (cat?.id) categoryMap.set(cat.id, { id: cat.id, name: cat.name });
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const cleanItems = (items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    sell_price: item.sell_price,
    description: item.notes,
    image_url: item.image_url,
    category_id: item.food_category_id,
  }));

  const cleanTables = (tables ?? []).map((t: any) => ({
    id: t.id,
    name: t.name ?? t.table_number ?? "",
  }));

  return NextResponse.json({
    restaurant,
    items: cleanItems,
    categories,
    tables: cleanTables,
    billing: billing ?? { vat_percentage: 0, service_charge_percentage: 0 },
    discounts: discounts ?? [],
  });
}
