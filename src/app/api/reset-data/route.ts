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

export interface ResetScope {
  orders: boolean;       // orders + order_items
  stock: boolean;        // food_stock + food_stock_logs
  transactions: boolean; // transactions
  leaves: boolean;       // staff_leaves
  customers: boolean;    // customers
  requisitions: boolean; // product_requisitions + product_requisition_items
  assetCheckins: boolean;// asset_checkins
}

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { restaurant_id, scope } = body as { restaurant_id: string; scope: ResetScope };

  if (!restaurant_id) return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });

  const supabase = createAdmin();
  const results: Record<string, string> = {};

  // ── Orders & Sales ────────────────────────────────────────────────────────
  if (scope.orders) {
    // Delete order_items first (FK dependency)
    const { data: orderIds } = await supabase
      .from("orders")
      .select("id")
      .eq("restaurant_id", restaurant_id);

    if (orderIds && orderIds.length > 0) {
      const ids = orderIds.map((o: Record<string, unknown>) => o.id as string);
      await supabase.from("order_items").delete().in("order_id", ids);
    }

    const { error } = await supabase.from("orders").delete().eq("restaurant_id", restaurant_id);
    results.orders = error ? `Error: ${error.message}` : "OK";
  }

  // ── Stock Data ────────────────────────────────────────────────────────────
  if (scope.stock) {
    const { error: stockErr } = await supabase.from("food_stock").delete().eq("restaurant_id", restaurant_id);
    const { error: logsErr } = await supabase.from("food_stock_logs").delete().eq("restaurant_id", restaurant_id);
    results.stock = stockErr || logsErr
      ? `Error: ${stockErr?.message ?? logsErr?.message}`
      : "OK";
  }

  // ── Transactions ──────────────────────────────────────────────────────────
  if (scope.transactions) {
    const { error } = await supabase.from("transactions").delete().eq("restaurant_id", restaurant_id);
    results.transactions = error ? `Error: ${error.message}` : "OK";
  }

  // ── Staff Leaves ──────────────────────────────────────────────────────────
  if (scope.leaves) {
    const { error } = await supabase.from("staff_leaves").delete().eq("restaurant_id", restaurant_id);
    results.leaves = error ? `Error: ${error.message}` : "OK";
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  if (scope.customers) {
    const { error } = await supabase.from("customers").delete().eq("restaurant_id", restaurant_id);
    results.customers = error ? `Error: ${error.message}` : "OK";
  }

  // ── Product Requisitions ──────────────────────────────────────────────────
  if (scope.requisitions) {
    const { data: reqIds } = await supabase
      .from("product_requisitions")
      .select("id")
      .eq("restaurant_id", restaurant_id);

    if (reqIds && reqIds.length > 0) {
      const ids = reqIds.map((r: Record<string, unknown>) => r.id as string);
      await supabase.from("product_requisition_items").delete().in("requisition_id", ids);
    }

    const { error } = await supabase.from("product_requisitions").delete().eq("restaurant_id", restaurant_id);
    results.requisitions = error ? `Error: ${error.message}` : "OK";
  }

  // ── Asset Check-ins ───────────────────────────────────────────────────────
  if (scope.assetCheckins) {
    const { data: assetIds } = await supabase
      .from("assets")
      .select("id")
      .eq("restaurant_id", restaurant_id);

    if (assetIds && assetIds.length > 0) {
      const ids = assetIds.map((a: Record<string, unknown>) => a.id as string);
      await supabase.from("asset_checkins").delete().in("asset_id", ids);
    }
    results.assetCheckins = "OK";
  }

  const hasErrors = Object.values(results).some((v) => v.startsWith("Error"));
  return NextResponse.json({ ok: !hasErrors, results });
}
