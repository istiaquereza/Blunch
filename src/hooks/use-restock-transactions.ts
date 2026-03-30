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

      // Escape special SQL characters in ingredient name
      const safeName = ingredientName.replace(/[%_]/g, "\\$&");

      let q = supabase
        .from("transactions")
        .select("id, transaction_date, created_at, amount, description")
        .eq("restaurant_id", restaurantId)
        .eq("type", "expense")
        .ilike("description", `Stock restock: ${safeName}%`)
        .order("transaction_date", { ascending: false });

      // transaction_date is YYYY-MM-DD — extract date part from ISO string
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

  const clear = () => setEntries([]);

  return { entries, loading, fetchEntries, clear };
}
