"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssetGroup } from "@/types";

export function useAssetGroups(restaurantId?: string) {
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setGroups([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("asset_groups")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setGroups(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string) => {
    if (!restaurantId) return { error: new Error("No restaurant") };
    const { error } = await supabase
      .from("asset_groups")
      .insert({ name, restaurant_id: restaurantId });
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, name: string) => {
    const { error } = await supabase
      .from("asset_groups")
      .update({ name })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("asset_groups")
      .delete()
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { groups, loading, create, update, remove, refresh: fetch };
}
