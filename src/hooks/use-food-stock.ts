"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FoodStock } from "@/types";

export function useFoodStock(restaurantId?: string) {
  const [stock, setStock] = useState<FoodStock[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setStock([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("food_stock")
      .select("*, ingredients(id, name, default_unit, unit_price, unit_type, inventory_group_id, inventory_groups(id, name))")
      .eq("restaurant_id", restaurantId)
      .order("updated_at", { ascending: false });
    setStock(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (ingredientId: string, quantity: number) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const { error } = await supabase
      .from("food_stock")
      .upsert(
        { ingredient_id: ingredientId, restaurant_id: restaurantId, quantity, updated_at: new Date().toISOString() },
        { onConflict: "ingredient_id,restaurant_id" }
      );
    if (!error) fetch();
    return { error };
  };

  const adjustStock = async (ingredientId: string, delta: number) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const existing = stock.find((s) => s.ingredient_id === ingredientId);
    const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
    return upsert(ingredientId, newQty);
  };

  return { stock, loading, upsert, adjustStock, refresh: fetch };
}
