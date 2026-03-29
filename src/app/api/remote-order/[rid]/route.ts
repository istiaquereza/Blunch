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
    { data: activeOrders },
    { data: customers },
    { data: txns },
  ] = await Promise.all([
    supabase.from("restaurants").select("id, name, logo_url").eq("id", rid).single(),
    supabase.from("food_items")
      .select("id, name, sell_price, notes, image_url, food_category_id, is_active, availability_type, available_quantity, food_categories(id, name), food_item_restaurants!inner(restaurant_id)")
      .eq("food_item_restaurants.restaurant_id", rid)
      .eq("is_active", true)
      .order("name"),
    supabase.from("staff").select("id, name, job_role, photo_url, staff_type").eq("restaurant_id", rid).order("name"),
    supabase.from("tables").select("id, name, table_number").eq("restaurant_id", rid).eq("is_active", true).order("name"),
    supabase.from("payment_methods").select("id, name").eq("restaurant_id", rid).eq("is_active", true).order("name"),
    supabase.from("billing_settings").select("vat_percentage, service_charge_percentage").eq("restaurant_id", rid).maybeSingle(),
    supabase.from("discounts").select("id, name, discount_type, discount_value").eq("restaurant_id", rid).eq("is_active", true).eq("apply_on", "order"),
    supabase.from("orders").select("table_id").eq("restaurant_id", rid).in("status", ["active", "billed"]).not("table_id", "is", null),
    supabase.from("customers").select("id, name, phone").eq("restaurant_id", rid).order("name").limit(300),
    supabase.from("transactions").select("payment_method_id, type, amount").eq("restaurant_id", rid).eq("status", "paid"),
  ]);

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const catMap = new Map<string, { id: string; name: string }>();
  for (const item of items ?? []) {
    const cat = (item as any).food_categories;
    if (cat?.id) catMap.set(cat.id, { id: cat.id, name: cat.name });
  }

  const occupiedTableIds = (activeOrders ?? []).map((o: any) => o.table_id).filter(Boolean);

  const pmBalances: Record<string, number> = {};
  for (const pm of paymentMethods ?? []) pmBalances[(pm as any).id] = 0;
  for (const t of txns ?? []) {
    const pmId = (t as any).payment_method_id;
    if (!pmId) continue;
    pmBalances[pmId] = (pmBalances[pmId] ?? 0) + ((t as any).type === "income" ? (t as any).amount : -(t as any).amount);
  }

  return NextResponse.json({
    restaurant,
    items: (items ?? []).map((i: any) => ({
      id: i.id, name: i.name, sell_price: i.sell_price,
      description: i.notes, image_url: i.image_url, category_id: i.food_category_id,
      availability_type: i.availability_type ?? "always",
      available_quantity: i.available_quantity ?? 0,
    })),
    categories: Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    staff: staff ?? [],
    tables: (tables ?? []).map((t: any) => ({ id: t.id, name: t.name ?? t.table_number ?? "" })),
    occupiedTableIds,
    customers: (customers ?? []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone ?? "" })),
    paymentMethods: paymentMethods ?? [],
    pmBalances,
    billing: billing ?? { vat_percentage: 0, service_charge_percentage: 0 },
    discounts: discounts ?? [],
  });
}
