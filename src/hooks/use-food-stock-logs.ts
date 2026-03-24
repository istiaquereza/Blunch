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
      let q = supabase
        .from("food_stock_logs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("ingredient_id", ingredientId)
        .order("created_at", { ascending: false });

      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo);

      const { data } = await q;
      setLogs((data as FoodStockLog[]) ?? []);
      setLoading(false);
    },
    [restaurantId]
  );

  const createLog = async (payload: {
    ingredient_id: string;
    quantity_change: number;
    reason: string;
    created_at?: string; // allow backdating
  }) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const insert: Record<string, unknown> = {
      restaurant_id: restaurantId,
      ingredient_id: payload.ingredient_id,
      quantity_change: payload.quantity_change,
      reason: payload.reason,
    };
    if (payload.created_at) insert.created_at = payload.created_at;
    const { error } = await supabase.from("food_stock_logs").insert(insert);
    return { error };
  };

  const clearLogs = () => setLogs([]);

  return { logs, loading, fetchLogs, createLog, clearLogs };
}
