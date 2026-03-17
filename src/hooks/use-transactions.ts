"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ExpenseCategory {
  id: string;
  name: string;
  type: "expense" | "income";
  user_id: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  restaurant_id: string;
  category_id?: string;
  type: "expense" | "income";
  description?: string;
  amount: number;
  payment_method_id?: string;
  status: "paid" | "due";
  transaction_date: string;
  created_at: string;
  expense_categories?: ExpenseCategory | null;
  payment_methods?: { id: string; name: string } | null;
}

export function useExpenseCategories() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setCategories(data ?? []);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string, type: "expense" | "income") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("Not authenticated") };
    const { error } = await supabase.from("expense_categories").insert({ name, type, user_id: user.id });
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { categories, create, remove, refresh: fetch };
}

export function useTransactions(restaurantId?: string, dateFrom?: string, dateTo?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!restaurantId) { setTransactions([]); return; }
    setLoading(true);
    let q = supabase
      .from("transactions")
      .select("*, expense_categories(id, name, type), payment_methods(id, name)")
      .eq("restaurant_id", restaurantId)
      .order("transaction_date", { ascending: false });
    if (dateFrom) q = q.gte("transaction_date", dateFrom);
    if (dateTo) q = q.lte("transaction_date", dateTo);
    const { data } = await q;
    setTransactions(data ?? []);
    setLoading(false);
  }, [restaurantId, dateFrom, dateTo]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload: Omit<Transaction, "id" | "created_at" | "expense_categories" | "payment_methods">) => {
    const { error } = await supabase.from("transactions").insert(payload);
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: Partial<Omit<Transaction, "id" | "created_at" | "expense_categories" | "payment_methods">>) => {
    const { error } = await supabase.from("transactions").update(payload).eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { transactions, loading, create, update, remove, refresh: fetch };
}
