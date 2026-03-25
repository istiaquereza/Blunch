import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerOrderMeta, isCustomerOrder } from "@/lib/customer-order-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, order_items(*, food_items(name))")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Read confirmation data from in-memory store (primary source, no migration needed)
  const meta = getCustomerOrderMeta(orderId);
  const confirmedAt = meta?.confirmed_at ?? (order as Record<string, unknown>).confirmed_at ?? null;
  const prepMins = meta?.prep_time_minutes ?? (order as Record<string, unknown>).prep_time_minutes ?? null;

  return NextResponse.json({
    ...order,
    confirmed_at: confirmedAt,
    prep_time_minutes: prepMins,
    is_customer_order: isCustomerOrder(orderId),
  });
}
