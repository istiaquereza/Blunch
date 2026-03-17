"use client";

import { Bell, ChevronDown, Building2, Menu } from "lucide-react";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  title: string;
  rightContent?: React.ReactNode;
  hideRestaurantSelector?: boolean;
}

export function Header({ title, rightContent, hideRestaurantSelector = false }: HeaderProps) {
  const { restaurants, activeRestaurant, setActiveRestaurant, loading } =
    useRestaurant();
  const { toggleSidebar } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleSidebar}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-base font-semibold text-gray-900 truncate max-w-[160px] sm:max-w-none">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        {rightContent}

        {/* Restaurant Selector — hidden on small screens */}
        {!loading && !hideRestaurantSelector && (
          <div className="relative" ref={ref}>
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
                      onClick={() => {
                        setActiveRestaurant(r);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2",
                        activeRestaurant?.id === r.id
                          ? "text-orange-600 font-medium"
                          : "text-gray-700"
                      )}
                    >
                      <Building2
                        size={13}
                        className={
                          activeRestaurant?.id === r.id
                            ? "text-orange-500"
                            : "text-gray-400"
                        }
                      />
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
          <Bell size={14} />
        </button>
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold">A</span>
        </div>
      </div>
    </header>
  );
}
