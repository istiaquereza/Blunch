"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InventoryGroup } from "@/types";

export function useInventoryGroups(restaurantId?: string) {
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("inventory_groups")
      .select("*")
      .order("name");
    if (data) setGroups(data);
    setLoading(false);
  }, []);

  const create = async (name: string) => {
    const supabase = createClient();
    // No restaurant_id — inventory groups are universal
    const { error } = await supabase
      .from("inventory_groups")
      .insert({ name });
    if (!error) await fetch();
    return { error };
  };

  const update = async (id: string, name: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory_groups")
      .update({ name })
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("inventory_groups")
      .delete()
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { groups, loading, create, update, remove, refresh: fetch };
}
