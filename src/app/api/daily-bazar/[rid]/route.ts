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

async function signedLogoUrl(supabase: any, rawUrl?: string | null): Promise<string | null> {
  if (!rawUrl) return null;
  const m = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?.*)?$/);
  if (!m) return rawUrl;
  const { data } = await supabase.storage.from(m[1]).createSignedUrl(decodeURIComponent(m[2]), 86400);
  return data?.signedUrl ?? rawUrl;
}

export async function GET(_req: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  const supabase = createAdmin();

  const [
    { data: restaurant },
    { data: ingredients },
    { data: vendors },
    { data: paymentMethods },
    { data: categories },
  ] = await Promise.all([
    supabase.from("restaurants").select("id, name, logo_url").eq("id", rid).single(),
    // Ingredients are shared across all restaurants — no restaurant_id filter
    supabase.from("ingredients").select("id, name, default_unit, unit_price, unit_type").order("name"),
    supabase.from("vendors").select("id, name").order("name"),
    supabase.from("payment_methods").select("id, name").eq("restaurant_id", rid).eq("is_active", true).order("name"),
    supabase.from("bazar_categories").select("id, name").eq("restaurant_id", rid).order("name"),
  ]);

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  return NextResponse.json({
    restaurant: { ...restaurant, logo_url: await signedLogoUrl(supabase, restaurant.logo_url) },
    ingredients: ingredients ?? [],
    vendors: vendors ?? [],
    paymentMethods: paymentMethods ?? [],
    categories: categories ?? [],
  });
}
