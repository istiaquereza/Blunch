import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerCustomerOrder } from "@/lib/customer-order-store";

export async function POST(req: Request) {
  const supabase = createAdminClient();
  const body = await req.json();
  const {
    restaurant_id, customer_name, customer_phone,
    table_id, items, subtotal, discount_amount, service_charge, vat_amount, total,
  } = body;

  if (!restaurant_id || !customer_name || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 1. Find or create customer record
  let customerId: string | null = null;
  try {
    if (customer_phone) {
      const { data: existing } = await supabase
        .from("customers").select("id")
        .eq("restaurant_id", restaurant_id).eq("phone", customer_phone).limit(1).single();
      if (existing) customerId = existing.id;
    }
    if (!customerId) {
      const { data: newC } = await supabase
        .from("customers").insert({ name: customer_name, phone: customer_phone || null, restaurant_id })
        .select("id").single();
      if (newC) customerId = newC.id;
    }
  } catch { /* best-effort */ }

  const calcSubtotal: number = subtotal ??
    items.reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0);

  // Base payload — only columns that are guaranteed to exist in the orders table
  const payload: Record<string, unknown> = {
    restaurant_id,
    type: "dine_in",
    status: "active",
    customer_id: customerId,
    table_id: table_id || null,
    subtotal: calcSubtotal,
    discount_amount: discount_amount ?? 0,
    service_charge: service_charge ?? 0,
    vat_amount: vat_amount ?? 0,
    total: total ?? calcSubtotal,
  };

  // Try with `source` column first (available after migration), fall back to base payload
  let order: Record<string, unknown> | null = null;

  const { data: withSrc, error: srcErr } = await supabase
    .from("orders").insert({ ...payload, source: "customer" }).select().single();

  if (!srcErr && withSrc) {
    order = withSrc;
  } else {
    const { data: withoutSrc, error: fallbackErr } = await supabase
      .from("orders").insert(payload).select().single();
    if (fallbackErr || !withoutSrc) {
      console.error("[customer-order] insert error:", JSON.stringify(fallbackErr));
      return NextResponse.json(
        { error: fallbackErr?.message ?? "Failed to create order" },
        { status: 500 }
      );
    }
    order = withoutSrc;
  }

  if (!order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const orderId = order.id as string;

  // 2. Insert order items
  const { error: itemsErr } = await supabase.from("order_items").insert(
    items.map((i: { food_item_id: string; quantity: number; unit_price: number }) => ({
      order_id: orderId,
      food_item_id: i.food_item_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      addons: [],
      options: {},
    }))
  );

  if (itemsErr) {
    console.error("[customer-order] order_items insert error:", JSON.stringify(itemsErr));
    // Order was created — return it anyway so customer sees confirmation
  }

  // 3. Register in in-memory store so admin page can detect it as a customer order
  registerCustomerOrder(orderId);

  return NextResponse.json({ orderId, orderNumber: order.order_number });
}
