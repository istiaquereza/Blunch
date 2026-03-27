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
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const userEmail = userData.user?.email?.toLowerCase();

    // Insert restaurant
    const { data: created, error } = await supabase
      .from("restaurants")
      .insert({ ...data, user_id: userId })
      .select()
      .single();

    // Auto-assign creator as owner in app_user_roles
    if (!error && created && userEmail) {
      await supabase.from("app_user_roles").upsert(
        {
          restaurant_id: created.id,
          email: userEmail,
          name: userEmail.split("@")[0],
          role: "owner",
          is_active: true,
        },
        { onConflict: "restaurant_id,email" }
      );
    }

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
