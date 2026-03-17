"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface OrderItem {
  id: string;
  order_id: string;
  food_item_id: string;
  quantity: number;
  unit_price: number;
  addons: { name: string; price: number }[];
  options: Record<string, string>;
  notes?: string;
  created_at: string;
  food_items?: { id: string; name: string; sell_price: number } | null;
}

export interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  customer_id?: string;
  table_id?: string;
  type: "dine_in" | "takeaway";
  status: "active" | "billed" | "completed" | "cancelled";
  payment_method_id?: string;
  subtotal: number;
  discount_amount: number;
  service_charge: number;
  vat_amount: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customers?: { id: string; name: string; phone?: string } | null;
  tables?: { id: string; table_number: string } | null;
  payment_methods?: { id: string; name: string } | null;
  order_items?: OrderItem[];
}

export interface CreateOrderItemPayload {
  food_item_id: string;
  quantity: number;
  unit_price: number;
  addons?: { name: string; price: number }[];
  options?: Record<string, string>;
  notes?: string;
}

export function useOrders(
  restaurantId?: string,
  statusFilter?: string,
  dateFrom?: string,
  dateTo?: string
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) { setOrders([]); return; }
    setLoading(true);
    let q = supabase
      .from("orders")
      .select(`
        *,
        customers(id, name, phone),
        tables(id, table_number),
        payment_methods(id, name),
        order_items(*, food_items(id, name, sell_price))
      `)
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");

    const { data } = await q;
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, [restaurantId, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ─── Private: find or create "Daily Sales" income category ────────────────
  const getDailySalesCategoryId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", "daily sales")
      .limit(1);

    if (existing?.length) return existing[0].id;

    const { data: created } = await supabase
      .from("expense_categories")
      .insert({ name: "Daily Sales", type: "income", user_id: user.id })
      .select("id")
      .single();

    return created?.id ?? null;
  };

  // Create a new order with items
  const createOrder = async (
    payload: {
      type: "dine_in" | "takeaway";
      customer_id?: string;
      table_id?: string;
    },
    items: CreateOrderItemPayload[]
  ): Promise<{ data: Order | null; error: unknown }> => {
    if (!restaurantId) return { data: null, error: new Error("No restaurant") };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        type: payload.type,
        customer_id: payload.customer_id || null,
        table_id: payload.table_id || null,
        status: "active",
        subtotal: 0,
        discount_amount: 0,
        service_charge: 0,
        vat_amount: 0,
        total: 0,
      })
      .select()
      .single();

    if (orderErr || !order) return { data: null, error: orderErr };

    if (items.length > 0) {
      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          food_item_id: i.food_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          addons: i.addons ?? [],
          options: i.options ?? {},
          notes: i.notes || null,
        }))
      );
    }

    await fetchOrders();
    return { data: order as Order, error: null };
  };

  // Add item to existing order
  const addItem = async (orderId: string, item: CreateOrderItemPayload) => {
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      food_item_id: item.food_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      addons: item.addons ?? [],
      options: item.options ?? {},
      notes: item.notes || null,
    });
    if (!error) await fetchOrders();
    return { error };
  };

  // Remove item from order
  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("order_items").delete().eq("id", itemId);
    if (!error) await fetchOrders();
    return { error };
  };

  // Update item quantity
  const updateItemQty = async (itemId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(itemId);
    const { error } = await supabase.from("order_items").update({ quantity }).eq("id", itemId);
    if (!error) await fetchOrders();
    return { error };
  };

  // Bill the order — save totals, payment method, set status to billed
  const billOrder = async (
    orderId: string,
    totals: {
      subtotal: number;
      discount_amount: number;
      service_charge: number;
      vat_amount: number;
      total: number;
    },
    paymentMethodId?: string
  ) => {
    const { error } = await supabase.from("orders").update({
      ...totals,
      payment_method_id: paymentMethodId || null,
      status: "billed",
    }).eq("id", orderId);
    if (!error) await fetchOrders();
    return { error };
  };

  // Mark as completed
  const completeOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
    if (!error) await fetchOrders();
    return { error };
  };

  // Cancel
  const cancelOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    if (!error) await fetchOrders();
    return { error };
  };

  // ─── Create order as "active" (kitchen print flow) ────────────────────────
  const createKitchenOrder = async (
    payload: { type: "dine_in" | "takeaway"; tableId?: string; notes?: string },
    items: CreateOrderItemPayload[]
  ): Promise<{ data: Order | null; error: unknown }> => {
    if (!restaurantId) return { data: null, error: new Error("No restaurant") };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        type: payload.type,
        table_id: payload.tableId || null,
        // Only include notes if there is a value — avoids "column not found" when
        // the notes column hasn't been added via migration yet
        ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
        status: "active",
        subtotal: 0,
        discount_amount: 0,
        service_charge: 0,
        vat_amount: 0,
        total: 0,
      })
      .select()
      .single();

    if (orderErr || !order) return { data: null, error: orderErr };

    if (items.length > 0) {
      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          food_item_id: i.food_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          addons: i.addons ?? [],
          options: i.options ?? {},
          notes: i.notes || null,
        }))
      );
    }

    await fetchOrders();
    return { data: order as Order, error: null };
  };

  // ─── Full completion flow ──────────────────────────────────────────────────
  // Creates order in DB as "billed", optionally upserts customer, creates income transaction
  const billAndCreateOrder = async (
    payload: { type: "dine_in" | "takeaway"; tableId?: string; notes?: string },
    items: CreateOrderItemPayload[],
    totals: {
      subtotal: number;
      discount_amount: number;
      service_charge: number;
      vat_amount: number;
      total: number;
    }
  ): Promise<{ data: Order | null; error: unknown }> => {
    if (!restaurantId) return { data: null, error: new Error("No restaurant") };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        type: payload.type,
        table_id: payload.tableId || null,
        // Only include notes if there is a value — avoids "column not found" when
        // the notes column hasn't been added via migration yet
        ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
        status: "billed",
        ...totals,
      })
      .select()
      .single();

    if (orderErr || !order) return { data: null, error: orderErr };

    if (items.length > 0) {
      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          food_item_id: i.food_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          addons: i.addons ?? [],
          options: i.options ?? {},
        }))
      );
    }

    await fetchOrders();
    return { data: order as Order, error: null };
  };

  const completeOrderFull = async (
    orderId: string,
    orderNumber: string,
    totals: {
      subtotal: number;
      discount_amount: number;
      service_charge: number;
      vat_amount: number;
      total: number;
    },
    paymentMethodId: string,
    customerInfo?: { name: string; phone?: string },
    existingCustomerId?: string
  ): Promise<{ error: unknown }> => {
    if (!restaurantId) return { error: new Error("No restaurant") };

    // 1. Link customer to order
    let customerId: string | null = existingCustomerId ?? null;

    if (!customerId && customerInfo?.name.trim()) {
      // Look up by phone first to avoid duplicates
      if (customerInfo.phone?.trim()) {
        const { data: byPhone } = await supabase
          .from("customers")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .eq("phone", customerInfo.phone.trim())
          .maybeSingle();
        if (byPhone) customerId = byPhone.id;
      }

      if (!customerId) {
        const { data: newCust } = await supabase
          .from("customers")
          .insert({
            name: customerInfo.name.trim(),
            phone: customerInfo.phone?.trim() || null,
            restaurant_id: restaurantId,
          })
          .select("id")
          .single();
        customerId = newCust?.id ?? null;
      }
    }

    if (customerId) {
      await supabase.from("orders").update({ customer_id: customerId }).eq("id", orderId);
    }

    // 2. Update payment method + totals + complete
    const { error: updateErr } = await supabase.from("orders").update({
      ...totals,
      payment_method_id: paymentMethodId || null,
      status: "completed",
    }).eq("id", orderId);

    if (updateErr) return { error: updateErr };

    // 3. Create income transaction in "Daily Sales" category
    const dailySalesId = await getDailySalesCategoryId();
    const todayStr = new Date().toISOString().slice(0, 10);

    await supabase.from("transactions").insert({
      restaurant_id: restaurantId,
      type: "income",
      amount: totals.total,
      description: `${orderNumber}: Daily Sales`,
      category_id: dailySalesId ?? null,
      payment_method_id: paymentMethodId || null,
      status: "paid",
      transaction_date: todayStr,
    });

    await fetchOrders();
    return { error: null };
  };

  return {
    orders,
    loading,
    createOrder,
    addItem,
    removeItem,
    updateItemQty,
    billOrder,
    completeOrder,
    cancelOrder,
    createKitchenOrder,
    billAndCreateOrder,
    completeOrderFull,
    refresh: fetchOrders,
  };
}
