"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RestockEntry {
  id: string;
  date: string;
  createdAt: string;
  qty: number;
  amount: number;
  description: string;
}

export function useRestockTransactions(restaurantId?: string) {
  const [entries, setEntries] = useState<RestockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchEntries = useCallback(
    async (ingredientId: string, ingredientName: string, unitPrice: number, dateFrom?: string, dateTo?: string) => {
      setLoading(true);

      const params = new URLSearchParams({
        ingredient_id: ingredientId,
        unit_price: String(unitPrice),
      });
      if (dateFrom) params.set("from", dateFrom.split("T")[0]);
      if (dateTo) params.set("to", dateTo.split("T")[0]);

      const res = await fetch(`/api/restock-transactions?${params}`);
      const json = await res.json();
      const data = json.entries ?? [];

      const parsed: RestockEntry[] = data.map((tx: Record<string, unknown>) => ({
        id: tx.id as string,
        date: tx.transaction_date as string,
        createdAt: tx.created_at as string,
        qty: tx.quantity_change as number,
        amount: tx.amount as number,
        description: tx.description as string,
      }));

      setEntries(parsed);
      setLoading(false);
    },
    []
  );

  const updateEntry = async (
    entry: RestockEntry,
    newQty: number,
    newDate: string,
    ingredientName: string,
    unitPrice: number,
    unit: string
  ) => {
    const newCreatedAt = new Date(newDate + "T12:00:00").toISOString();
    const newAmount = parseFloat((newQty * unitPrice).toFixed(2));
    const { error } = await supabase
      .from("food_stock_logs")
      .update({ quantity_change: newQty, created_at: newCreatedAt })
      .eq("id", entry.id);
    return { error, oldQty: entry.qty, newQty, newAmount };
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("food_stock_logs").delete().eq("id", id);
    return { error };
  };

  const clear = () => setEntries([]);

  return { entries, loading, fetchEntries, updateEntry, deleteEntry, clear };
}
