import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCustomerOrder } from "@/lib/customer-order-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/customer-orders/qr?ids=id1,id2,...
 * Returns { qrIds: string[] } — which of the given order IDs are QR customer orders.
 * Uses in-memory store first (fast), then falls back to DB source column (post-migration).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) return NextResponse.json({ qrIds: [] });

  // Check in-memory store first
  const qrIds = new Set<string>(ids.filter((id) => isCustomerOrder(id)));

  // Also check DB source column (populated after migration is run)
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("id, source")
      .in("id", ids);
    for (const row of data ?? []) {
      if ((row as any).source === "customer") qrIds.add(row.id);
    }
  } catch { /* ignore — in-memory store result is still valid */ }

  return NextResponse.json({ qrIds: Array.from(qrIds) });
}
