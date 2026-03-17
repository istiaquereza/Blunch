"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  BarChart3, CreditCard, Loader2, Search, ChevronDown, Calendar,
  Store, AlertCircle, CheckCircle2, Tag, ArrowLeftRight, X,
  MoveRight,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type DatePreset = "today" | "week" | "month" | "custom";

interface Filters {
  restaurantId: string; // "all" or uuid
  preset: DatePreset;
  customFrom: string;
  customTo: string;
  search: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function getRange(preset: DatePreset, from: string, to: string): [string, string] {
  const today = isoDate(new Date());
  if (preset === "today") return [today, today];
  if (preset === "week") {
    const d = new Date();
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    d.setDate(d.getDate() + diff);
    return [isoDate(d), today];
  }
  if (preset === "month") {
    const d = new Date();
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, today];
  }
  return [from || today, to || today];
}

function getPrevRange(from: string, to: string): [string, string] {
  const span = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - span + 1);
  return [isoDate(prevFrom), isoDate(prevTo)];
}

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ef4444", "#f59e0b", "#06b6d4"];

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  title, icon: Icon, color, curr, prev, inverse = false, isCount = false,
}: {
  title: string; icon: any; color: string;
  curr: number; prev: number; inverse?: boolean; isCount?: boolean;
}) {
  const pct = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
  const up = pct >= 0;
  const good = inverse ? !up : up;
  return (
    <div className="bg-white rounded-xl border border-border p-4 md:p-5 space-y-2 md:space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium leading-tight">{title}</p>
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon size={14} />
        </div>
      </div>
      <p className="text-xl md:text-2xl font-bold text-gray-900 truncate">
        {isCount ? curr : fmt(curr)}
      </p>
      <p className={`text-xs font-medium ${good ? "text-green-600" : "text-red-500"}`}>
        {up ? "+" : ""}{pct.toFixed(1)}% vs prev
      </p>
    </div>
  );
}

const RevTooltip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
      <p className="font-semibold text-gray-600 mb-0.5">{label}</p>
      <p className="text-orange-600 font-bold">{fmt(payload[0].value)}</p>
    </div>
  ) : null;

// ─── Transfer Modal ────────────────────────────────────────────────────────────
interface PaymentMethodRow { id: string; name: string; restaurant_id: string; }

function TransferModal({
  restaurants,
  onClose,
  onSuccess,
}: {
  restaurants: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [allMethods, setAllMethods] = useState<PaymentMethodRow[]>([]);
  const [fromRestaurant, setFromRestaurant] = useState(restaurants[0]?.id ?? "");
  const [toRestaurant,   setToRestaurant]   = useState(restaurants[0]?.id ?? "");
  const [fromMethod, setFromMethod] = useState("");
  const [toMethod,   setToMethod]   = useState("");
  const [amount, setAmount]         = useState("");
  const [note, setNote]             = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  // Load all payment methods once
  useEffect(() => {
    const supabase = createClient();
    supabase.from("payment_methods").select("id,name,restaurant_id").eq("is_active", true).order("name")
      .then(({ data }) => {
        setAllMethods(data ?? []);
        // Pre-select first available method for each side
        const first = (rid: string) => (data ?? []).find(m => m.restaurant_id === rid)?.id ?? "";
        setFromMethod(first(restaurants[0]?.id ?? ""));
        setToMethod(first(restaurants[0]?.id ?? ""));
      });
  }, []);

  const fromMethods = allMethods.filter(m => m.restaurant_id === fromRestaurant);
  const toMethods   = allMethods.filter(m => m.restaurant_id === toRestaurant);

  const handleFromRestaurant = (rid: string) => {
    setFromRestaurant(rid);
    setFromMethod(allMethods.find(m => m.restaurant_id === rid)?.id ?? "");
  };
  const handleToRestaurant = (rid: string) => {
    setToRestaurant(rid);
    setToMethod(allMethods.find(m => m.restaurant_id === rid)?.id ?? "");
  };

  const handleSubmit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!fromMethod || !toMethod)       { setError("Select both payment methods."); return; }
    if (fromMethod === toMethod)         { setError("From and To methods must be different."); return; }
    if (!amt || amt <= 0)                { setError("Enter a valid amount."); return; }

    setSaving(true);
    const supabase = createClient();
    const today = isoDate(new Date());
    const fromName = allMethods.find(m => m.id === fromMethod)?.name ?? "";
    const toName   = allMethods.find(m => m.id === toMethod)?.name ?? "";
    const desc = note.trim() || `Transfer: ${fromName} → ${toName}`;

    const { error: err } = await supabase.from("transactions").insert([
      {
        restaurant_id:    fromRestaurant,
        type:             "expense",
        amount:           amt,
        description:      desc,
        payment_method_id: fromMethod,
        status:           "paid",
        transaction_date: today,
      },
      {
        restaurant_id:    toRestaurant,
        type:             "income",
        amount:           amt,
        description:      desc,
        payment_method_id: toMethod,
        status:           "paid",
        transaction_date: today,
      },
    ]);

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-orange-500" />
            <h2 className="font-semibold text-gray-900">Transfer Between Methods</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* FROM / TO selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-start">

            {/* FROM */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</p>
              <select
                value={fromRestaurant}
                onChange={e => handleFromRestaurant(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select
                value={fromMethod}
                onChange={e => setFromMethod(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Select method…</option>
                {fromMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center justify-center sm:pt-8">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                <MoveRight size={15} className="text-orange-500" />
              </div>
            </div>
            {/* Mobile arrow */}
            <div className="flex sm:hidden items-center justify-center py-1">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center rotate-90">
                <MoveRight size={15} className="text-orange-500" />
              </div>
            </div>

            {/* TO */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</p>
              <select
                value={toRestaurant}
                onChange={e => handleToRestaurant(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select
                value={toMethod}
                onChange={e => setToMethod(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Select method…</option>
                {toMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">৳</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full h-10 pl-7 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note <span className="text-gray-300 font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. End-of-day cash to bKash"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Summary */}
          {fromMethod && toMethod && parseFloat(amount) > 0 && (
            <div className="bg-orange-50 rounded-xl px-4 py-3 text-xs text-orange-700 space-y-1">
              <p className="font-semibold">Transfer Summary</p>
              <p>
                <span className="font-medium">{fmt(parseFloat(amount))}</span> will be recorded as:
              </p>
              <p>• <span className="text-red-600 font-medium">Expense</span> from {allMethods.find(m => m.id === fromMethod)?.name} ({restaurants.find(r => r.id === fromRestaurant)?.name})</p>
              <p>• <span className="text-green-600 font-medium">Income</span> to {allMethods.find(m => m.id === toMethod)?.name} ({restaurants.find(r => r.id === toRestaurant)?.name})</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
              {saving ? "Transferring…" : "Confirm Transfer"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { restaurants, activeRestaurant } = useRestaurant();

  const [filters, setFilters] = useState<Filters>({
    restaurantId: "all",
    preset: "today",
    customFrom: "",
    customTo: "",
    search: "",
  });

  // Sync restaurant filter when active restaurant loads
  useEffect(() => {
    if (activeRestaurant) {
      setFilters(f => ({ ...f, restaurantId: activeRestaurant.id }));
    }
  }, [activeRestaurant?.id]);

  // ── Data state ──
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders]             = useState<any[]>([]);
  const [prevTx, setPrevTx]             = useState<any[]>([]);
  const [prevOrders, setPrevOrders]     = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);

  // Due transactions — fetched independently of date range
  const [dueTx, setDueTx]           = useState<any[]>([]);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    if (!restaurants.length) return;
    setLoading(true);
    const supabase = createClient();
    const [from, to] = getRange(filters.preset, filters.customFrom, filters.customTo);
    const [pFrom, pTo] = getPrevRange(from, to);

    const rIds: string[] =
      filters.restaurantId === "all"
        ? restaurants.map(r => r.id)
        : [filters.restaurantId];

    if (!rIds.length) { setLoading(false); return; }

    const [
      { data: txData },
      { data: orderData },
      { data: prevTxData },
      { data: prevOrderData },
      { data: dueData },
    ] = await Promise.all([
      supabase.from("transactions")
        .select("*, expense_categories(id,name,type), payment_methods(id,name)")
        .in("restaurant_id", rIds)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false }),

      supabase.from("orders")
        .select("*, order_items(*, food_items(id,name,sell_price))")
        .in("restaurant_id", rIds)
        .eq("status", "completed")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }),

      supabase.from("transactions")
        .select("type, amount")
        .in("restaurant_id", rIds)
        .gte("transaction_date", pFrom)
        .lte("transaction_date", pTo),

      supabase.from("orders")
        .select("id, total")
        .in("restaurant_id", rIds)
        .eq("status", "completed")
        .gte("created_at", pFrom)
        .lte("created_at", pTo + "T23:59:59"),

      // Due payments — all time, not date-filtered
      supabase.from("transactions")
        .select("*, expense_categories(id,name,type), payment_methods(id,name)")
        .in("restaurant_id", rIds)
        .eq("status", "due")
        .order("transaction_date", { ascending: true }),
    ]);

    setTransactions(txData ?? []);
    setOrders(orderData ?? []);
    setPrevTx(prevTxData ?? []);
    setPrevOrders(prevOrderData ?? []);
    setDueTx(dueData ?? []);
    setLoading(false);
  }, [filters.restaurantId, filters.preset, filters.customFrom, filters.customTo, restaurants]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Mark a due transaction as paid ──
  const markAsPaid = async (txId: string) => {
    setMarkingPaid(txId);
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ status: "paid" })
      .eq("id", txId);
    if (!error) {
      setDueTx(prev => prev.filter(t => t.id !== txId));
    }
    setMarkingPaid(null);
  };

  // ── Search filter on transactions ──
  const filteredTx = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.expense_categories?.name?.toLowerCase().includes(q) ||
      t.payment_methods?.name?.toLowerCase().includes(q)
    );
  }, [transactions, filters.search]);

  const filteredOrders = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      o.order_number?.toLowerCase().includes(q) ||
      (o.order_items ?? []).some((i: any) => i.food_items?.name?.toLowerCase().includes(q))
    );
  }, [orders, filters.search]);

  // ── Stat numbers ──
  const stats = useMemo(() => {
    const revenue  = filteredTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = filteredTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const pRevenue  = prevTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const pExpenses = prevTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalOrders  = filteredOrders.length;
    const pTotalOrders = prevOrders.length;
    const avg  = totalOrders  > 0 ? revenue  / totalOrders  : 0;
    const pAvg = pTotalOrders > 0 ? pRevenue / pTotalOrders : 0;
    return { revenue, expenses, pRevenue, pExpenses, totalOrders, pTotalOrders, avg, pAvg };
  }, [filteredTx, filteredOrders, prevTx, prevOrders]);

  // ── Revenue chart (hourly for today, daily otherwise) ──
  const revenueChart = useMemo(() => {
    const [from, to] = getRange(filters.preset, filters.customFrom, filters.customTo);
    const isToday = filters.preset === "today";

    if (isToday) {
      // hourly from completed orders (orders have a timestamp)
      const map = new Map<number, number>();
      filteredOrders.forEach(o => {
        const h = new Date(o.created_at).getHours();
        map.set(h, (map.get(h) ?? 0) + (o.total ?? 0));
      });
      if (!map.size) return [];
      return Array.from(map.keys()).sort((a, b) => a - b).map(h => ({
        label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "am" : "pm"}`,
        revenue: map.get(h) ?? 0,
      }));
    }

    // daily
    const days: { label: string; revenue: number }[] = [];
    const span = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
    for (let i = 0; i < Math.min(span, 31); i++) {
      const d = new Date(from); d.setDate(d.getDate() + i);
      const ds = isoDate(d);
      const label = span <= 7
        ? d.toLocaleDateString("en-BD", { weekday: "short" })
        : span <= 31
          ? String(d.getDate())
          : d.toLocaleDateString("en-BD", { day: "numeric", month: "short" });
      const revenue = filteredTx
        .filter(t => t.type === "income" && t.transaction_date === ds)
        .reduce((s, t) => s + t.amount, 0);
      days.push({ label, revenue });
    }
    return days;
  }, [filteredTx, filteredOrders, filters]);

  // ── Payment methods ──
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTx.filter(t => t.type === "income").forEach(t => {
      const name = t.payment_methods?.name ?? "Other";
      map.set(name, (map.get(name) ?? 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredTx]);

  // ── Expenses by category ──
  const expenseCats = useMemo(() => {
    const map = new Map<string, number>();
    filteredTx.filter(t => t.type === "expense").forEach(t => {
      const name = t.expense_categories?.name ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + t.amount);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTx]);

  // ── Orders by hour ──
  const ordersByHour = useMemo(() => {
    const map = new Map<number, number>();
    filteredOrders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      map.set(h, (map.get(h) ?? 0) + 1);
    });
    if (!map.size) return [];
    return Array.from(map.keys()).sort((a, b) => a - b).map(h => ({
      label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "am" : "pm"}`,
      orders: map.get(h) ?? 0,
    }));
  }, [filteredOrders]);

  // ── Top selling items ──
  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredOrders.forEach(o => {
      (o.order_items ?? []).forEach((item: any) => {
        const name = item.food_items?.name ?? "Unknown";
        const e = map.get(item.food_item_id) ?? { name, qty: 0, revenue: 0 };
        map.set(item.food_item_id, {
          name, qty: e.qty + item.quantity,
          revenue: e.revenue + item.unit_price * item.quantity,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredOrders]);

  const maxQty = topItems[0]?.qty ?? 1;

  // ── Period label ──
  const [from, to] = getRange(filters.preset, filters.customFrom, filters.customTo);
  const periodLabel =
    from === to
      ? new Date(from).toLocaleDateString("en-BD", { day: "numeric", month: "long", year: "numeric" })
      : `${new Date(from).toLocaleDateString("en-BD", { day: "numeric", month: "short" })} – ${new Date(to).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}`;

  const selectedRestaurantName =
    filters.restaurantId === "all" ? "All Restaurants"
    : restaurants.find(r => r.id === filters.restaurantId)?.name ?? "Restaurant";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {showTransfer && (
        <TransferModal
          restaurants={restaurants}
          onClose={() => setShowTransfer(false)}
          onSuccess={fetchData}
        />
      )}
      <Header
        title="Dashboard"
        hideRestaurantSelector
        rightContent={
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
            <span className="hidden sm:inline text-xs text-gray-400">{periodLabel}</span>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-5">

        {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border p-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">

          {/* Row 1 on mobile: restaurant + inline search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Store size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={filters.restaurantId}
                onChange={e => setFilters(f => ({ ...f, restaurantId: e.target.value }))}
                className="w-full sm:w-auto h-9 sm:h-8 pl-7 pr-7 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
              >
                <option value="all">All Restaurants</option>
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Search inline — mobile only */}
            <div className="relative flex-1 sm:hidden">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search…"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full h-9 pl-7 pr-7 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-gray-300"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters(f => ({ ...f, search: "" }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >×</button>
              )}
            </div>
          </div>

          {/* Date preset tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {(["today", "week", "month", "custom"] as DatePreset[]).map(p => (
              <button
                key={p}
                onClick={() => setFilters(f => ({ ...f, preset: p }))}
                className={`h-7 sm:h-6 px-2.5 sm:px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  filters.preset === p
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "Custom"}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {filters.preset === "custom" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Calendar size={13} className="text-gray-400" />
              <input
                type="date"
                value={filters.customFrom}
                onChange={e => setFilters(f => ({ ...f, customFrom: e.target.value }))}
                className="flex-1 min-w-0 h-9 sm:h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={filters.customTo}
                onChange={e => setFilters(f => ({ ...f, customTo: e.target.value }))}
                className="flex-1 min-w-0 h-9 sm:h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          {/* Spacer — desktop only */}
          <div className="hidden sm:block flex-1" />

          {/* Search — desktop only */}
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders, items, categories…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="h-8 w-56 pl-7 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-gray-300"
            />
            {filters.search && (
              <button
                onClick={() => setFilters(f => ({ ...f, search: "" }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >×</button>
            )}
          </div>

        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          <StatCard title="Total Revenue"    icon={DollarSign}   color="bg-green-50 text-green-600"  curr={stats.revenue}      prev={stats.pRevenue}      />
          <StatCard title="Total Expenses"   icon={TrendingDown} color="bg-red-50 text-red-600"      curr={stats.expenses}     prev={stats.pExpenses}     inverse />
          <StatCard title="Net Profit"       icon={TrendingUp}   color="bg-blue-50 text-blue-600"    curr={stats.revenue - stats.expenses} prev={stats.pRevenue - stats.pExpenses} />
          <StatCard title="Total Orders"     icon={ShoppingCart} color="bg-orange-50 text-orange-600" curr={stats.totalOrders} prev={stats.pTotalOrders}  isCount />
          <StatCard title="Avg Order Value"  icon={BarChart3}    color="bg-purple-50 text-purple-600" curr={stats.avg}         prev={stats.pAvg}          />
        </div>

        {/* ── Row 2: Revenue chart + Payment Methods ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {filters.preset === "today" ? "Revenue by Hour" : "Revenue by Day"}
              </h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{selectedRestaurantName}</span>
            </div>
            {revenueChart.length === 0 || revenueChart.every(d => d.revenue === 0) ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-300">No revenue data</div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <BarChart data={revenueChart} barSize={filters.preset === "month" ? 14 : 28}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `৳${v}`} width={55} />
                  <Tooltip content={<RevTooltip />} cursor={{ fill: "#fff7ed" }} />
                  <Bar dataKey="revenue" fill="#f97316" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Payment Methods</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-semibold transition-colors"
                >
                  <ArrowLeftRight size={12} />
                  Transfer
                </button>
                <CreditCard size={16} className="text-muted-foreground" />
              </div>
            </div>
            {paymentData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-300">No payment data</div>
            ) : (
              <div className="flex items-center gap-4 h-48">
                <ResponsiveContainer width="45%" height="100%">
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={3}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {paymentData.map((p, i) => {
                    const total = paymentData.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? (p.value / total) * 100 : 0;
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            {p.name}
                          </span>
                          <span className="text-gray-500">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Expenses + Orders by Hour + Top Items ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Expenses by Category</h3>
            {expenseCats.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-300">No expenses</div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-48">
                {expenseCats.map((cat, i) => (
                  <div key={cat.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 truncate max-w-[60%]">{cat.name}</span>
                      <span className="text-gray-500 font-semibold shrink-0">{fmt(cat.amount)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: `${cat.pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Orders by Hour</h3>
            {ordersByHour.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-300">No orders</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={ordersByHour} barSize={20}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip cursor={{ fill: "#fff7ed" }} formatter={(v: number) => [v, "orders"]} />
                  <Bar dataKey="orders" fill="#fb923c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Top Selling Items</h3>
            {topItems.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-300">No sales data</div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-4 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium text-gray-700 truncate">{item.name}</span>
                        <span className="text-orange-500 font-semibold shrink-0 ml-1">{item.qty}×</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${(item.qty / maxQty) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Due Payments ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              <h3 className="font-semibold text-gray-900">Due Payments</h3>
              {dueTx.length > 0 && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {dueTx.length}
                </span>
              )}
            </div>
            {dueTx.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Total Due</p>
                <p className="text-sm font-bold text-amber-600">
                  {fmt(dueTx.reduce((s, t) => s + t.amount, 0))}
                </p>
              </div>
            )}
          </div>

          {/* Body */}
          {dueTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-300">
              <CheckCircle2 size={32} />
              <p className="text-sm font-medium">All clear — no due payments</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {dueTx.map(tx => {
                const isOverdue = tx.transaction_date < isoDate(new Date());
                return (
                  <div key={tx.id} className="px-4 md:px-5 py-3 hover:bg-gray-50 transition-colors">

                    {/* Mobile layout: stacked */}
                    <div className="flex items-start gap-3">

                      {/* Date badge */}
                      <div className={`shrink-0 text-center w-9 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                        <p className="text-xs font-bold leading-none">
                          {new Date(tx.transaction_date).toLocaleDateString("en-BD", { day: "numeric" })}
                        </p>
                        <p className="text-xs leading-none mt-0.5">
                          {new Date(tx.transaction_date).toLocaleDateString("en-BD", { month: "short" })}
                        </p>
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {tx.description || "—"}
                          </p>
                          <p className="shrink-0 text-sm font-bold text-gray-800">
                            {fmt(tx.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {tx.expense_categories?.name && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Tag size={10} />
                              {tx.expense_categories.name}
                            </span>
                          )}
                          {tx.payment_methods?.name && (
                            <span className="text-xs text-gray-300">· {tx.payment_methods.name}</span>
                          )}
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            tx.type === "expense" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          }`}>
                            {tx.type}
                          </span>
                          {isOverdue && (
                            <span className="text-xs font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">
                              Overdue
                            </span>
                          )}
                        </div>
                        {/* Mark Paid — full width on mobile */}
                        <button
                          onClick={() => markAsPaid(tx.id)}
                          disabled={markingPaid === tx.id}
                          className="mt-2 md:hidden w-full h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {markingPaid === tx.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <CheckCircle2 size={11} />
                          }
                          Mark as Paid
                        </button>
                      </div>

                      {/* Mark Paid — inline on desktop */}
                      <button
                        onClick={() => markAsPaid(tx.id)}
                        disabled={markingPaid === tx.id}
                        className="hidden md:flex shrink-0 h-7 px-3 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-colors disabled:opacity-50 items-center gap-1"
                      >
                        {markingPaid === tx.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <CheckCircle2 size={11} />
                        }
                        Mark Paid
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
