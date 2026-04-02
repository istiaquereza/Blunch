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

export async function GET(_req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = createAdmin();

  const { data, error } = await supabase
    .from("product_requisitions")
    .select(`*, product_requisition_items(*, ingredients(id, name, default_unit, unit_price))`)
    .eq("restaurant_id", rid)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requisitions: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = createAdmin();
  const body = await req.json();
  const { notes, items, submitter_name } = body;

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  // Try with source + submitter_name columns first
  let req_row: Record<string, unknown> | null = null;
  const basePayload: Record<string, unknown> = {
    restaurant_id: rid,
    requisition_date: today,
    notes: notes ?? null,
    status: "submitted",
    payment_status: "due",
  };

  const { data: withExtra, error: extraErr } = await supabase
    .from("product_requisitions")
    .insert({ ...basePayload, source: "daily_bazar", submitter_name: submitter_name ?? null })
    .select()
    .single();

  if (!extraErr && withExtra) {
    req_row = withExtra;
  } else {
    const { data: basic, error: basicErr } = await supabase
      .from("product_requisitions")
      .insert(basePayload)
      .select()
      .single();
    if (basicErr || !basic) return NextResponse.json({ error: basicErr?.message ?? "Failed" }, { status: 500 });
    req_row = basic;
  }

  const rows = (items as { ingredient_id: string; quantity: number; unit_price: number; unit?: string }[]).map(
    ({ ...i }) => ({ ...i, requisition_id: req_row!.id })
  );
  const { error: itemsErr } = await supabase.from("product_requisition_items").insert(rows);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  return NextResponse.json({ id: req_row!.id }, { status: 201 });
}
