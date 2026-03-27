"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppUserRole, AppUserRoleType } from "@/types";

export function useRestaurantMembers(restaurantId?: string) {
  const [members, setMembers] = useState<AppUserRole[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!restaurantId) { setMembers([]); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("app_user_roles")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at");
    if (data) setMembers(data as AppUserRole[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  /** Add or invite a member. Creates their Supabase auth account if they don't have one. */
  const addMember = async (payload: {
    email: string;
    name: string;
    role: AppUserRoleType;
    password: string;
  }) => {
    if (!restaurantId) return { error: new Error("No restaurant selected") };

    const res = await globalThis.fetch("/api/app-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        restaurant_id: restaurantId,
      }),
    });
    const json = await res.json();
    if (!res.ok) return { error: new Error(json.error ?? "Failed to add member") };
    await loadMembers();
    return { error: null };
  };

  const updateRole = async (id: string, role: AppUserRoleType) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("app_user_roles")
      .update({ role })
      .eq("id", id);
    if (!error) await loadMembers();
    return { error };
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("app_user_roles")
      .update({ is_active })
      .eq("id", id);
    if (!error) await loadMembers();
    return { error };
  };

  const removeMember = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("app_user_roles")
      .delete()
      .eq("id", id);
    if (!error) await loadMembers();
    return { error };
  };

  return { members, loading, addMember, updateRole, toggleActive, removeMember, refresh: loadMembers };
}
