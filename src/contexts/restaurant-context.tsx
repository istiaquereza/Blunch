"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { getAllRestaurants } from "@/actions/get-all-restaurants";
import type { Restaurant } from "@/types";

// ── Access tiers ────────────────────────────────────────────────────────────
// super_admin  → sees ALL restaurants (across all owners)
// owner        → sees their assigned restaurant(s) only
// manager/etc. → same, scoped to their assigned restaurants
// no entry     → original creator of restaurants; accesses via restaurants.user_id

interface RestaurantContextType {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  setActiveRestaurant: (r: Restaurant) => void;
  loading: boolean;
  refresh: () => void;
  /** True if the current user has super_admin role in any restaurant */
  isSuperAdmin: boolean;
  /** Role for a specific restaurant, or null if not a member */
  getUserRole: (restaurantId: string) => string | null;
}

const RestaurantContext = createContext<RestaurantContextType>({
  restaurants: [],
  activeRestaurant: null,
  setActiveRestaurant: () => {},
  loading: true,
  refresh: () => {},
  isSuperAdmin: false,
  getUserRole: () => null,
});

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeRestaurant, setActiveRestaurantState] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  // restaurantId → role map for the logged-in user
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Who is the current user?
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const userEmail = userData.user?.email?.toLowerCase();

    if (!userId) { setLoading(false); return; }

    // 2. Check app_user_roles for this email
    const { data: roleData } = userEmail
      ? await supabase
          .from("app_user_roles")
          .select("restaurant_id, role, is_active")
          .ilike("email", userEmail)
          .eq("is_active", true)
      : { data: null };

    const activeRoles = roleData ?? [];
    const hasSuperAdminRole = activeRoles.some((r) => r.role === "super_admin");
    const hasAnyRole = activeRoles.length > 0;

    // Build roleMap for getUserRole()
    const newRoleMap: Record<string, string> = {};
    activeRoles.forEach((r) => { newRoleMap[r.restaurant_id] = r.role; });
    setRoleMap(newRoleMap);
    // Only an explicit super_admin role grants super admin access
    setIsSuperAdmin(hasSuperAdminRole);

    // 3. Determine which restaurants to show
    let restaurantData: Restaurant[] = [];

    if (hasSuperAdminRole) {
      // Super admin → all restaurants via admin client (bypasses RLS)
      // Server action uses admin client server-side, bypassing RLS entirely.
      // Pass the access token explicitly so auth works regardless of cookie forwarding.
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token ?? "";
        const all = await getAllRestaurants(token);
        restaurantData = all.length > 0 ? all : [];
      } catch {
        // ignore
      }
      // Fallback: own restaurants via RLS if server action returned nothing
      if (restaurantData.length === 0) {
        const { data } = await supabase.from("restaurants").select("*").order("created_at");
        restaurantData = data ?? [];
      }
    } else {
      // Scoped user: fetch only their assigned restaurants
      // Also include any restaurant they originally created (user_id) for backward compat
      const assignedIds = activeRoles.map((r) => r.restaurant_id);

      const [{ data: assignedData }, { data: createdData }] = await Promise.all([
        supabase.from("restaurants").select("*").in("id", assignedIds),
        supabase.from("restaurants").select("*").eq("user_id", userId),
      ]);

      const combined = [...(assignedData ?? []), ...(createdData ?? [])];
      // Deduplicate by id
      const seen = new Set<string>();
      restaurantData = combined.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      restaurantData.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    setRestaurants(restaurantData);

    // Restore previously selected restaurant from localStorage
    const savedId =
      typeof window !== "undefined" ? localStorage.getItem("activeRestaurantId") : null;
    const saved = savedId ? restaurantData.find((r) => r.id === savedId) : null;
    setActiveRestaurantState(saved ?? restaurantData[0] ?? null);

    setLoading(false);
  }, []);

  const setActiveRestaurant = (r: Restaurant) => {
    setActiveRestaurantState(r);
    localStorage.setItem("activeRestaurantId", r.id);
  };

  const getUserRole = useCallback(
    (restaurantId: string): string | null => {
      if (isSuperAdmin) return "super_admin";
      return roleMap[restaurantId] ?? null;
    },
    [isSuperAdmin, roleMap]
  );

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  return (
    <RestaurantContext.Provider
      value={{
        restaurants,
        activeRestaurant,
        setActiveRestaurant,
        loading,
        refresh: fetchRestaurants,
        isSuperAdmin,
        getUserRole,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export const useRestaurant = () => useContext(RestaurantContext);
