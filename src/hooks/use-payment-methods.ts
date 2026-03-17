"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PaymentMethod {
  id: string;
  restaurant_id: string;
  name: string;
  fee_type: "percentage" | "amount";
  fee_value: number;
  is_active: boolean;
  created_at: string;
}

export function usePaymentMethods(restaurantId?: string) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("payment_methods").select("*").order("name");
    if (restaurantId) q = q.eq("restaurant_id", restaurantId);
    const { data } = await q;
    setMethods(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload: Omit<PaymentMethod, "id" | "created_at" | "restaurant_id">) => {
    const { error } = await supabase.from("payment_methods").insert({ ...payload, restaurant_id: restaurantId });
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: Partial<Omit<PaymentMethod, "id" | "created_at" | "restaurant_id">>) => {
    const { error } = await supabase.from("payment_methods").update(payload).eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { methods, loading, create, update, remove, refresh: fetch };
}
