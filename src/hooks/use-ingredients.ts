"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ingredient } from "@/types";

export function useIngredients(restaurantId?: string) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!restaurantId) { setIngredients([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("ingredients")
      .select("*, inventory_groups(id, name)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    if (data) setIngredients(data);
    setLoading(false);
  }, [restaurantId]);

  const create = async (data: Omit<Ingredient, "id" | "created_at">) => {
    const supabase = createClient();
    const { error } = await supabase.from("ingredients").insert(data);
    if (!error) await fetch();
    return { error };
  };

  const update = async (id: string, data: Partial<Ingredient>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("ingredients")
      .update(data)
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("ingredients")
      .delete()
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { ingredients, loading, create, update, remove, refresh: fetch };
}
