"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FoodCategory } from "@/types";

export function useFoodCategories(restaurantId?: string) {
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!restaurantId) { setCategories([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("food_categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    if (data) setCategories(data);
    setLoading(false);
  }, [restaurantId]);

  const create = async (name: string, restaurantId: string) => {
    const supabase = createClient();
    const { error, data } = await supabase
      .from("food_categories")
      .insert({ name, restaurant_id: restaurantId, is_active: true })
      .select()
      .single();
    if (!error) await fetch();
    return { error, data };
  };

  const update = async (id: string, data: Partial<FoodCategory>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("food_categories")
      .update(data)
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("food_categories")
      .delete()
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { categories, loading, create, update, remove, refresh: fetch };
}
