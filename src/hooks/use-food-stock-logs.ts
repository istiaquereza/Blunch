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
    async (ingredientId: string) => {
      if (!restaurantId) return;
      setLoading(true);
      const { data } = await supabase
        .from("food_stock_logs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("ingredient_id", ingredientId)
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs((data as FoodStockLog[]) ?? []);
      setLoading(false);
    },
    [restaurantId]
  );

  const clearLogs = () => setLogs([]);

  return { logs, loading, fetchLogs, clearLogs };
}
