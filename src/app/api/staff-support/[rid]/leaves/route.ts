import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function createAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = createAdmin();
  const url = new URL(req.url);
  const staffId = url.searchParams.get("staff_id");

  let q = supabase
    .from("staff_leaves")
    .select("*, staff(id, name)")
    .eq("restaurant_id", rid)
    .order("leave_date", { ascending: false });

  if (staffId) q = q.eq("staff_id", staffId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaves: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = createAdmin();
  const body = await req.json();
  const { staff_id, leave_date, leave_date_end, leave_type, notes } = body;

  if (!staff_id || !leave_date || !leave_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Build rows (one per day if range)
  const rows: object[] = [];
  const [sy, sm, sd] = leave_date.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = leave_date_end
    ? (() => { const [ey, em, ed] = leave_date_end.split("-").map(Number); return new Date(ey, em - 1, ed); })()
    : start;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    rows.push({ restaurant_id: rid, staff_id, leave_date: ymd, leave_type, notes: notes ?? null });
  }

  const { error } = await supabase.from("staff_leaves").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = createAdmin();
  const url = new URL(req.url);
  const leaveId = url.searchParams.get("leave_id");

  if (!leaveId) return NextResponse.json({ error: "leave_id required" }, { status: 400 });

  const { error } = await supabase
    .from("staff_leaves")
    .delete()
    .eq("id", leaveId)
    .eq("restaurant_id", rid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
