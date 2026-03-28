"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Restaurant } from "@/types";

/**
 * Server action: returns ALL restaurants for super_admin users.
 * Accepts the user's JWT so auth works regardless of cookie forwarding.
 */
export async function getAllRestaurants(accessToken: string): Promise<Restaurant[]> {
  if (!accessToken) return [];

  const admin = createAdminClient();

  // 1. Verify the token with the admin auth client
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user?.email) return [];

  // 2. Check super_admin role OR no entries (original creator)
  const { data: roleRows } = await admin
    .from("app_user_roles")
    .select("role, is_active")
    .ilike("email", user.email);

  const active = (roleRows ?? []).filter((r) => r.is_active);
  const isSuperAdmin = active.some((r) => r.role === "super_admin");
  const hasNoEntries = (roleRows ?? []).length === 0;

  if (!isSuperAdmin && !hasNoEntries) return [];

  // 3. Fetch ALL restaurants bypassing RLS
  const { data } = await admin
    .from("restaurants")
    .select("*")
    .order("created_at");

  return data ?? [];
}
