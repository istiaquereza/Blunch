import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/restaurants
// Returns ALL restaurants (service role bypasses RLS).
// Protected: caller must supply a valid Supabase JWT as Bearer token
// and must be a super_admin (or have no role entries — original creator).
export async function GET(req: NextRequest) {
  // 1. Extract Bearer token from Authorization header
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 2. Verify the token and get the user
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Check super_admin role (or no entries → original creator)
  const { data: allRoleRows } = await admin
    .from("app_user_roles")
    .select("role, is_active")
    .ilike("email", user.email);

  const activeRoles = (allRoleRows ?? []).filter((r) => r.is_active);
  const hasSuperAdminRole = activeRoles.some((r) => r.role === "super_admin");
  const hasNoRoleEntries = (allRoleRows ?? []).length === 0;

  if (!hasSuperAdminRole && !hasNoRoleEntries) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Fetch ALL restaurants using service role (bypasses RLS)
  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select("*")
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ restaurants });
}
