import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmCustomerOrder, registerCustomerOrder } from "@/lib/customer-order-store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const body = await req.json();
  const prep_time_minutes = parseInt(body.prep_time_minutes, 10);

  if (!prep_time_minutes || prep_time_minutes < 1) {
    return NextResponse.json({ error: "Invalid prep time" }, { status: 400 });
  }

  const confirmedAt = new Date().toISOString();

  // Persist in in-memory store (works without any DB migration)
  registerCustomerOrder(orderId); // ensure it's registered even if server restarted
  confirmCustomerOrder(orderId, confirmedAt, prep_time_minutes);

  // Also try updating DB columns if migration has been run (best-effort, no error if columns missing)
  const supabase = createAdminClient();
  await supabase
    .from("orders")
    .update({ prep_time_minutes, confirmed_at: confirmedAt })
    .eq("id", orderId)
    .then(() => {/* ignore error — columns may not exist yet */});

  return NextResponse.json({ ok: true, prep_time_minutes, confirmed_at: confirmedAt });
}
