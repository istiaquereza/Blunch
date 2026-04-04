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

// GET: fetch logs for an ingredient (used by Stock Movements dialog)
export async function GET(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ingredientId = searchParams.get("ingredient_id");
  const restaurantId = searchParams.get("restaurant_id");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");

  if (!ingredientId || !restaurantId) {
    return NextResponse.json({ error: "ingredient_id and restaurant_id required" }, { status: 400 });
  }

  const supabase = createAdmin();
  let q = supabase
    .from("food_stock_logs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("ingredient_id", ingredientId)
    .order("created_at", { ascending: false });

  if (dateFrom) q = q.gte("created_at", dateFrom);
  if (dateTo) q = q.lte("created_at", dateTo);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data ?? [] });
}

// POST: create a food_stock_logs entry
export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { restaurant_id, ingredient_id, quantity_change, reason, created_at } = body;

  if (!restaurant_id || !ingredient_id || quantity_change === undefined || !reason) {
    return NextResponse.json({ error: "restaurant_id, ingredient_id, quantity_change, reason required" }, { status: 400 });
  }

  const supabase = createAdmin();
  const insert: Record<string, unknown> = { restaurant_id, ingredient_id, quantity_change, reason };
  if (created_at) insert.created_at = created_at;

  const { error } = await supabase.from("food_stock_logs").insert(insert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
