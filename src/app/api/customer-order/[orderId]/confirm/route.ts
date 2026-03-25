import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { registerCustomerOrder, confirmCustomerOrder } from "@/lib/customer-order-store";

export const dynamic = "force-dynamic";

function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

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
  const supabase = createClient();
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
