"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface BillingSettings {
  id: string;
  restaurant_id: string;
  vat_percentage: number;
  vat_apply_on: "order" | "item";
  service_charge_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Discount {
  id: string;
  restaurant_id: string;
  name: string;
  discount_type: "percentage" | "amount";
  discount_value: number;
  apply_on: "order" | "item";
  food_item_id?: string;
  is_active: boolean;
  created_at: string;
}

export function useBillingSettings(restaurantId?: string) {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setSettings(null); return; }
    setLoading(true);
    const { data } = await supabase
      .from("billing_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    setSettings(data);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (payload: Omit<BillingSettings, "id" | "created_at" | "updated_at" | "restaurant_id">) => {
    const { error } = await supabase
      .from("billing_settings")
      .upsert({ ...payload, restaurant_id: restaurantId }, { onConflict: "restaurant_id" });
    if (!error) fetch();
    return { error };
  };

  return { settings, loading, save, refresh: fetch };
}

export function useDiscounts(restaurantId?: string) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setDiscounts([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("discounts")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setDiscounts(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload: Omit<Discount, "id" | "created_at" | "restaurant_id">) => {
    const { error } = await supabase.from("discounts").insert({ ...payload, restaurant_id: restaurantId });
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: Partial<Omit<Discount, "id" | "created_at" | "restaurant_id">>) => {
    const { error } = await supabase.from("discounts").update(payload).eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { discounts, loading, create, update, remove, refresh: fetch };
}
