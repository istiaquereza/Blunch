"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PrintSettings {
  id: string;
  restaurant_id: string;
  show_logo: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_social: boolean;
  biin: string | null;
  greeting: string | null;
  created_at: string;
  updated_at: string;
}

const defaults: Omit<PrintSettings, "id" | "restaurant_id" | "created_at" | "updated_at"> = {
  show_logo: true,
  show_address: true,
  show_phone: true,
  show_social: false,
  biin: null,
  greeting: null,
};

export function usePrintSettings(restaurantId?: string) {
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setSettings(null); return; }
    setLoading(true);
    const { data } = await supabase
      .from("print_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    setSettings(data);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = async (payload: Omit<PrintSettings, "id" | "created_at" | "updated_at" | "restaurant_id">) => {
    const { error } = await supabase
      .from("print_settings")
      .upsert({ ...payload, restaurant_id: restaurantId }, { onConflict: "restaurant_id" });
    if (!error) fetch();
    return { error };
  };

  return { settings, loading, save, defaults, refresh: fetch };
}
