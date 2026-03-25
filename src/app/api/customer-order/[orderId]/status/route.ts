import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCustomerOrderMeta } from "@/lib/customer-order-store";

export const dynamic = "force-dynamic";

function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const supabase = createClient();

  // Try full select (including columns added by migration)
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, source, confirmed_at, prep_time_minutes, order_items(*, food_items(name))")
    .eq("id", orderId)
    .single();

  // If columns don't exist yet (pre-migration), fall back to basic select
  if (error) {
    const { data: basic, error: basicErr } = await supabase
      .from("orders")
      .select("id, order_number, status, created_at, order_items(*, food_items(name))")
      .eq("id", orderId)
      .single();

    if (basicErr || !basic) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Fall back to in-memory store for confirmation data (local dev only)
    const meta = getCustomerOrderMeta(orderId);
    return NextResponse.json({
      ...basic,
      confirmed_at: meta?.confirmed_at ?? null,
      prep_time_minutes: meta?.prep_time_minutes ?? null,
      is_customer_order: !!meta,
    });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const o = order as Record<string, unknown>;

  // Also check in-memory store as fallback (covers the window between confirm API call
  // and the next DB poll, e.g. if columns exist but haven't been committed yet)
  const meta = getCustomerOrderMeta(orderId);
  const confirmedAt = (o.confirmed_at as string | null) ?? meta?.confirmed_at ?? null;
  const prepMins = (o.prep_time_minutes as number | null) ?? meta?.prep_time_minutes ?? null;

  return NextResponse.json({
    ...order,
    confirmed_at: confirmedAt,
    prep_time_minutes: prepMins,
    is_customer_order: o.source === "customer" || !!meta,
  });
}
