"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  restaurant_id: string;
  created_at: string;
  updated_at: string;
}

export function useCustomers(restaurantId?: string) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setCustomers([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setCustomers(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string, phone?: string) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const { error } = await supabase.from("customers").insert({ name, phone: phone || null, restaurant_id: restaurantId });
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, name: string, phone?: string) => {
    const { error } = await supabase.from("customers").update({ name, phone: phone || null }).eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { customers, loading, create, update, remove, refresh: fetch };
}
