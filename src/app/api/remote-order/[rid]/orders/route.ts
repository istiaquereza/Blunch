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

export async function POST(req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const body = await req.json();
  const { staff_id, table_id, items } = body;

  if (!rid || !items?.length) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = sb();
  const subtotal = items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0);

  const basePayload = {
    restaurant_id: rid,
    type: "dine_in",
    status: "active",
    table_id: table_id || null,
    subtotal,
    discount_amount: 0,
    service_charge: 0,
    vat_amount: 0,
    total: subtotal,
  };

  // Try with source column (post-migration), fall back to base payload
  let order: Record<string, unknown> | null = null;

  const { data: withSrc, error: srcErr } = await supabase
    .from("orders")
    .insert({ ...basePayload, source: "remote_staff" })
    .select()
    .single();

  if (!srcErr && withSrc) {
    order = withSrc;
  } else {
    const { data: withoutSrc, error: fallbackErr } = await supabase
      .from("orders")
      .insert(basePayload)
      .select()
      .single();
    if (fallbackErr || !withoutSrc) {
      console.error("[remote-order] insert error:", JSON.stringify(fallbackErr));
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
    order = withoutSrc;
  }

  // Insert order items
  const { error: itemsErr } = await supabase.from("order_items").insert(
    items.map((i: any) => ({
      order_id: order!.id,
      food_item_id: i.food_item_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      addons: [],
      options: {},
    }))
  );

  if (itemsErr) {
    console.error("[remote-order] order_items error:", JSON.stringify(itemsErr));
    // Don't fail — order was created, items might have partial success
  }

  // Store staff name in notes (best-effort)
  if (staff_id) {
    const { data: staffMember } = await supabase.from("staff").select("name").eq("id", staff_id).single();
    const staffNote = staffMember?.name ? `Staff: ${staffMember.name}` : null;
    if (staffNote) await supabase.from("orders").update({ notes: staffNote }).eq("id", order!.id);
  }

  return NextResponse.json({ orderId: order!.id, orderNumber: order!.order_number });
}
