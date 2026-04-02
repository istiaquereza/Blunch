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

export async function PUT(req: Request, { params }: { params: Promise<{ rid: string; reqId: string }> }) {
  const { reqId } = await params;
  const supabase = createAdmin();
  const body = await req.json();
  const { notes, items } = body;

  // Check status – only allow editing submitted/pending
  const { data: existing } = await supabase
    .from("product_requisitions")
    .select("status")
    .eq("id", reqId)
    .single();

  if (existing?.status === "approved") {
    return NextResponse.json({ error: "Cannot edit approved requisition" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("product_requisitions")
    .update({ notes: notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", reqId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (items) {
    await supabase.from("product_requisition_items").delete().eq("requisition_id", reqId);
    const rows = (items as { ingredient_id: string; quantity: number; unit_price: number; unit?: string }[]).map(
      (i) => ({ ...i, requisition_id: reqId })
    );
    const { error: itemsErr } = await supabase.from("product_requisition_items").insert(rows);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ rid: string; reqId: string }> }) {
  const { reqId } = await params;
  const supabase = createAdmin();

  const { data: existing } = await supabase
    .from("product_requisitions")
    .select("status")
    .eq("id", reqId)
    .single();

  if (existing?.status === "approved") {
    return NextResponse.json({ error: "Cannot delete approved requisition" }, { status: 400 });
  }

  await supabase.from("product_requisition_items").delete().eq("requisition_id", reqId);
  const { error } = await supabase.from("product_requisitions").delete().eq("id", reqId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
