"use client";

import { Bell, ChevronDown, Building2, Menu, Package, AlertCircle } from "lucide-react";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  title: string;
  rightContent?: React.ReactNode;
  hideRestaurantSelector?: boolean;
}

const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Header({ title, rightContent, hideRestaurantSelector = false }: HeaderProps) {
  const { restaurants, activeRestaurant, setActiveRestaurant, loading } = useRestaurant();
  const { toggleSidebar } = useSidebar();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const restaurantRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [dhakaTime, setDhakaTime] = useState("");
  const [dhakaDate, setDhakaDate] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDhakaTime(now.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      setDhakaDate(now.toLocaleDateString("en-US", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (restaurantRef.current && !restaurantRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Alerts: low stock ingredients + due payments
  const [alerts, setAlerts] = useState<{ lowStock: any[]; dueTx: any[] }>({ lowStock: [], dueTx: [] });
  const alertCount = alerts.lowStock.length + alerts.dueTx.length;

  useEffect(() => {
    if (!restaurants.length) return;
    const supabase = createClient();
    const rIds = restaurants.map((r) => r.id);
    Promise.all([
      supabase
        .from("food_stock")
        .select("id, quantity, ingredients(id, name, default_unit)")
        .in("restaurant_id", rIds)
        .lte("quantity", 5)
        .order("quantity", { ascending: true }),
      supabase
        .from("transactions")
        .select("id, description, amount, transaction_date")
        .in("restaurant_id", rIds)
        .eq("status", "due")
        .limit(20),
    ]).then(([{ data: stockData }, { data: txData }]) => {
      setAlerts({
        lowStock: (stockData ?? []).filter((s: any) => s.ingredients),
        dueTx: txData ?? [],
      });
    });
  }, [restaurants]);

  return (
    <header className="h-[62px] border-b border-border bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleSidebar}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-[18px] font-semibold text-gray-900 truncate max-w-[160px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        {rightContent}

        {/* Restaurant Selector */}
        {!loading && !hideRestaurantSelector && (
          <div className="relative" ref={restaurantRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "hidden sm:flex items-center gap-2 px-3 h-8 rounded-lg text-sm border transition-colors",
                activeRestaurant
                  ? "border-gray-200 hover:bg-gray-50 text-gray-700"
                  : "border-orange-200 bg-orange-50 text-orange-600"
              )}
            >
              <Building2 size={13} />
              <span className="max-w-[120px] truncate">
                {activeRestaurant?.name ?? "Select Restaurant"}
              </span>
              <ChevronDown size={12} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-10 w-52 bg-white rounded-xl border border-border shadow-lg z-50 py-1">
                {restaurants.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">
                    No restaurants — go to Settings
                  </div>
                ) : (
                  restaurants.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setActiveRestaurant(r); setDropdownOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2",
                        activeRestaurant?.id === r.id ? "text-orange-600 font-medium" : "text-gray-700"
                      )}
                    >
                      <Building2 size={13} className={activeRestaurant?.id === r.id ? "text-orange-500" : "text-gray-400"} />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Time — desktop only */}
        <div className="hidden sm:flex flex-col items-end leading-tight mr-1">
          <span className="text-xs font-semibold text-gray-700 tabular-nums">{dhakaTime}</span>
          <span className="text-[10px] text-gray-400">{dhakaDate} · GMT+6</span>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Bell size={14} />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-border shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Alerts</p>
                {alertCount > 0 && (
                  <span className="text-xs font-bold bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full">{alertCount}</span>
                )}
              </div>
              {alertCount === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-400">No alerts right now</p>
                  <p className="text-xs text-gray-300 mt-1">All stock and payments are on track</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {alerts.lowStock.map((stock) => {
                    const qty = stock.quantity ?? 0;
                    const isEmpty = qty <= 0;
                    return (
                      <div key={stock.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isEmpty ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                          <Package size={14} className={isEmpty ? "text-red-500" : "text-amber-600"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{stock.ingredients?.name}</p>
                          <p className={`text-xs mt-0.5 ${isEmpty ? "text-red-500" : "text-amber-600"}`}>
                            {isEmpty ? "Out of stock" : `Low — ${qty} ${stock.ingredients?.default_unit ?? ""} left`}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isEmpty ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700"}`}>
                          {isEmpty ? "Empty" : "Low"}
                        </span>
                      </div>
                    );
                  })}
                  {alerts.dueTx.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <AlertCircle size={14} className="text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{tx.description || "Due payment"}</p>
                        <p className="text-xs text-purple-600 mt-0.5">{fmt(tx.amount)} due</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600">Due</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
