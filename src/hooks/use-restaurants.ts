"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/types";

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at");
    if (data) setRestaurants(data);
    setLoading(false);
  }, []);

  const create = async (data: Partial<Restaurant>) => {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("restaurants")
      .insert({ ...data, user_id: user.user?.id });
    if (!error) await fetch();
    return { error };
  };

  const update = async (id: string, data: Partial<Restaurant>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurants")
      .update(data)
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { restaurants, loading, create, update, remove, refresh: fetch };
}
