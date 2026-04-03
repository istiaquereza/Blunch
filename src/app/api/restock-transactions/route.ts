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
  const ingredientId = searchParams.get("ingredient_id");
  const unitPrice = parseFloat(searchParams.get("unit_price") ?? "0");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");

  if (!ingredientId) return NextResponse.json({ error: "ingredient_id required" }, { status: 400 });

  const supabase = createAdmin();

  let q = supabase
    .from("food_stock_logs")
    .select("id, ingredient_id, quantity_change, reason, created_at")
    .eq("ingredient_id", ingredientId)
    .eq("reason", "manual_restock")
    .gt("quantity_change", 0)
    .order("created_at", { ascending: false });

  if (dateFrom) q = q.gte("created_at", dateFrom);
  if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59.999Z");

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (data ?? []).map((log: Record<string, unknown>) => ({
    id: log.id,
    transaction_date: (log.created_at as string).split("T")[0],
    created_at: log.created_at,
    quantity_change: log.quantity_change as number,
    amount: parseFloat(((log.quantity_change as number) * unitPrice).toFixed(2)),
    description: "",
  }));

  return NextResponse.json({ entries });
}
