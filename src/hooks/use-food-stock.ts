"use client";

import { useState, useEffect, useCallback } from "react";
import type { FoodStock } from "@/types";

export function useFoodStock(restaurantId?: string) {
  const [stock, setStock] = useState<FoodStock[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStock = useCallback(async () => {
    if (!restaurantId) { setStock([]); return; }
    setLoading(true);
    const res = await fetch(`/api/food-stock?restaurant_id=${restaurantId}`);
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();

    const items: FoodStock[] = (json.items ?? []).map((item: {
      ingredient_id: string;
      ingredient: Record<string, unknown> | null;
      quantity: number;
      updated_at: string | null;
      stock_id: string | null;
    }) => ({
      id: item.stock_id ?? `virtual-${item.ingredient_id}`,
      ingredient_id: item.ingredient_id,
      restaurant_id: restaurantId,
      quantity: item.quantity,
      updated_at: item.updated_at ?? new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ingredients: item.ingredient as any,
    }));

    setStock(items);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { loadStock(); }, [loadStock]);

  const upsert = async (ingredientId: string, quantity: number) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const res = await fetch("/api/food-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId, ingredient_id: ingredientId, quantity }),
    });
    const json = await res.json();
    if (json.error) return { error: new Error(json.error) };
    loadStock();
    return { error: null };
  };

  const adjustStock = async (ingredientId: string, delta: number) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const existing = stock.find((s) => s.ingredient_id === ingredientId);
    const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
    return upsert(ingredientId, newQty);
  };

  return { stock, loading, upsert, adjustStock, refresh: loadStock };
}
