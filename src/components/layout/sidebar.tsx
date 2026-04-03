"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X, LifeBuoy, LogOut, Bell, Globe, Package, AlertCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, type NavItem, type LinkNavItem } from "./nav-config";
import { useSidebar } from "@/contexts/sidebar-context";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/contexts/restaurant-context";
import { toast } from "sonner";

function NavLink({ item, depth = 0, badges = {} }: { item: LinkNavItem; depth?: number; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const { closeSidebar } = useSidebar();
  const hasChildren = item.children && item.children.length > 0;
  const isActive = hasChildren
    ? pathname === item.href
    : pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
  const isExpanded = (pathname === item.href || pathname.startsWith(item.href + "/")) && hasChildren;
  const [open, setOpen] = useState(isExpanded);
  const badge = badges[item.href] ?? 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
            isActive
              ? "bg-gray-900 text-white"
              : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <item.icon
            size={18}
            className={cn(
              "shrink-0 transition-colors",
              isActive ? "text-white" : "group-hover:text-sidebar-foreground"
            )}
          />
          <span className="flex-1 text-left">{item.title}</span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
        {open && (
          <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
            {item.children!.map((child) => (
              <NavLink key={child.href} item={child} depth={depth + 1} badges={badges} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={closeSidebar}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
        isActive
          ? "bg-gray-900 text-white"
          : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <item.icon
        size={18}
        className={cn(
          "shrink-0",
          isActive ? "text-white" : "group-hover:text-sidebar-foreground"
        )}
      />
      <span className="flex-1">{item.title}</span>
      {badge > 0 && (
        <span className={cn(
          "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
          isActive ? "bg-white/20 text-white" : "bg-orange-500/15 text-orange-600"
        )}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SidebarContent({ showClose = false }: { showClose?: boolean }) {
  const { closeSidebar } = useSidebar();
  const { activeRestaurant, isSuperAdmin, getUserRole, restaurants } = useRestaurant();
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsView, setAlertsView] = useState(false);
  const [alerts, setAlerts] = useState<{ lowStock: any[]; dueTx: any[] }>({ lowStock: [], dueTx: [] });
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const userRole = isSuperAdmin
    ? "Super Admin"
    : activeRestaurant
      ? (getUserRole(activeRestaurant.id) ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "";

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
      const meta = data.user?.user_metadata;
      setUserName(meta?.full_name ?? meta?.name ?? data.user?.email?.split("@")[0] ?? "");
    });
  }, []);

  useEffect(() => {
    if (!restaurants.length) return;
    const supabase = createClient();
    const rIds = restaurants.map((r) => r.id);
    Promise.all([
      supabase.from("food_stock")
        .select("id, quantity, ingredients(id, name, default_unit)")
        .in("restaurant_id", rIds)
        .lte("quantity", 5)
        .order("quantity", { ascending: true }),
      supabase.from("transactions")
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

  useEffect(() => {
    if (!activeRestaurant) { setActiveOrderCount(0); return; }
    const supabase = createClient();
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", activeRestaurant.id)
      .in("status", ["active", "billed"])
      .or("source.is.null,source.neq.remote_staff")
      .then(({ count }) => setActiveOrderCount(count ?? 0));
  }, [activeRestaurant]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  const initials = userName ? userName[0].toUpperCase() : userEmail ? userEmail[0].toUpperCase() : "U";

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col" style={{ backgroundColor: "#F9F8F5" }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <p
          className="text-3xl leading-none tracking-tight select-none"
          style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 600, color: "#C2C3C7" }}
        >
          Blunch<span style={{ color: "#F97316" }}>.</span>
        </p>
        {showClose && (
          <button
            onClick={closeSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.kind === "divider") {
            return <div key={`divider-${i}`} className="mx-3 border-t border-sidebar-border/50" style={{ marginTop: 10, marginBottom: 10 }} />;
          }
          if (item.kind === "section") {
            return (
              <p key={`section-${i}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                {item.label}
              </p>
            );
          }
          return <NavLink key={(item as any).href} item={item as any} badges={{ "/orders/order": activeOrderCount }} />;
        })}
      </nav>

      {/* Support link */}
      <div className="px-3 pb-1">
        <Link
          href="/support"
          onClick={closeSidebar}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LifeBuoy size={18} className="shrink-0" />
          <span>Support</span>
        </Link>
      </div>

      {/* Profile section */}
      <div className="px-3 pb-3 relative" ref={profileRef}>
        <div className="border-t border-sidebar-border mb-2" />

        {/* Profile dropdown (opens upward) */}
        {profileOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white rounded-xl border border-border shadow-xl z-50 overflow-hidden">
            {alertsView ? (
              /* ── Alerts view ── */
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <button onClick={() => setAlertsView(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft size={14} />
                  </button>
                  <p className="text-sm font-semibold text-gray-900 flex-1">Alerts</p>
                  {(alerts.lowStock.length + alerts.dueTx.length) > 0 && (
                    <span className="text-xs font-bold bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-full">
                      {alerts.lowStock.length + alerts.dueTx.length}
                    </span>
                  )}
                </div>
                {(alerts.lowStock.length + alerts.dueTx.length) === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400">No alerts right now</p>
                    <p className="text-xs text-gray-300 mt-1">All stock and payments are on track</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {alerts.lowStock.map((stock) => {
                      const qty = stock.quantity ?? 0;
                      const isEmpty = qty <= 0;
                      return (
                        <div key={stock.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isEmpty ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                            <Package size={13} className={isEmpty ? "text-red-500" : "text-amber-600"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{stock.ingredients?.name}</p>
                            <p className={`text-[11px] mt-0.5 ${isEmpty ? "text-red-500" : "text-amber-600"}`}>
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
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                          <AlertCircle size={13} className="text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{tx.description || "Due payment"}</p>
                          <p className="text-[11px] text-purple-600 mt-0.5">{fmt(tx.amount)} due</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600">Due</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* ── Main menu view ── */
              <>
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#111827] flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{userName || userEmail || "User"}</p>
                      {userRole && (
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 mt-0.5">
                          {userRole}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Menu items */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => setAlertsView(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Bell size={14} className="text-gray-400" />
                    <span className="flex-1 text-left">Alerts</span>
                    {(alerts.lowStock.length + alerts.dueTx.length) > 0 && (
                      <span className="text-[10px] font-bold bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-full">
                        {alerts.lowStock.length + alerts.dueTx.length}
                      </span>
                    )}
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Globe size={14} className="text-gray-400" />
                    <span className="flex-1 text-left">Language</span>
                    <span className="text-xs text-gray-400">English</span>
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Profile trigger button */}
        <button
          onClick={() => { setProfileOpen(!profileOpen); if (!profileOpen) setAlertsView(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-colors group"
        >
          <div className="relative w-8 h-8 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            {(alerts.lowStock.length + alerts.dueTx.length) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                {alerts.lowStock.length + alerts.dueTx.length > 9 ? "9+" : alerts.lowStock.length + alerts.dueTx.length}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {userName || userEmail || "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{userEmail}</p>
          </div>
          <ChevronUp
            size={14}
            className={cn(
              "shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
              profileOpen && "rotate-180"
            )}
          />
        </button>
      </div>
    </aside>
  );
}

export function Sidebar() {
  const { sidebarOpen, closeSidebar } = useSidebar();

  return (
    <>
      {/* Desktop: always-visible sticky sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile: slide-in overlay drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSidebar}
          />
          {/* Drawer */}
          <div className="relative z-10 h-full shadow-2xl">
            <SidebarContent showClose />
          </div>
        </div>
      )}
    </>
  );
}
