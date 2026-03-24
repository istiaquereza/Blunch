"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useFoodStock } from "@/hooks/use-food-stock";
import { createClient } from "@/lib/supabase/client";
import {
  Package,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
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

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = "today" | "week" | "month" | "all_time" | "custom";

interface FoodUsage {
  foodName: string;
  qtyConsumed: number;
  timesSold: number;
}

interface IngredientRow {
  ingredientId: string;
  name: string;
  group: string;
  unit: string;
  consumed: number;
  currentStock: number;
  openingStock: number;
  foods: FoodUsage[];
}

interface DailyBreakdown {
  date: string;
  byIngredient: Map<string, number>;
}

// ─── Supabase shapes ──────────────────────────────────────────────────────────
interface IngredientMeta {
  id: string;
  name: string;
  default_unit: string;
  inventory_group_id: string | null;
  inventory_groups: { name: string } | null;
}

interface FoodItemIngredient {
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredients: IngredientMeta | null;
}

interface FoodItemJoined {
  id: string;
  name: string;
  food_item_ingredients: FoodItemIngredient[];
}

interface OrderItem {
  food_item_id: string;
  quantity: number;
  food_items: FoodItemJoined | null;
}

interface Order {
  id: string;
  created_at: string;
  order_items: OrderItem[];
}

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
    case "month": {
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        to: tod,
      };
    }
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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ current, opening }: { current: number; opening: number }) {
  if (opening <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <CheckCircle2 size={11} />
        N/A
      </span>
    );
  }
  const pct = current / opening;
  if (pct < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle size={11} />
        Critical
      </span>
    );
  }
  if (pct < 0.3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle size={11} />
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 size={11} />
      OK
    </span>
  );
}

// ─── Expandable ingredient row ────────────────────────────────────────────────
function IngredientTableRow({ row }: { row: IngredientRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-gray-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{row.name}</p>
              <p className="text-xs text-gray-400">{row.group || "Ungrouped"}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{row.unit}</td>
        <td className="px-4 py-3 text-sm font-semibold text-orange-600">
          {row.consumed.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{row.openingStock.toFixed(2)}</td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.currentStock.toFixed(2)}</td>
        <td className="px-4 py-3">
          <StatusBadge current={row.currentStock} opening={row.openingStock} />
        </td>
      </tr>

      {expanded && row.foods.length > 0 && (
        <tr className="bg-orange-50/40">
          <td colSpan={6} className="px-8 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">
              Used in these food items
            </p>
            <div className="flex flex-wrap gap-2">
              {row.foods.map((f) => (
                <div
                  key={f.foodName}
                  className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-gray-800">{f.foodName}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-orange-600">{f.qtyConsumed.toFixed(2)} {row.unit}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{f.timesSold}× sold</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryHistoryPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;

  const [preset, setPreset] = useState<DatePreset>("today");
  const { from: defaultFrom, to: defaultTo } = getPresetRange("today");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [search, setSearch] = useState("");

  const { stock, loading: stockLoading } = useFoodStock(rid);

  const supabase = createClient();

  const fetchOrders = useCallback(async () => {
    if (!rid) { setOrders([]); return; }
    setLoadingOrders(true);
    const { data } = await supabase
      .from("orders")
      .select(`
        id, created_at,
        order_items(
          food_item_id, quantity,
          food_items(
            id, name,
            food_item_ingredients(
              ingredient_id, quantity, unit,
              ingredients(id, name, default_unit, inventory_group_id, inventory_groups(name))
            )
          )
        )
      `)
      .eq("restaurant_id", rid)
      .eq("status", "completed")
      .gte("created_at", localTs(dateFrom))
      .lte("created_at", localTs(dateTo, true));

    setOrders((data as unknown as Order[]) ?? []);
    setLoadingOrders(false);
  }, [rid, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Aggregation ──────────────────────────────────────────────────────────────
  const ingredientRows: IngredientRow[] = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        unit: string;
        group: string;
        consumed: number;
        foods: Map<string, { qtyConsumed: number; timesSold: number }>;
      }
    >();

    for (const order of orders) {
      for (const oi of order.order_items) {
        const fi = oi.food_items;
        if (!fi) continue;
        for (const fii of fi.food_item_ingredients) {
          const ing = fii.ingredients;
          if (!ing) continue;
          const consumed = fii.quantity * oi.quantity;
          if (!map.has(ing.id)) {
            map.set(ing.id, {
              name: ing.name,
              unit: ing.default_unit,
              group: ing.inventory_groups?.name ?? "",
              consumed: 0,
              foods: new Map(),
            });
          }
          const entry = map.get(ing.id)!;
          entry.consumed += consumed;
          const foodEntry = entry.foods.get(fi.name) ?? { qtyConsumed: 0, timesSold: 0 };
          foodEntry.qtyConsumed += consumed;
          foodEntry.timesSold += oi.quantity;
          entry.foods.set(fi.name, foodEntry);
        }
      }
    }

    return Array.from(map.entries()).map(([ingredientId, entry]) => {
      const stockItem = stock.find((s) => s.ingredient_id === ingredientId);
      const currentStock = stockItem?.quantity ?? 0;
      const openingStock = currentStock + entry.consumed;
      return {
        ingredientId,
        name: entry.name,
        group: entry.group,
        unit: entry.unit,
        consumed: entry.consumed,
        currentStock,
        openingStock,
        foods: Array.from(entry.foods.entries()).map(([foodName, d]) => ({
          foodName,
          qtyConsumed: d.qtyConsumed,
          timesSold: d.timesSold,
        })),
      };
    }).sort((a, b) => b.consumed - a.consumed);
  }, [orders, stock]);

  // Daily breakdown
  const dailyBreakdown: DailyBreakdown[] = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const order of orders) {
      const day = order.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, new Map());
      for (const oi of order.order_items) {
        const fi = oi.food_items;
        if (!fi) continue;
        for (const fii of fi.food_item_ingredients) {
          const ing = fii.ingredients;
          if (!ing) continue;
          const consumed = fii.quantity * oi.quantity;
          const dayMap = map.get(day)!;
          dayMap.set(ing.id, (dayMap.get(ing.id) ?? 0) + consumed);
        }
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, byIngredient]) => ({ date, byIngredient }));
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ingredientRows;
    const q = search.toLowerCase();
    return ingredientRows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)
    );
  }, [ingredientRows, search]);

  const totalConsumedCount = ingredientRows.length;

  const handlePreset = (p: DatePreset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = getPresetRange(p);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const loading = loadingOrders || stockLoading;

  return (
    <>
      <Header title="Inventory History" />

      <div className="p-4 md:p-6 space-y-4">

        {/* ── Toolbar ── */}
        <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-2 flex-wrap">
          {/* Date preset tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  preset === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search ingredient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              width={13} height={13} viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>

        {/* ── Summary card ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package size={15} className="text-orange-500" />
              <p className="text-xs text-gray-500">Ingredients Consumed</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalConsumedCount}</p>
            <p className="text-xs text-gray-400 mt-1">unique ingredients used</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={15} className="text-blue-500" />
              <p className="text-xs text-gray-500">Days with Activity</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{dailyBreakdown.length}</p>
            <p className="text-xs text-gray-400 mt-1">days in range</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <p className="text-xs text-gray-500">Low Stock</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {ingredientRows.filter((r) => r.openingStock > 0 && r.currentStock / r.openingStock < 0.3).length}
            </p>
            <p className="text-xs text-gray-400 mt-1">ingredients below 30%</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={15} className="text-red-500" />
              <p className="text-xs text-gray-500">Critical</p>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {ingredientRows.filter((r) => r.openingStock > 0 && r.currentStock / r.openingStock < 0.1).length}
            </p>
            <p className="text-xs text-gray-400 mt-1">ingredients below 10%</p>
          </div>
        </div>

        {/* ── Main table ── */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="text-orange-400 animate-spin" />
            <p className="text-sm text-gray-400">Loading inventory history…</p>
          </div>
        ) : !activeRestaurant ? (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
            <Package size={44} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">Select a restaurant to view inventory history.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
            <Package size={44} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No inventory movement in this period</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or check that orders are marked as completed.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Ingredient Consumption</h2>
              <span className="text-xs text-gray-400">{filtered.length} ingredient{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Ingredient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Consumed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Opening Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Current Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((row) => (
                    <IngredientTableRow key={row.ingredientId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Daily Breakdown ── */}
        {!loading && dailyBreakdown.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">Daily Breakdown</h2>
              <p className="text-xs text-gray-400 mt-0.5">Consumption per ingredient by day</p>
            </div>
            <div className="divide-y divide-gray-50">
              {dailyBreakdown.map((day) => (
                <DailyBreakdownRow
                  key={day.date}
                  day={day}
                  allIngredients={ingredientRows}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ─── Daily breakdown row ──────────────────────────────────────────────────────
function DailyBreakdownRow({
  day,
  allIngredients,
}: {
  day: DailyBreakdown;
  allIngredients: IngredientRow[];
}) {
  const [expanded, setExpanded] = useState(false);

  const entries = Array.from(day.byIngredient.entries()).map(([id, qty]) => {
    const ing = allIngredients.find((r) => r.ingredientId === id);
    return { name: ing?.name ?? id, unit: ing?.unit ?? "", qty };
  }).sort((a, b) => b.qty - a.qty);

  const totalQty = entries.reduce((s, e) => s + e.qty, 0);

  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown size={14} className="text-gray-400" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{fmtDay(day.date)}</p>
            <p className="text-xs text-gray-400">{entries.length} ingredients consumed</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-8 pb-3">
          <div className="flex flex-wrap gap-2">
            {entries.map((e) => (
              <span
                key={e.name}
                className="inline-flex items-center gap-1 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1 text-xs text-gray-700"
              >
                <span className="font-medium">{e.name}</span>
                <span className="text-orange-500">{e.qty.toFixed(2)}</span>
                <span className="text-gray-400">{e.unit}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
