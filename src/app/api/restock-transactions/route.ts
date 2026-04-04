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
  const ingredientName = searchParams.get("name") ?? "";
  const restaurantId = searchParams.get("restaurant_id");
  const unitPrice = parseFloat(searchParams.get("unit_price") ?? "0");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");

  if (!ingredientId) return NextResponse.json({ error: "ingredient_id required" }, { status: 400 });

  const supabase = createAdmin();

  // ── Primary: food_stock_logs ──────────────────────────────────────────────
  let logsQ = supabase
    .from("food_stock_logs")
    .select("id, ingredient_id, quantity_change, reason, created_at")
    .eq("ingredient_id", ingredientId)
    .eq("reason", "manual_restock")
    .gt("quantity_change", 0)
    .order("created_at", { ascending: false });

  if (restaurantId) logsQ = logsQ.eq("restaurant_id", restaurantId);
  if (dateFrom) logsQ = logsQ.gte("created_at", dateFrom);
  if (dateTo) logsQ = logsQ.lte("created_at", dateTo + "T23:59:59.999Z");

  const { data: logs } = await logsQ;

  if ((logs ?? []).length > 0) {
    const entries = logs!.map((log: Record<string, unknown>) => ({
      id: log.id,
      transaction_date: (log.created_at as string).split("T")[0],
      created_at: log.created_at,
      quantity_change: log.quantity_change as number,
      amount: parseFloat(((log.quantity_change as number) * unitPrice).toFixed(2)),
      source: "logs",
    }));
    return NextResponse.json({ entries, source: "logs" });
  }

  // ── Fallback: transactions table ──────────────────────────────────────────
  if (!ingredientName) return NextResponse.json({ entries: [], source: "none" });

  const safeName = ingredientName.replace(/[%_]/g, "\\$&");
  let txQ = supabase
    .from("transactions")
    .select("id, transaction_date, created_at, amount, description")
    .eq("type", "expense")
    .ilike("description", `Stock restock: ${safeName}%`)
    .order("transaction_date", { ascending: false });

  if (restaurantId) txQ = txQ.eq("restaurant_id", restaurantId);
  if (dateFrom) txQ = txQ.gte("transaction_date", dateFrom);
  if (dateTo) txQ = txQ.lte("transaction_date", dateTo);

  const { data: txns } = await txQ;

  const entries = (txns ?? []).map((tx: Record<string, unknown>) => {
    const desc = tx.description as string;
    const match = desc.match(/\+([0-9.]+)/);
    const qty = match ? parseFloat(match[1]) : (unitPrice > 0 ? (tx.amount as number) / unitPrice : 0);
    return {
      id: tx.id,
      transaction_date: tx.transaction_date as string,
      created_at: tx.created_at as string,
      quantity_change: qty,
      amount: tx.amount as number,
      source: "transactions",
    };
  });

  return NextResponse.json({ entries, source: "transactions" });
}

// ── PATCH: update a restock entry ─────────────────────────────────────────
export async function PATCH(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, source, new_qty, new_date, ingredient_name, unit_price, unit, restaurant_id } = body;

  if (!id || !source || new_qty === undefined || !new_date) {
    return NextResponse.json({ error: "id, source, new_qty, new_date required" }, { status: 400 });
  }

  const supabase = createAdmin();
  const newCreatedAt = new Date(new_date + "T12:00:00").toISOString();
  const newAmount = parseFloat((new_qty * (unit_price ?? 0)).toFixed(2));

  if (source === "logs") {
    // Get old qty before updating (to return for stock reconciliation)
    const { data: existing } = await supabase
      .from("food_stock_logs")
      .select("quantity_change")
      .eq("id", id)
      .single();
    const oldQty = (existing as Record<string, unknown>)?.quantity_change as number ?? 0;

    const { error } = await supabase
      .from("food_stock_logs")
      .update({ quantity_change: new_qty, created_at: newCreatedAt })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also update the matching transaction expense entry
    if (ingredient_name && restaurant_id && newAmount > 0) {
      const safeName = ingredient_name.replace(/[%_]/g, "\\$&");
      const oldDate = newCreatedAt.split("T")[0];
      // Try to find & update the transaction by description pattern + approximate date
      const { data: txns } = await supabase
        .from("transactions")
        .select("id, description")
        .eq("restaurant_id", restaurant_id)
        .eq("type", "expense")
        .ilike("description", `Stock restock: ${safeName} +%`);

      if (txns && txns.length > 0) {
        // Pick the one closest to original date if multiple; update the first match
        const tx = (txns as Record<string, unknown>[])[0];
        const newDesc = `Stock restock: ${ingredient_name} +${(new_qty as number).toFixed(2)} ${unit ?? ""}`.trim();
        await supabase
          .from("transactions")
          .update({ amount: newAmount, description: newDesc, transaction_date: new_date, created_at: newCreatedAt })
          .eq("id", tx.id as string);
      }
    }

    return NextResponse.json({ ok: true, oldQty, newQty: new_qty, newAmount });
  }

  if (source === "transactions") {
    const newDesc = ingredient_name
      ? `Stock restock: ${ingredient_name} +${(new_qty as number).toFixed(2)} ${unit ?? ""}`.trim()
      : undefined;
    const updatePayload: Record<string, unknown> = {
      amount: newAmount,
      transaction_date: new_date,
      created_at: newCreatedAt,
    };
    if (newDesc) updatePayload.description = newDesc;

    const { data: existing } = await supabase
      .from("transactions")
      .select("amount")
      .eq("id", id)
      .single();
    const oldAmount = (existing as Record<string, unknown>)?.amount as number ?? 0;
    const oldQty = unit_price > 0 ? oldAmount / unit_price : 0;

    const { error } = await supabase.from("transactions").update(updatePayload).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, oldQty, newQty: new_qty, newAmount });
  }

  return NextResponse.json({ error: "Unknown source" }, { status: 400 });
}

// ── DELETE: remove a restock entry ───────────────────────────────────────
export async function DELETE(request: Request) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const source = searchParams.get("source");
  const ingredientName = searchParams.get("ingredient_name");
  const restaurantId = searchParams.get("restaurant_id");

  if (!id || !source) return NextResponse.json({ error: "id and source required" }, { status: 400 });

  const supabase = createAdmin();

  if (source === "logs") {
    const { error } = await supabase.from("food_stock_logs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also delete the matching transaction expense entry
    if (ingredientName && restaurantId) {
      const safeName = ingredientName.replace(/[%_]/g, "\\$&");
      const { data: txns } = await supabase
        .from("transactions")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("type", "expense")
        .ilike("description", `Stock restock: ${safeName} +%`);
      if (txns && txns.length > 0) {
        await supabase.from("transactions").delete().eq("id", (txns as Record<string, unknown>[])[0].id as string);
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (source === "transactions") {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown source" }, { status: 400 });
}
