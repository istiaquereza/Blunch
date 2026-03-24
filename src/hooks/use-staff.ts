"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface BenefitDetail { label: string; value: string; }

export interface BenefitPackage {
  id: string;
  restaurant_id: string;
  name: string;
  details: BenefitDetail[];
  created_at: string;
}

export interface StaffMember {
  id: string;
  restaurant_id: string;
  name: string;
  job_role: string | null;
  salary: number;
  staff_type: "kitchen" | "hall" | null;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  document_url: string | null;
  joining_date: string | null;
  food_category_ids: string[];
  benefit_package_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  benefit_packages?: BenefitPackage | null;
  restaurants?: { name: string } | null;
}

export interface StaffLeave {
  id: string;
  restaurant_id: string;
  staff_id: string;
  leave_date: string;
  leave_date_end: string | null;
  leave_type: "sick_leave" | "personal_leave" | "paid_leave";
  notes: string | null;
  created_at: string;
  staff?: { name: string; restaurant_id?: string } | null;
}

export function useStaff(restaurantId?: string) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("staff")
      .select("*, benefit_packages(id,name,details), restaurants(name)")
      .order("created_at", { ascending: false });
    if (restaurantId) q = q.eq("restaurant_id", restaurantId);
    const { data } = await q;
    setStaff((data as StaffMember[]) ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const createStaff = async (data: Omit<StaffMember, "id" | "created_at" | "updated_at" | "benefit_packages" | "restaurants">) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff").insert(data);
    if (!error) await fetchStaff();
    return { error };
  };

  const updateStaff = async (id: string, data: Partial<StaffMember>) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) await fetchStaff();
    return { error };
  };

  const deleteStaff = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (!error) await fetchStaff();
    return { error };
  };

  return { staff, loading, createStaff, updateStaff, deleteStaff, refresh: fetchStaff };
}

export function useBenefitPackages(restaurantId?: string) {
  const [packages, setPackages] = useState<BenefitPackage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPackages = useCallback(async () => {
    if (!restaurantId) { setPackages([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("benefit_packages")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setPackages((data as BenefitPackage[]) ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const createPackage = async (data: { name: string; details: BenefitDetail[]; restaurant_id: string }) => {
    const supabase = createClient();
    const { data: created, error } = await supabase.from("benefit_packages").insert(data).select("id, name").single();
    if (!error) await fetchPackages();
    return { data: created, error };
  };

  const updatePackage = async (id: string, data: Partial<BenefitPackage>) => {
    const supabase = createClient();
    const { error } = await supabase.from("benefit_packages").update(data).eq("id", id);
    if (!error) await fetchPackages();
    return { error };
  };

  const deletePackage = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("benefit_packages").delete().eq("id", id);
    if (!error) await fetchPackages();
    return { error };
  };

  return { packages, loading, createPackage, updatePackage, deletePackage, refresh: fetchPackages };
}

export function useStaffLeaves(restaurantId?: string) {
  const [leaves, setLeaves] = useState<StaffLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = useCallback(async () => {
    if (!restaurantId) { setLeaves([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("staff_leaves")
      .select("*, staff(name)")
      .eq("restaurant_id", restaurantId)
      .order("leave_date", { ascending: true });
    setLeaves((data as StaffLeave[]) ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const assignLeave = async (data: {
    restaurant_id: string; staff_id: string;
    leave_date: string; leave_type: StaffLeave["leave_type"]; notes?: string;
  }) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff_leaves").insert(data);
    if (!error) await fetchLeaves();
    return { error };
  };

  const assignLeaveRange = async (data: {
    restaurant_id: string; staff_id: string;
    leave_date: string; leave_date_end: string;
    leave_type: StaffLeave["leave_type"]; notes?: string;
  }) => {
    const supabase = createClient();
    // Build one row per day in range
    const rows: object[] = [];
    const start = new Date(data.leave_date);
    const end = new Date(data.leave_date_end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      rows.push({
        restaurant_id: data.restaurant_id,
        staff_id: data.staff_id,
        leave_date: ymd,
        leave_type: data.leave_type,
        notes: data.notes ?? null,
      });
    }
    const { error } = await supabase.from("staff_leaves").insert(rows);
    if (!error) await fetchLeaves();
    return { error };
  };

  const deleteLeave = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff_leaves").delete().eq("id", id);
    if (!error) await fetchLeaves();
    return { error };
  };

  return { leaves, loading, assignLeave, assignLeaveRange, deleteLeave, refresh: fetchLeaves };
}

// ─── All restaurants hooks ──────────────────────────────────────────────────

export function useAllStaff(restaurantIds: string[]) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = useCallback(async () => {
    if (!restaurantIds.length) { setStaff([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("staff")
      .select("*, benefit_packages(id,name,details), restaurants(name)")
      .in("restaurant_id", restaurantIds)
      .order("created_at", { ascending: false });
    setStaff((data as StaffMember[]) ?? []);
    setLoading(false);
  }, [restaurantIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  return { staff, loading, refresh: fetchStaff };
}

export function useAllStaffLeaves(restaurantIds: string[]) {
  const [leaves, setLeaves] = useState<StaffLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = useCallback(async () => {
    if (!restaurantIds.length) { setLeaves([]); setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("staff_leaves")
      .select("*, staff(name, restaurant_id)")
      .in("restaurant_id", restaurantIds)
      .order("leave_date", { ascending: true });
    setLeaves((data as StaffLeave[]) ?? []);
    setLoading(false);
  }, [restaurantIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const assignLeave = async (data: {
    restaurant_id: string; staff_id: string;
    leave_date: string; leave_type: StaffLeave["leave_type"]; notes?: string;
  }) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff_leaves").insert(data);
    if (!error) await fetchLeaves();
    return { error };
  };

  const assignLeaveRange = async (data: {
    restaurant_id: string; staff_id: string;
    leave_date: string; leave_date_end: string;
    leave_type: StaffLeave["leave_type"]; notes?: string;
  }) => {
    const supabase = createClient();
    const rows: object[] = [];
    const start = new Date(data.leave_date);
    const end = new Date(data.leave_date_end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      rows.push({
        restaurant_id: data.restaurant_id,
        staff_id: data.staff_id,
        leave_date: ymd,
        leave_type: data.leave_type,
        notes: data.notes ?? null,
      });
    }
    const { error } = await supabase.from("staff_leaves").insert(rows);
    if (!error) await fetchLeaves();
    return { error };
  };

  const deleteLeave = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("staff_leaves").delete().eq("id", id);
    if (!error) await fetchLeaves();
    return { error };
  };

  return { leaves, loading, assignLeave, assignLeaveRange, deleteLeave, refresh: fetchLeaves };
}
