import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function sb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = sb();

  const [
    { data: restaurant },
    { data: items },
    { data: staff },
    { data: tables },
    { data: paymentMethods },
    { data: billing },
    { data: discounts },
  ] = await Promise.all([
    supabase.from("restaurants").select("id, name, logo_url").eq("id", rid).single(),
    supabase.from("food_items")
      .select("id, name, sell_price, notes, image_url, food_category_id, is_active, food_categories(id, name), food_item_restaurants!inner(restaurant_id)")
      .eq("food_item_restaurants.restaurant_id", rid)
      .eq("is_active", true)
      .order("name"),
    supabase.from("staff").select("id, name, job_role, photo_url, staff_type").eq("restaurant_id", rid).order("name"),
    supabase.from("tables").select("id, name, table_number").eq("restaurant_id", rid).eq("is_active", true).order("name"),
    supabase.from("payment_methods").select("id, name").eq("restaurant_id", rid).eq("is_active", true).order("name"),
    supabase.from("billing_settings").select("vat_percentage, service_charge_percentage").eq("restaurant_id", rid).maybeSingle(),
    supabase.from("discounts").select("id, name, discount_type, discount_value").eq("restaurant_id", rid).eq("is_active", true).eq("apply_on", "order"),
  ]);

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const catMap = new Map<string, { id: string; name: string }>();
  for (const item of items ?? []) {
    const cat = (item as any).food_categories;
    if (cat?.id) catMap.set(cat.id, { id: cat.id, name: cat.name });
  }

  return NextResponse.json({
    restaurant,
    items: (items ?? []).map((i: any) => ({
      id: i.id, name: i.name, sell_price: i.sell_price,
      description: i.notes, image_url: i.image_url, category_id: i.food_category_id,
    })),
    categories: Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    staff: staff ?? [],
    tables: (tables ?? []).map((t: any) => ({ id: t.id, name: t.name ?? t.table_number ?? "" })),
    paymentMethods: paymentMethods ?? [],
    billing: billing ?? { vat_percentage: 0, service_charge_percentage: 0 },
    discounts: discounts ?? [],
  });
}
