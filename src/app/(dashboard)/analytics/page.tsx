"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  BarChart2,
  Search,
  ChevronUp,
  ChevronDown,
  Loader2,
  Star,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTs(dateStr: string, endOfDay = false) {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const min = String(Math.abs(off) % 60).padStart(2, "0");
  return `${dateStr}${endOfDay ? "T23:59:59" : "T00:00:00"}${sign}${h}:${min}`;
}

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ef4444", "#f59e0b", "#06b6d4"];

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = "today" | "week" | "month" | "all_time" | "custom";

interface FoodCategory {
  name: string;
}

interface FoodItemIngredientAnalytics {
  quantity: number;
  ingredients: { unit_price: number } | null;
}

interface FoodItemAnalytics {
  id: string;
  name: string;
  food_category_id: string | null;
  sell_price: number;
  food_categories: FoodCategory | null;
  food_item_ingredients: FoodItemIngredientAnalytics[];
}

interface OrderItemAnalytics {
  food_item_id: string;
  quantity: number;
  unit_price: number;
  food_items: FoodItemAnalytics | null;
}

interface OrderAnalytics {
  id: string;
  created_at: string;
  total: number;
  order_items: OrderItemAnalytics[];
}

type SortField = "rank" | "name" | "times_ordered" | "qty_sold" | "revenue" | "avg_price";
type SortDir = "asc" | "desc";

// ─── Preset helpers ───────────────────────────────────────────────────────────
function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const tod = isoDate(now);
  switch (preset) {
    case "today":
      return { from: tod, to: tod };
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: isoDate(d), to: tod };
    }
    case "month":
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        to: tod,
      };
    case "all_time":
      return { from: "2020-01-01", to: tod };
    default:
      return { from: tod, to: tod };
  }
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

// ─── Hour label helper ────────────────────────────────────────────────────────
function hourLabel(h: number) {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-700">
          {typeof p.value === "number" && p.name === "revenue"
            ? fmt(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-orange-600">{fmt(payload[0].value)}</p>
    </div>
  );
}

// ─── Sort icon helper ─────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronDown size={12} className="text-gray-300 inline ml-1" />;
  return sortDir === "asc"
    ? <ChevronUp size={12} className="text-orange-500 inline ml-1" />
    : <ChevronDown size={12} className="text-orange-500 inline ml-1" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { activeRestaurant, restaurants } = useRestaurant();

  const [preset, setPreset] = useState<DatePreset>("today");
  const { from: defaultFrom, to: defaultTo } = getPresetRange("today");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("all");

  const [orders, setOrders] = useState<OrderAnalytics[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [tableLimit, setTableLimit] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("qty_sold");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [reportView, setReportView] = useState<"food" | "category">("food");

  const supabase = createClient();

  // Restaurant IDs to query
  const restaurantIds = useMemo(() => {
    if (selectedRestaurantId === "all") return restaurants.map((r) => r.id);
    return [selectedRestaurantId];
  }, [selectedRestaurantId, restaurants]);

  const fetchOrders = useCallback(async () => {
    if (restaurantIds.length === 0) { setOrders([]); return; }
    setLoading(true);

    let query = supabase
      .from("orders")
      .select(`
        id, created_at, total,
        order_items(
          food_item_id, quantity, unit_price,
          food_items(
            id, name, food_category_id, sell_price,
            food_categories(name),
            food_item_ingredients(
              quantity,
              ingredients(unit_price)
            )
          )
        )
      `)
      .eq("status", "completed")
      .gte("created_at", localTs(dateFrom))
      .lte("created_at", localTs(dateTo, true));

    if (restaurantIds.length === 1) {
      query = query.eq("restaurant_id", restaurantIds[0]);
    } else {
      query = query.in("restaurant_id", restaurantIds);
    }

    const { data } = await query;
    setOrders((data as unknown as OrderAnalytics[]) ?? []);
    setLoading(false);
  }, [restaurantIds, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Init restaurant selector to active restaurant
  useEffect(() => {
    if (activeRestaurant && selectedRestaurantId === "all" && restaurants.length === 1) {
      setSelectedRestaurantId(activeRestaurant.id);
    }
  }, [activeRestaurant, restaurants]);

  // ── Summary stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalItemsSold = 0;
    let totalRevenue = 0;
    const orderCount = orders.length;
    const itemCountMap = new Map<string, { name: string; qty: number }>();

    for (const order of orders) {
      totalRevenue += order.total ?? 0;
      for (const oi of order.order_items) {
        totalItemsSold += oi.quantity;
        const fi = oi.food_items;
        if (!fi) continue;
        const prev = itemCountMap.get(fi.id) ?? { name: fi.name, qty: 0 };
        prev.qty += oi.quantity;
        itemCountMap.set(fi.id, prev);
      }
    }

    const sorted = Array.from(itemCountMap.values()).sort((a, b) => b.qty - a.qty);
    const mostSold = sorted[0] ?? null;
    const avgItemsPerOrder = orderCount > 0 ? totalItemsSold / orderCount : 0;

    return { totalItemsSold, totalRevenue, orderCount, mostSold, avgItemsPerOrder };
  }, [orders]);

  // ── Food sales report ────────────────────────────────────────────────────────
  interface FoodSaleRow {
    foodId: string;
    name: string;
    category: string;
    timesOrdered: number;
    qtySold: number;
    revenue: number;
    avgPrice: number;
  }

  const foodSalesRows: FoodSaleRow[] = useMemo(() => {
    const map = new Map<string, {
      name: string; category: string; timesOrdered: number; qtySold: number; revenue: number; prices: number[];
    }>();

    for (const order of orders) {
      for (const oi of order.order_items) {
        const fi = oi.food_items;
        if (!fi) continue;
        const prev = map.get(fi.id) ?? {
          name: fi.name,
          category: fi.food_categories?.name ?? "Uncategorized",
          timesOrdered: 0,
          qtySold: 0,
          revenue: 0,
          prices: [],
        };
        prev.timesOrdered += 1;
        prev.qtySold += oi.quantity;
        prev.revenue += oi.unit_price * oi.quantity;
        prev.prices.push(oi.unit_price);
        map.set(fi.id, prev);
      }
    }

    return Array.from(map.entries()).map(([foodId, d]) => ({
      foodId,
      name: d.name,
      category: d.category,
      timesOrdered: d.timesOrdered,
      qtySold: d.qtySold,
      revenue: d.revenue,
      avgPrice: d.prices.length > 0 ? d.prices.reduce((s, p) => s + p, 0) / d.prices.length : 0,
    }));
  }, [orders]);

  const totalRevenue = stats.totalRevenue;

  const filteredSorted = useMemo(() => {
    let rows = search.trim()
      ? foodSalesRows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
      : [...foodSalesRows];

    rows.sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case "name": diff = a.name.localeCompare(b.name); break;
        case "times_ordered": diff = a.timesOrdered - b.timesOrdered; break;
        case "qty_sold": diff = a.qtySold - b.qtySold; break;
        case "revenue": diff = a.revenue - b.revenue; break;
        case "avg_price": diff = a.avgPrice - b.avgPrice; break;
        default: diff = 0;
      }
      return sortDir === "asc" ? diff : -diff;
    });
    return rows;
  }, [foodSalesRows, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ── Category sales report ─────────────────────────────────────────────────────
  interface CategorySaleRow {
    name: string;
    itemCount: number;
    timesOrdered: number;
    qtySold: number;
    revenue: number;
    pct: number;
  }

  const categorySalesRows: CategorySaleRow[] = useMemo(() => {
    const map = new Map<string, { itemCount: number; timesOrdered: number; qtySold: number; revenue: number }>();
    for (const row of foodSalesRows) {
      const prev = map.get(row.category) ?? { itemCount: 0, timesOrdered: 0, qtySold: 0, revenue: 0 };
      prev.itemCount += 1;
      prev.timesOrdered += row.timesOrdered;
      prev.qtySold += row.qtySold;
      prev.revenue += row.revenue;
      map.set(row.category, prev);
    }
    const totalRev = Array.from(map.values()).reduce((s, r) => s + r.revenue, 0);
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d, pct: totalRev > 0 ? (d.revenue / totalRev) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [foodSalesRows]);

  // ── Category breakdown ────────────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of foodSalesRows) {
      map.set(row.category, (map.get(row.category) ?? 0) + row.revenue);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [foodSalesRows]);

  // ── Peak hours ────────────────────────────────────────────────────────────────
  const peakHoursData = useMemo(() => {
    const counts = new Array(24).fill(0);
    for (const order of orders) {
      const h = new Date(order.created_at).getHours();
      counts[h] += 1;
    }
    return counts.map((count, h) => ({ hour: hourLabel(h), count }));
  }, [orders]);

  // ── Revenue by day/hour/month ──────────────────────────────────────────────────
  const revenueChartData = useMemo(() => {
    if (preset === "today") {
      // By hour
      const hourMap = new Map<number, number>();
      for (const order of orders) {
        const h = new Date(order.created_at).getHours();
        hourMap.set(h, (hourMap.get(h) ?? 0) + (order.total ?? 0));
      }
      return Array.from({ length: 24 }, (_, h) => ({
        label: hourLabel(h),
        revenue: hourMap.get(h) ?? 0,
      }));
    } else if (preset === "all_time") {
      // By month
      const monthMap = new Map<string, number>();
      for (const order of orders) {
        const d = new Date(order.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + (order.total ?? 0));
      }
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, revenue]) => ({ label, revenue }));
    } else {
      // By day
      const dayMap = new Map<string, number>();
      for (const order of orders) {
        const key = order.created_at.slice(0, 10);
        dayMap.set(key, (dayMap.get(key) ?? 0) + (order.total ?? 0));
      }
      return Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, revenue]) => ({ label, revenue }));
    }
  }, [orders, preset]);

  // ── Profit margin analysis ─────────────────────────────────────────────────────
  interface ProfitRow {
    name: string;
    sellPrice: number;
    ingredientCost: number;
    profit: number;
    margin: number;
  }

  const profitRows: ProfitRow[] = useMemo(() => {
    const seen = new Set<string>();
    const result: ProfitRow[] = [];

    for (const order of orders) {
      for (const oi of order.order_items) {
        const fi = oi.food_items;
        if (!fi || seen.has(fi.id)) continue;
        seen.add(fi.id);

        const ingredientCost = fi.food_item_ingredients.reduce((sum, fii) => {
          return sum + fii.quantity * (fii.ingredients?.unit_price ?? 0);
        }, 0);

        const sellPrice = fi.sell_price ?? oi.unit_price;
        const profit = sellPrice - ingredientCost;
        const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

        result.push({ name: fi.name, sellPrice, ingredientCost, profit, margin });
      }
    }

    return result.sort((a, b) => b.margin - a.margin).slice(0, 10);
  }, [orders]);

  const handlePreset = (p: DatePreset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = getPresetRange(p);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  return (
    <>
      <Header title="Analytics" />

      <div className="p-6 space-y-5">

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm shrink-0 h-[62px] flex items-center px-[14px] gap-3 overflow-x-auto">
            {/* Restaurant selector */}
            {restaurants.length > 1 && (
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                className="h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Restaurants</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}

            {/* Date preset */}
            <select
              value={preset}
              onChange={(e) => handlePreset(e.target.value as DatePreset)}
              className="h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {preset === "custom" && (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-gray-400 text-xs">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </>
            )}

            <div className="flex-1" />

            {loading && <Loader2 size={16} className="text-orange-400 animate-spin" />}

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search food item…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-xs text-gray-700 w-44 focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent"
              />
            </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-[18px]">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={15} className="text-orange-500" />
              <p className="text-xs text-gray-500">Total Items Sold</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalItemsSold.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={15} className="text-green-500" />
              <p className="text-xs text-gray-500">Total Revenue</p>
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(stats.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} className="text-blue-500" />
              <p className="text-xs text-gray-500">Avg Items / Order</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgItemsPerOrder.toFixed(1)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={15} className="text-amber-500" />
              <p className="text-xs text-gray-500">Most Sold Item</p>
            </div>
            {stats.mostSold ? (
              <>
                <p className="text-sm font-bold text-gray-900 truncate">{stats.mostSold.name}</p>
                <p className="text-xs text-amber-600 mt-0.5">{stats.mostSold.qty}× sold</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </div>

        {/* ── Food Sales Report ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Food Sales Report</h2>
              <p className="text-xs text-gray-400">
                {reportView === "food" ? `${filteredSorted.length} items` : `${categorySalesRows.length} categories`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle — pill style */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(["food", "category"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setReportView(v)}
                    className={`px-3 h-7 rounded-md text-xs font-medium transition-all ${
                      reportView === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    By {v === "food" ? "Food" : "Category"}
                  </button>
                ))}
              </div>
              {/* Show limit dropdown */}
              <select
                value={tableLimit ?? "all"}
                onChange={(e) => setTableLimit(e.target.value === "all" ? null : Number(e.target.value))}
                className="h-8 px-2 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Show all</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
            </div>
          ) : reportView === "category" ? (
            /* ── By Category Table ── */
            categorySalesRows.length === 0 ? (
              <div className="p-12 text-center">
                <BarChart2 size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">No sales data for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Times Ordered</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty Sold</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categorySalesRows.map((row, idx) => (
                      <tr key={row.name} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5 text-xs text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: COLORS[idx % COLORS.length] }}
                            />
                            <span className="text-sm font-medium text-gray-900">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.itemCount} items</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.timesOrdered}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.qtySold}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">{fmt(row.revenue)}</td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(100, row.pct)}%`, background: COLORS[idx % COLORS.length] }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{row.pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100 bg-gray-50">
                      <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500">
                        {categorySalesRows.length} categories
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-800">
                        {categorySalesRows.reduce((s, r) => s + r.qtySold, 0)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-green-600">
                        {fmt(categorySalesRows.reduce((s, r) => s + r.revenue, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          ) : (
            /* ── By Food Table ── */
            filteredSorted.length === 0 ? (
              <div className="p-12 text-center">
                <BarChart2 size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">No sales data for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort("name")}>
                        Food Item <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort("times_ordered")}>
                        Times Ordered <SortIcon field="times_ordered" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort("qty_sold")}>
                        Qty Sold <SortIcon field="qty_sold" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort("revenue")}>
                        Revenue <SortIcon field="revenue" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort("avg_price")}>
                        Avg Price <SortIcon field="avg_price" sortField={sortField} sortDir={sortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(tableLimit ? filteredSorted.slice(0, tableLimit) : filteredSorted).map((row, idx) => {
                      const pct = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                      return (
                        <tr key={row.foodId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{row.name}</p>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 text-xs">{row.category}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.timesOrdered}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.qtySold}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">{fmt(row.revenue)}</td>
                          <td className="px-4 py-3 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{fmt(row.avgPrice)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* ── Charts row: Category Pie + Peak Hours ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Revenue by Category</h2>
            {categoryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-gray-400">No data</p>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {categoryData.map((c, i) => {
                    const pct = totalRevenue > 0 ? (c.value / totalRevenue) * 100 : 0;
                    return (
                      <div key={c.name} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-xs text-gray-700 flex-1 truncate">{c.name}</span>
                        <span className="text-xs text-gray-700">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Peak Hours */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Peak Hours</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={peakHoursData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  interval={2}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#fff7ed" }}
                />
                <Bar dataKey="count" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Revenue Trend ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Revenue Trend</h2>
          <p className="text-xs text-gray-400 mb-4">
            {preset === "today" ? "By hour" : preset === "all_time" ? "By month" : "By day"}
          </p>
          {revenueChartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center">
              <p className="text-sm text-gray-400">No revenue data in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#f97316" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Profit Margin Analysis ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-gray-800">Profit Margin Analysis</h2>
            <p className="text-xs text-gray-400">Top 10 items by margin (based on ingredient costs)</p>
          </div>

          {profitRows.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingUp size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No data available for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Food Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sell Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingredient Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Profit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {profitRows.map((row) => {
                    let marginColor = "text-green-600 bg-green-50";
                    if (row.margin < 25) marginColor = "text-red-600 bg-red-50";
                    else if (row.margin < 50) marginColor = "text-amber-600 bg-amber-50";

                    return (
                      <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmt(row.sellPrice)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmt(row.ingredientCost)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${marginColor}`}>
                            {row.margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
