"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Asset, AssetCheckin } from "@/types";

export function useAssets(restaurantId?: string) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setAssets([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("assets")
      .select("*, asset_groups(id, name)")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    setAssets(data ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload: Omit<Asset, "id" | "created_at" | "updated_at" | "asset_groups">) => {
    const { error } = await supabase.from("assets").insert(payload);
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: Partial<Omit<Asset, "id" | "created_at" | "updated_at" | "asset_groups">>) => {
    const { error } = await supabase.from("assets").update(payload).eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { assets, loading, create, update, remove, refresh: fetch };
}

export function useAssetCheckins(assetId?: string) {
  const [checkins, setCheckins] = useState<AssetCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!assetId) { setCheckins([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("asset_checkins")
      .select("*")
      .eq("asset_id", assetId)
      .order("checkin_date", { ascending: false });
    setCheckins(data ?? []);
    setLoading(false);
  }, [assetId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCheckin = async (payload: { asset_id: string; checkin_date: string; quantity_in: number; quantity_out: number; note?: string }) => {
    const { error } = await supabase.from("asset_checkins").insert(payload);
    if (!error) fetch();
    return { error };
  };

  return { checkins, loading, addCheckin, refresh: fetch };
}
