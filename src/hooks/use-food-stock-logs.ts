"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface FoodStockLog {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  order_id?: string | null;
  order_number?: string | null;
  food_item_name?: string | null;
  quantity_change: number;
  reason: string;
  created_at: string;
}

export function useFoodStockLogs(restaurantId?: string) {
  const [logs, setLogs] = useState<FoodStockLog[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchLogs = useCallback(
    async (ingredientId: string, dateFrom?: string, dateTo?: string) => {
      if (!restaurantId) return;
      setLoading(true);

      const params = new URLSearchParams({ ingredient_id: ingredientId, restaurant_id: restaurantId });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await fetch(`/api/food-stock-logs?${params}`);
      const json = await res.json();
      setLogs((json.logs ?? []) as FoodStockLog[]);
      setLoading(false);
    },
    [restaurantId]
  );

  const createLog = async (payload: {
    ingredient_id: string;
    quantity_change: number;
    reason: string;
    created_at?: string;
  }) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const res = await fetch("/api/food-stock-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        ingredient_id: payload.ingredient_id,
        quantity_change: payload.quantity_change,
        reason: payload.reason,
        created_at: payload.created_at,
      }),
    });
    const json = await res.json();
    return { error: json.error ? new Error(json.error) : null };
  };

  // Order-driven logs still written directly (called from order processing)
  const createLogDirect = async (payload: {
    ingredient_id: string;
    quantity_change: number;
    reason: string;
    order_id?: string;
    order_number?: string;
    food_item_name?: string;
    created_at?: string;
  }) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const insert: Record<string, unknown> = {
      restaurant_id: restaurantId,
      ingredient_id: payload.ingredient_id,
      quantity_change: payload.quantity_change,
      reason: payload.reason,
    };
    if (payload.order_id) insert.order_id = payload.order_id;
    if (payload.order_number) insert.order_number = payload.order_number;
    if (payload.food_item_name) insert.food_item_name = payload.food_item_name;
    if (payload.created_at) insert.created_at = payload.created_at;
    const { error } = await supabase.from("food_stock_logs").insert(insert);
    return { error };
  };

  const clearLogs = () => setLogs([]);

  return { logs, loading, fetchLogs, createLog, clearLogs };
}
