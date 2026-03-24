"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vendor } from "@/types";

export function useVendors(restaurantId?: string) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setVendors([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name", { ascending: true });
    setVendors(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload: { name: string; phone: string; address: string }) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const { error } = await supabase
      .from("vendors")
      .insert({ ...payload, restaurant_id: restaurantId });
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: { name: string; phone: string; address: string }) => {
    const { error } = await supabase
      .from("vendors")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { vendors, loading, create, update, remove, refresh: fetch };
}
