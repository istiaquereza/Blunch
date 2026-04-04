import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function createAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurant_id");
  if (!restaurantId) return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });

  const supabase = createAdmin();

  const [{ data: stockRows }, { data: ingredients }, { data: allLogs }] = await Promise.all([
    supabase
      .from("food_stock")
      .select("id, ingredient_id, restaurant_id, quantity, updated_at")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("ingredients")
      .select("id, name, default_unit, unit_price, unit_type, inventory_group_id, inventory_groups(id, name)")
      .order("name"),
    // Fetch all stock logs for this restaurant to compute net position as fallback
    supabase
      .from("food_stock_logs")
      .select("ingredient_id, quantity_change")
      .eq("restaurant_id", restaurantId),
  ]);

  // Build net quantity from logs per ingredient (sum of all movements)
  const logNetByIngId = new Map<string, number>();
  for (const log of allLogs ?? []) {
    const curr = logNetByIngId.get(log.ingredient_id as string) ?? 0;
    logNetByIngId.set(log.ingredient_id as string, curr + (log.quantity_change as number));
  }

  // Build stock lookup by ingredient_id
  const stockByIngId = new Map<string, Record<string, unknown>>();
  for (const s of stockRows ?? []) stockByIngId.set(s.ingredient_id as string, s as Record<string, unknown>);

  // Build ingredient lookup by ID
  const ingById = new Map<string, Record<string, unknown>>();
  for (const ing of ingredients ?? []) ingById.set(ing.id as string, ing as Record<string, unknown>);

  // Merge: for each universal ingredient, find matching stock row
  // If food_stock shows 0 but logs show a positive net, use the log net (self-heal)
  const toHeal: Array<{ ingredient_id: string; quantity: number }> = [];
  const items = (ingredients ?? []).map((ing: Record<string, unknown>) => {
    const s = stockByIngId.get(ing.id as string);
    const storedQty: number = s ? (s.quantity as number) : 0;
    const logNet: number = logNetByIngId.get(ing.id as string) ?? 0;

    // Use log-computed net when food_stock is 0 but logs show positive balance
    let quantity = storedQty;
    if (storedQty <= 0 && logNet > 0) {
      quantity = logNet;
      // Queue this ingredient for healing so food_stock gets corrected
      toHeal.push({ ingredient_id: ing.id as string, quantity: logNet });
    }

    return {
      ingredient_id: ing.id,
      ingredient: ing,
      quantity,
      updated_at: s ? (s.updated_at as string) : null,
      stock_id: s ? (s.id as string) : null,
    };
  });

  // Self-heal: write corrected quantities back to food_stock in background
  if (toHeal.length > 0) {
    for (const { ingredient_id, quantity } of toHeal) {
      supabase.from("food_stock").upsert(
        { ingredient_id, restaurant_id: restaurantId, quantity, updated_at: new Date().toISOString() },
        { onConflict: "ingredient_id,restaurant_id" }
      ).then(() => {});
    }
  }

  // Orphan stock: food_stock rows whose ingredient_id doesn't match any universal ingredient
  const orphanStock = (stockRows ?? [])
    .filter((s: Record<string, unknown>) => !ingById.has(s.ingredient_id as string))
    .map((s: Record<string, unknown>) => ({
      ingredient_id: s.ingredient_id,
      ingredient: null,
      quantity: s.quantity as number,
      updated_at: s.updated_at as string,
      stock_id: s.id as string,
      orphan: true,
    }));

  return NextResponse.json({ items, orphanStock });
}

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { restaurant_id, ingredient_id, quantity } = body;
  if (!restaurant_id || !ingredient_id || quantity === undefined) {
    return NextResponse.json({ error: "restaurant_id, ingredient_id, quantity required" }, { status: 400 });
  }

  const supabase = createAdmin();
  const { error } = await supabase
    .from("food_stock")
    .upsert(
      { ingredient_id, restaurant_id, quantity, updated_at: new Date().toISOString() },
      { onConflict: "ingredient_id,restaurant_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
