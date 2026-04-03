"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ingredient } from "@/types";

export function useIngredients(restaurantId?: string, allRestaurants = false) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("ingredients")
      .select("*, inventory_groups(id, name)")
      .order("name");
    if (data) setIngredients(data);
    setLoading(false);
  }, []);

  const create = async (data: Omit<Ingredient, "id" | "created_at">) => {
    const supabase = createClient();
    // Strip restaurant_id — ingredients are universal
    const { restaurant_id: _rid, ...universal } = data as any;
    const { error } = await supabase.from("ingredients").insert(universal);
    if (!error) await fetch();
    return { error };
  };

  const update = async (id: string, data: Partial<Ingredient>) => {
    const supabase = createClient();
    const oldIngredient = data.name ? ingredients.find((i) => i.id === id) : undefined;
    const oldName = oldIngredient?.name;
    const { error } = await supabase
      .from("ingredients")
      .update(data)
      .eq("id", id);
    if (!error) {
      await fetch();
      // Sync historical restock transaction descriptions when name changes
      const newName = data.name;
      if (newName && oldName && oldName !== newName) {
        const { data: txs } = await supabase
          .from("transactions")
          .select("id, description")
          .ilike("description", `Stock restock: ${oldName.replace(/[%_]/g, "\\$&")} +%`);
        if (txs?.length) {
          await Promise.all(
            txs.map((tx: { id: string; description: string }) => {
              const newDesc = tx.description.replace(
                `Stock restock: ${oldName}`,
                `Stock restock: ${newName}`
              );
              return supabase.from("transactions").update({ description: newDesc }).eq("id", tx.id);
            })
          );
        }
      }
    }
    return { error };
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("ingredients")
      .delete()
      .eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { ingredients, loading, create, update, remove, refresh: fetch };
}
