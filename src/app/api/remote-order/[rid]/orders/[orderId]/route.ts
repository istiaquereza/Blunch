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

export async function GET(_req: Request, { params }: { params: Promise<{ rid: string; orderId: string }> }) {
  const { orderId } = await params;
  const supabase = sb();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, food_items(id, name, sell_price))")
    .eq("id", orderId).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ rid: string; orderId: string }> }) {
  const { orderId } = await params;
  const body = await req.json();
  const supabase = sb();

  if (body.action === "add_items") {
    const { items } = body;
    await supabase.from("order_items").insert(
      items.map((i: any) => ({
        order_id: orderId, food_item_id: i.food_item_id,
        quantity: i.quantity, unit_price: i.unit_price, addons: [], options: {},
      }))
    );
    // Recalculate subtotal from all items
    const { data: allItems } = await supabase.from("order_items").select("quantity, unit_price").eq("order_id", orderId);
    const subtotal = (allItems ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    await supabase.from("orders").update({ subtotal, total: subtotal }).eq("id", orderId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "bill") {
    const { customer_name, customer_phone, payment_method_id, subtotal, discount_amount, vat_amount, service_charge, total } = body;

    // Fetch order meta (restaurant_id, order_number) — needed for transaction + customer
    const { data: orderMeta } = await supabase
      .from("orders")
      .select("restaurant_id, order_number")
      .eq("id", orderId)
      .single();

    const restaurantId = orderMeta?.restaurant_id ?? null;

    // Find or create customer
    let customerId: string | null = null;
    if (restaurantId && (customer_phone || customer_name)) {
      if (customer_phone) {
        const { data: existing } = await supabase
          .from("customers").select("id")
          .eq("restaurant_id", restaurantId).eq("phone", customer_phone)
          .limit(1).maybeSingle();
        if (existing) customerId = existing.id;
      }
      if (!customerId) {
        const { data: newC } = await supabase
          .from("customers")
          .insert({ name: customer_name || "Guest", phone: customer_phone || null, restaurant_id: restaurantId })
          .select("id").single();
        if (newC) customerId = newC.id;
      }
    }

    // Mark order as completed (remote orders are fully paid on mobile — no intermediate "billed" state)
    await supabase.from("orders").update({
      status: "completed",
      payment_method_id: payment_method_id || null,
      customer_id: customerId,
      subtotal, discount_amount, vat_amount, service_charge, total,
      updated_at: new Date().toISOString(),
    }).eq("id", orderId);

    // Create income transaction (same as completeOrderFull in use-orders)
    if (restaurantId && total > 0) {
      try {
        // Find "Daily Sales" income category (service role — no user_id filter needed)
        const { data: cat } = await supabase
          .from("expense_categories")
          .select("id")
          .ilike("name", "daily sales")
          .eq("type", "income")
          .limit(1)
          .maybeSingle();

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        await supabase.from("transactions").insert({
          restaurant_id: restaurantId,
          type: "income",
          amount: total,
          description: `${orderMeta?.order_number ?? orderId}: Daily Sales`,
          category_id: cat?.id ?? null,
          payment_method_id: payment_method_id || null,
          status: "paid",
          transaction_date: todayStr,
        });
      } catch (e) {
        // Non-fatal — order is completed even if transaction insert fails
        console.error("[remote-order] transaction insert failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancel") {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
