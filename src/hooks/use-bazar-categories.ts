"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface BazarCategory {
  id: string;
  name: string;
  restaurant_id?: string;
  user_id?: string;
  created_at: string;
}

export function useBazarCategories(restaurantId?: string) {
  const [categories, setCategories] = useState<BazarCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setCategories([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("bazar_categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setCategories(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string): Promise<{ data: BazarCategory | null; error: Error | null }> => {
    if (!restaurantId) return { error: new Error("No restaurant"), data: null };
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("bazar_categories")
      .insert({ name: name.trim(), restaurant_id: restaurantId, user_id: user?.id })
      .select()
      .single();
    if (!error) fetch();
    return { data: data as BazarCategory | null, error: error as Error | null };
  };

  const update = async (id: string, name: string) => {
    const { error } = await supabase
      .from("bazar_categories")
      .update({ name: name.trim() })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("bazar_categories")
      .delete()
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { categories, loading, create, update, remove, refresh: fetch };
}
