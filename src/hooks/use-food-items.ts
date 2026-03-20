"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FoodItem } from "@/types";

export function useFoodItems(restaurantId?: string) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!restaurantId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("food_items")
      .select(`
        *,
        food_categories(id, name),
        food_item_restaurants!inner(restaurant_id),
        food_item_ingredients(*, ingredients(*)),
        food_item_addons(*),
        food_item_option_groups(*, food_item_options(*))
      `)
      .eq("food_item_restaurants.restaurant_id", restaurantId)
      .order("name");
    if (data) setItems(data);
    setLoading(false);
  }, [restaurantId]);

  // Create food item with all relations
  const create = async (
    itemData: Partial<FoodItem>,
    restaurantIds: string[],
    ingredients: { ingredient_id: string; quantity: number; unit: string }[],
    addons: { name: string; price: number }[],
    optionGroups: { name: string; options: string[] }[]
  ) => {
    const supabase = createClient();

    // 1. Insert food item
    const { data: newItem, error: itemError } = await supabase
      .from("food_items")
      .insert({
        name: itemData.name,
        food_category_id: itemData.food_category_id || null,
        sell_price: itemData.sell_price ?? 0,
        image_url: itemData.image_url || null,
        is_active: itemData.is_active ?? true,
        is_recipe: itemData.is_recipe ?? false,
        recipe_status: itemData.recipe_status || null,
        notes: itemData.notes || null,
        availability_type: itemData.availability_type ?? "premade",
        available_quantity: itemData.available_quantity ?? 0,
      })
      .select()
      .single();

    if (itemError || !newItem) return { error: itemError };

    const id = newItem.id;

    // 2. Link restaurants
    if (restaurantIds.length > 0) {
      await supabase.from("food_item_restaurants").insert(
        restaurantIds.map((rid) => ({ food_item_id: id, restaurant_id: rid }))
      );
    }

    // 3. Insert ingredients
    if (ingredients.length > 0) {
      await supabase.from("food_item_ingredients").insert(
        ingredients.map((i) => ({ food_item_id: id, ...i }))
      );
    }

    // 4. Insert addons
    if (addons.length > 0) {
      await supabase.from("food_item_addons").insert(
        addons.map((a) => ({ food_item_id: id, ...a }))
      );
    }

    // 5. Insert option groups + options
    for (const group of optionGroups) {
      const { data: grp } = await supabase
        .from("food_item_option_groups")
        .insert({ food_item_id: id, name: group.name })
        .select()
        .single();
      if (grp && group.options.length > 0) {
        await supabase.from("food_item_options").insert(
          group.options.map((label) => ({ option_group_id: grp.id, label }))
        );
      }
    }

    await fetch();
    return { error: null };
  };

  // Update (delete relations and re-insert)
  const update = async (
    id: string,
    itemData: Partial<FoodItem>,
    restaurantIds: string[],
    ingredients: { ingredient_id: string; quantity: number; unit: string }[],
    addons: { name: string; price: number }[],
    optionGroups: { name: string; options: string[] }[]
  ) => {
    const supabase = createClient();

    await supabase.from("food_items").update({
      name: itemData.name,
      food_category_id: itemData.food_category_id || null,
      sell_price: itemData.sell_price ?? 0,
      image_url: itemData.image_url || null,
      is_active: itemData.is_active ?? true,
      is_recipe: itemData.is_recipe ?? false,
      recipe_status: itemData.recipe_status || null,
      notes: itemData.notes || null,
      availability_type: itemData.availability_type ?? "premade",
      available_quantity: itemData.available_quantity ?? 0,
    }).eq("id", id);

    await supabase.from("food_item_restaurants").delete().eq("food_item_id", id);
    await supabase.from("food_item_ingredients").delete().eq("food_item_id", id);
    await supabase.from("food_item_addons").delete().eq("food_item_id", id);
    // Delete option groups (cascade deletes options)
    await supabase.from("food_item_option_groups").delete().eq("food_item_id", id);

    if (restaurantIds.length > 0) {
      await supabase.from("food_item_restaurants").insert(
        restaurantIds.map((rid) => ({ food_item_id: id, restaurant_id: rid }))
      );
    }
    if (ingredients.length > 0) {
      await supabase.from("food_item_ingredients").insert(
        ingredients.map((i) => ({ food_item_id: id, ...i }))
      );
    }
    if (addons.length > 0) {
      await supabase.from("food_item_addons").insert(
        addons.map((a) => ({ food_item_id: id, ...a }))
      );
    }
    for (const group of optionGroups) {
      const { data: grp } = await supabase
        .from("food_item_option_groups")
        .insert({ food_item_id: id, name: group.name })
        .select()
        .single();
      if (grp && group.options.length > 0) {
        await supabase.from("food_item_options").insert(
          group.options.map((label) => ({ option_group_id: grp.id, label }))
        );
      }
    }

    await fetch();
    return { error: null };
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("food_items").delete().eq("id", id);
    if (!error) await fetch();
    return { error };
  };

  const toggleStatus = async (id: string, is_active: boolean) => {
    const supabase = createClient();
    await supabase.from("food_items").update({ is_active }).eq("id", id);
    await fetch();
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { items, loading, create, update, remove, toggleStatus, refresh: fetch };
}
