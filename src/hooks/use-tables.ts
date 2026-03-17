"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: string; // original schema column
  name: string;         // added via migration (mirrors table_number)
  capacity: number;     // added via migration
  is_active: boolean;
  created_at: string;
}

export function useTables(restaurantId?: string) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setTables([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    // Normalise: ensure .name is always set (fallback to table_number)
    const rows = (data ?? []).map((t: Table) => ({ ...t, name: t.name ?? t.table_number ?? "" }));
    setTables(rows);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string, capacity: number) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const { error } = await supabase.from("tables").insert({
      name,
      table_number: name,  // keep table_number in sync
      capacity,
      restaurant_id: restaurantId,
      is_active: true,
    });
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: Partial<Pick<Table, "name" | "capacity" | "is_active">>) => {
    const patch: Record<string, unknown> = { ...payload };
    if (payload.name) patch.table_number = payload.name; // keep in sync
    const { error } = await supabase.from("tables").update(patch).eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { tables, loading, create, update, remove, refresh: fetch };
}
