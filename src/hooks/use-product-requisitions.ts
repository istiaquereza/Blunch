"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProductRequisition, ProductRequisitionItem } from "@/types";

// Short human-readable ID: first 8 hex chars of UUID uppercased → REQ-A1B2C3D4
export function shortReqId(id: string) {
  return "REQ-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function useProductRequisitions(restaurantId?: string) {
  const [requisitions, setRequisitions] = useState<ProductRequisition[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setRequisitions([]); return; }
    setLoading(true);

    // Try with all joins first (requires migrations 20260324 + 20260328)
    const { data, error } = await supabase
      .from("product_requisitions")
      .select(`
        *,
        vendors(id, name, phone),
        payment_methods(id, name),
        bazar_categories(id, name),
        product_requisition_items(
          *,
          ingredients(id, name, default_unit, unit_price, unit_type)
        )
      `)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback: fetch without newer columns (migrations not yet applied)
      const { data: fallback } = await supabase
        .from("product_requisitions")
        .select(`
          *,
          vendors(id, name, phone),
          product_requisition_items(
            *,
            ingredients(id, name, default_unit, unit_price, unit_type)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      setRequisitions(fallback ?? []);
    } else {
      setRequisitions(data ?? []);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Find or create "Kitchen Expenses" expense category (user-scoped) ──
  const getKitchenCategoryId = async (): Promise<string | undefined> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;

    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "Kitchen Expenses")
      .eq("type", "expense")
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created } = await supabase
      .from("expense_categories")
      .insert({ name: "Kitchen Expenses", type: "expense", user_id: user.id })
      .select("id")
      .single();

    return created?.id;
  };

  const create = async (
    date: string,
    notes: string,
    items: { ingredient_id: string; quantity: number; unit_price: number; total_price?: number; unit?: string }[],
    targetRestaurantId?: string,
    payment_status: "paid" | "due" = "paid",
    vendor_id?: string,
    payment_method_id?: string,
    bazar_category_id?: string
  ) => {
    const rid = targetRestaurantId ?? restaurantId;
    if (!rid) return { error: new Error("No restaurant") };

    const insertPayload: Record<string, unknown> = { restaurant_id: rid, requisition_date: date, notes, status: "submitted", payment_status };
    if (vendor_id) insertPayload.vendor_id = vendor_id;
    if (payment_method_id) insertPayload.payment_method_id = payment_method_id;
    if (bazar_category_id) insertPayload.bazar_category_id = bazar_category_id;

    const { data: req, error: reqErr } = await supabase
      .from("product_requisitions")
      .insert(insertPayload)
      .select()
      .single();
    if (reqErr) return { error: reqErr };

    // Note: total_price is a generated column in DB, do not insert it
    const rows = items.map(({ total_price: _tp, ...i }) => ({ ...i, requisition_id: req.id }));
    const { error: itemsErr } = await supabase.from("product_requisition_items").insert(rows);
    if (itemsErr) return { error: itemsErr };

    fetch();
    return { error: null };
  };

  const updateRequisition = async (
    id: string,
    date: string,
    notes: string,
    items: { ingredient_id: string; quantity: number; unit_price: number; total_price?: number; unit?: string }[],
    payment_status?: "paid" | "due",
    vendor_id?: string,
    payment_method_id?: string,
    bazar_category_id?: string
  ) => {
    const updatePayload: Record<string, unknown> = {
      requisition_date: date,
      notes,
      updated_at: new Date().toISOString(),
      vendor_id: vendor_id ?? null,
      payment_method_id: payment_method_id ?? null,
      bazar_category_id: bazar_category_id ?? null,
    };
    if (payment_status) updatePayload.payment_status = payment_status;

    const { error: updateErr } = await supabase
      .from("product_requisitions")
      .update(updatePayload)
      .eq("id", id);
    if (updateErr) return { error: updateErr };

    // Delete existing items and re-insert
    const { error: deleteErr } = await supabase
      .from("product_requisition_items")
      .delete()
      .eq("requisition_id", id);
    if (deleteErr) return { error: deleteErr };

    const rows = items.map(({ total_price: _tp, ...i }) => ({ ...i, requisition_id: id }));
    const { error: itemsErr } = await supabase.from("product_requisition_items").insert(rows);
    if (itemsErr) return { error: itemsErr };

    fetch();
    return { error: null };
  };

  const approve = async (id: string, memoFile?: File) => {
    // Upload memo document if provided
    let memoUrl: string | undefined;
    if (memoFile) {
      const ext = memoFile.name.split(".").pop() ?? "bin";
      const path = `${id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("bazar-memos")
        .upload(path, memoFile, { upsert: true });
      if (uploadErr) {
        console.error("Memo upload error:", uploadErr);
        return { error: new Error(`Memo upload failed: ${uploadErr.message}`) };
      }
      const { data: urlData } = supabase.storage.from("bazar-memos").getPublicUrl(path);
      memoUrl = urlData.publicUrl;
    }

    // Update requisition status (+ memo_url if uploaded)
    const updatePayload: Record<string, unknown> = {
      status: "approved",
      updated_at: new Date().toISOString(),
    };
    if (memoUrl) updatePayload.memo_url = memoUrl;

    const { error } = await supabase
      .from("product_requisitions")
      .update(updatePayload)
      .eq("id", id);

    if (!error) {
      const req = requisitions.find((r) => r.id === id);
      if (req?.product_requisition_items) {
        // 1. Update food_stock for each item
        for (const item of req.product_requisition_items) {
          const { data: existing } = await supabase
            .from("food_stock")
            .select("quantity")
            .eq("ingredient_id", item.ingredient_id)
            .eq("restaurant_id", restaurantId!)
            .maybeSingle();
          const newQty = (existing?.quantity ?? 0) + item.quantity;
          await supabase
            .from("food_stock")
            .upsert(
              {
                ingredient_id: item.ingredient_id,
                restaurant_id: restaurantId!,
                quantity: newQty,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "ingredient_id,restaurant_id" }
            );
        }

        // 2. Find/create "Kitchen Expenses" category
        const categoryId = await getKitchenCategoryId();

        // 3. Create ONE consolidated transaction for the entire requisition
        const totalAmount = req.product_requisition_items.reduce((s, i) => s + i.total_price, 0);
        const sid = shortReqId(req.id);

        // Embed item names so Income & Expenses view can display them without a join
        const itemLines = req.product_requisition_items
          .map((i) => `${i.ingredients?.name ?? "Unknown"} ${i.quantity}${i.unit ? ` ${i.unit}` : ""} @৳${i.unit_price.toLocaleString("en-BD")}`)
          .join(" | ");

        const { error: txErr } = await supabase.from("transactions").insert({
          restaurant_id: restaurantId!,
          type: "expense",
          amount: totalAmount,
          description: `${sid}: ${itemLines}`,
          category_id: categoryId ?? null,
          status: req.payment_status ?? "paid",
          transaction_date: req.requisition_date,
          payment_method_id: req.payment_method_id ?? null,
        });

        if (txErr) {
          fetch();
          return { error: txErr };
        }
      }
      fetch();
    }
    return { error };
  };

  const reject = async (id: string) => {
    const { error } = await supabase
      .from("product_requisitions")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("product_requisitions")
      .delete()
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { requisitions, loading, create, updateRequisition, approve, reject, remove, refresh: fetch };
}
