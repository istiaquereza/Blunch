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
import type { Restaurant } from "@/types";

interface RestaurantContextType {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  setActiveRestaurant: (r: Restaurant) => void;
  loading: boolean;
  refresh: () => void;
}

const RestaurantContext = createContext<RestaurantContextType>({
  restaurants: [],
  activeRestaurant: null,
  setActiveRestaurant: () => {},
  loading: true,
  refresh: () => {},
});

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeRestaurant, setActiveRestaurantState] =
    useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRestaurants = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at");

    if (data) {
      setRestaurants(data);
      // Restore previously selected restaurant
      const savedId =
        typeof window !== "undefined"
          ? localStorage.getItem("activeRestaurantId")
          : null;
      const saved = savedId ? data.find((r) => r.id === savedId) : null;
      setActiveRestaurantState(saved ?? data[0] ?? null);
    }
    setLoading(false);
  }, []);

  const setActiveRestaurant = (r: Restaurant) => {
    setActiveRestaurantState(r);
    localStorage.setItem("activeRestaurantId", r.id);
  };

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
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export const useRestaurant = () => useContext(RestaurantContext);
