"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vendor, ProductRequisition } from "@/types";

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .order("name", { ascending: true });
    setVendors(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (payload: { name: string; phone: string; address: string }) => {
    const { error } = await supabase
      .from("vendors")
      .insert(payload);
    if (!error) fetch();
    return { error };
  };

  const update = async (id: string, payload: { name: string; phone: string; address: string }) => {
    const { error } = await supabase
      .from("vendors")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (!error) fetch();
    return { error };
  };

  return { vendors, loading, create, update, remove, refresh: fetch };
}

// ─── Vendor Requisitions ───────────────────────────────────────────────────────
// Fetches all product_requisitions that are linked to a vendor, across all
// restaurants the current user has access to (RLS enforced by Supabase).
// Groups results by vendor for the "Vendor Items Request" tab.

export interface VendorRequisition extends ProductRequisition {
  restaurants?: { id: string; name: string } | null;
}

export interface VendorRequisitionGroup {
  vendor: Vendor;
  requisitions: VendorRequisition[];
  totalSpend: number;
}

export function useVendorRequisitions() {
  const [groups, setGroups] = useState<VendorRequisitionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);

    // Fetch all requisitions that have a vendor assigned, with full item details
    const { data, error } = await supabase
      .from("product_requisitions")
      .select(`
        *,
        vendors(id, name, phone, address),
        restaurants(id, name),
        product_requisition_items(
          *,
          ingredients(id, name, default_unit)
        )
      `)
      .not("vendor_id", "is", null)
      .order("requisition_date", { ascending: false });

    if (error) {
      // Fallback without restaurants join if FK not exposed
      const { data: fallback } = await supabase
        .from("product_requisitions")
        .select(`
          *,
          vendors(id, name, phone, address),
          product_requisition_items(
            *,
            ingredients(id, name, default_unit)
          )
        `)
        .not("vendor_id", "is", null)
        .order("requisition_date", { ascending: false });

      buildGroups(fallback ?? []);
    } else {
      buildGroups(data ?? []);
    }

    setLoading(false);
  }, []);

  const buildGroups = (requisitions: VendorRequisition[]) => {
    const map = new Map<string, VendorRequisitionGroup>();
    for (const req of requisitions) {
      if (!req.vendors) continue;
      const vid = req.vendors.id;
      if (!map.has(vid)) {
        map.set(vid, { vendor: req.vendors as Vendor, requisitions: [], totalSpend: 0 });
      }
      const group = map.get(vid)!;
      group.requisitions.push(req);
      const reqTotal = req.product_requisition_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
      group.totalSpend += reqTotal;
    }
    // Sort groups by vendor name
    setGroups(Array.from(map.values()).sort((a, b) => a.vendor.name.localeCompare(b.vendor.name)));
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { groups, loading, refresh: fetch };
}
