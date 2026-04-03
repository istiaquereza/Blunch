"use client";

import { useState, useCallback } from "react";

export interface RestockEntry {
  id: string;
  date: string;
  createdAt: string;
  qty: number;
  amount: number;
  description: string;
  source: "logs" | "transactions";
}

export function useRestockTransactions(restaurantId?: string) {
  const [entries, setEntries] = useState<RestockEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(
    async (ingredientId: string, ingredientName: string, unitPrice: number, dateFrom?: string, dateTo?: string) => {
      setLoading(true);

      const params = new URLSearchParams({
        ingredient_id: ingredientId,
        unit_price: String(unitPrice),
        name: ingredientName,
      });
      if (restaurantId) params.set("restaurant_id", restaurantId);
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
        description: (tx.description ?? "") as string,
        source: (tx.source ?? "logs") as "logs" | "transactions",
      }));

      setEntries(parsed);
      setLoading(false);
    },
    [restaurantId]
  );

  const updateEntry = async (
    entry: RestockEntry,
    newQty: number,
    newDate: string,
    ingredientName: string,
    unitPrice: number,
    unit: string
  ) => {
    const res = await fetch("/api/restock-transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        source: entry.source,
        new_qty: newQty,
        new_date: newDate,
        ingredient_name: ingredientName,
        unit_price: unitPrice,
        unit,
        restaurant_id: restaurantId,
      }),
    });
    const json = await res.json();
    if (json.error) return { error: new Error(json.error), oldQty: entry.qty, newQty, newAmount: 0 };
    return { error: null, oldQty: json.oldQty as number, newQty: json.newQty as number, newAmount: json.newAmount as number };
  };

  const deleteEntry = async (entry: RestockEntry, ingredientName?: string) => {
    const params = new URLSearchParams({ id: entry.id, source: entry.source });
    if (ingredientName) params.set("ingredient_name", ingredientName);
    if (restaurantId) params.set("restaurant_id", restaurantId);

    const res = await fetch(`/api/restock-transactions?${params}`, { method: "DELETE" });
    const json = await res.json();
    return { error: json.error ? new Error(json.error) : null };
  };

  const clear = () => setEntries([]);

  return { entries, loading, fetchEntries, updateEntry, deleteEntry, clear };
}
