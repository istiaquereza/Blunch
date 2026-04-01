"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RestockEntry {
  id: string;
  date: string; // transaction_date YYYY-MM-DD
  createdAt: string; // created_at ISO timestamp for accurate time display
  qty: number;
  amount: number;
  description: string;
}

export function useRestockTransactions(restaurantId?: string) {
  const [entries, setEntries] = useState<RestockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchEntries = useCallback(
    async (ingredientName: string, dateFrom?: string, dateTo?: string) => {
      if (!restaurantId) return;
      setLoading(true);

      const safeName = ingredientName.replace(/[%_]/g, "\\$&");

      let q = supabase
        .from("transactions")
        .select("id, transaction_date, created_at, amount, description")
        .eq("restaurant_id", restaurantId)
        .eq("type", "expense")
        .ilike("description", `Stock restock: ${safeName}%`)
        .order("transaction_date", { ascending: false });

      if (dateFrom) q = q.gte("transaction_date", dateFrom.split("T")[0]);
      if (dateTo) q = q.lte("transaction_date", dateTo.split("T")[0]);

      const { data } = await q;

      const parsed: RestockEntry[] = (data ?? []).map((tx: Record<string, unknown>) => {
        const desc = (tx.description as string) ?? "";
        const match = desc.match(/\+([0-9.]+)/);
        const qty = match ? parseFloat(match[1]) : 0;
        return {
          id: tx.id as string,
          date: tx.transaction_date as string,
          createdAt: tx.created_at as string,
          qty,
          amount: tx.amount as number,
          description: desc,
        };
      });

      setEntries(parsed);
      setLoading(false);
    },
    [restaurantId]
  );

  // Update a restock transaction: new qty and/or new date
  // ingredientName and unitPrice are used to recalculate description + amount
  const updateEntry = async (
    entry: RestockEntry,
    newQty: number,
    newDate: string,
    ingredientName: string,
    unitPrice: number,
    unit: string
  ) => {
    const newAmount = parseFloat((newQty * unitPrice).toFixed(2));
    const newDesc = `Stock restock: ${ingredientName} +${newQty.toFixed(2)} ${unit}`;
    const { error } = await supabase
      .from("transactions")
      .update({ amount: newAmount, description: newDesc, transaction_date: newDate })
      .eq("id", entry.id);
    return { error, oldQty: entry.qty, newQty, newAmount };
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    return { error };
  };

  const clear = () => setEntries([]);

  return { entries, loading, fetchEntries, updateEntry, deleteEntry, clear };
}
