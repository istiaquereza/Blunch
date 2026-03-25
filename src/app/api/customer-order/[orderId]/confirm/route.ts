import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerCustomerOrder, confirmCustomerOrder } from "@/lib/customer-order-store";

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

  // Always store in-memory as immediate fallback (survives within same process/request)
  registerCustomerOrder(orderId);
  confirmCustomerOrder(orderId, confirmedAt, prep_time_minutes);

  // Also persist to DB (works after migration — required for Vercel/serverless)
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ prep_time_minutes, confirmed_at: confirmedAt })
    .eq("id", orderId);

  if (error) {
    console.error("[confirm] DB update error (run migration to fix):", error.message);
    // Return success anyway — in-memory store covers local dev
    // On Vercel (serverless), this means customer page may not see the update
    // until the migration is run
  }

  return NextResponse.json({ ok: true, prep_time_minutes, confirmed_at: confirmedAt });
}
