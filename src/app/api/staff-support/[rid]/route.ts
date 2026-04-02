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

  const [{ data: restaurant }, { data: staff }] = await Promise.all([
    supabase.from("restaurants").select("id, name").eq("id", rid).single(),
    supabase.from("staff").select("id, name, job_role, photo_url").eq("restaurant_id", rid).order("name"),
  ]);

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  return NextResponse.json({ restaurant, staff: staff ?? [] });
}
