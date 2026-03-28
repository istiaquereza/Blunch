"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface DashboardDataResult {
  txData: any[];
  orderData: any[];
  prevTxData: any[];
  prevOrderData: any[];
  dueData: any[];
}

/**
 * Fetches dashboard orders + transactions via the admin client (bypasses RLS).
 * Only called for super admins who need cross-restaurant access.
 * Token is verified server-side before any data is returned.
 */
export async function fetchAdminDashboardData(
  accessToken: string,
  rIds: string[],
  from: string | null,
  to: string | null,
  pFrom: string | null,
  pTo: string | null,
): Promise<DashboardDataResult> {
  const empty = { txData: [], orderData: [], prevTxData: [], prevOrderData: [], dueData: [] };
  if (!accessToken || !rIds.length) return empty;

  const admin = createAdminClient();

  // Verify token
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user?.email) return empty;

  // Verify super_admin role
  const { data: roleRows } = await admin
    .from("app_user_roles")
    .select("role, is_active")
    .ilike("email", user.email);

  const active = (roleRows ?? []).filter((r: any) => r.is_active);
  const isSuperAdmin = active.some((r: any) => r.role === "super_admin") || (roleRows ?? []).length === 0;
  if (!isSuperAdmin) return empty;

  // ── Transactions (current period) ──
  let txQ = admin
    .from("transactions")
    .select("*, expense_categories(id,name,type), payment_methods!transactions_payment_method_id_fkey(id,name)")
    .in("restaurant_id", rIds)
    .order("transaction_date", { ascending: false });
  if (from && to) txQ = (txQ as any).gte("transaction_date", from).lte("transaction_date", to);

  // ── Orders (current period) ──
  const localTs = (d: string, end = false) =>
    end ? `${d}T23:59:59+06:00` : `${d}T00:00:00+06:00`;

  let orderQ = admin
    .from("orders")
    .select("*, order_items(*, food_items(id,name,sell_price))")
    .in("restaurant_id", rIds)
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  if (from && to) orderQ = (orderQ as any).gte("created_at", localTs(from)).lte("created_at", localTs(to, true));

  // ── Prev period ──
  let prevTxQ = admin.from("transactions").select("type, amount").in("restaurant_id", rIds);
  if (pFrom && pTo) prevTxQ = (prevTxQ as any).gte("transaction_date", pFrom).lte("transaction_date", pTo);

  let prevOrderQ = admin.from("orders").select("id, total").in("restaurant_id", rIds).eq("status", "completed");
  if (pFrom && pTo) prevOrderQ = (prevOrderQ as any).gte("created_at", localTs(pFrom)).lte("created_at", localTs(pTo, true));

  // ── Due payments ──
  let dueQ = admin
    .from("transactions")
    .select("*, expense_categories(id,name,type), payment_methods!transactions_payment_method_id_fkey(id,name)")
    .in("restaurant_id", rIds)
    .eq("status", "due")
    .order("transaction_date", { ascending: true });

  const [
    { data: txData },
    { data: orderData },
    { data: prevTxData },
    { data: prevOrderData },
    { data: dueData },
  ] = await Promise.all([
    txQ,
    orderQ,
    from ? prevTxQ : Promise.resolve({ data: [] }),
    from ? prevOrderQ : Promise.resolve({ data: [] }),
    dueQ,
  ]);

  return {
    txData: txData ?? [],
    orderData: orderData ?? [],
    prevTxData: prevTxData ?? [],
    prevOrderData: prevOrderData ?? [],
    dueData: dueData ?? [],
  };
}
