"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useFoodStock } from "@/hooks/use-food-stock";
import { useIngredients } from "@/hooks/use-ingredients";
import { useInventoryGroups } from "@/hooks/use-inventory-groups";
import { useFoodStockLogs } from "@/hooks/use-food-stock-logs";
import { useRestockTransactions } from "@/hooks/use-restock-transactions";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useVendors } from "@/hooks/use-vendors";
import { useTransactions, useExpenseCategories } from "@/hooks/use-transactions";
import { Select } from "@/components/ui/select";
import { Layers, Search, Plus, AlertTriangle, CheckCircle2, XCircle, History, PackagePlus, Printer, Pencil, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { FoodStock } from "@/types";

const UNIT_OPTIONS: Record<string, string[]> = {
  weight: ["mg", "g", "lb", "kg"],
  volume: ["ml", "l", "cup", "tbsp"],
  unit: ["cm", "m", "inch", "ft"],
  quantity: ["pc", "dozen", "pack"],
};
const UNIT_TYPES = [
  { value: "weight", label: "Weight" },
  { value: "volume", label: "Volume" },
  { value: "unit", label: "Unit (Length)" },
  { value: "quantity", label: "Quantity" },
];


interface IngForm { name: string; unit_type: string; default_unit: string; unit_price: string; inventory_group_id: string; }

const LOW_THRESHOLD = 5;
const EMPTY_THRESHOLD = 0;

function stockStatus(qty: number): { label: string; variant: "danger" | "warning" | "success"; icon: React.ReactNode } {
  if (qty <= EMPTY_THRESHOLD) return { label: "Empty", variant: "danger", icon: <XCircle size={12} /> };
  if (qty <= LOW_THRESHOLD) return { label: "Low", variant: "warning", icon: <AlertTriangle size={12} /> };
  return { label: "Sufficient", variant: "success", icon: <CheckCircle2 size={12} /> };
}

type DatePreset = "today" | "week" | "month" | "all" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfWeek(now, { weekStartsOn: 1 }).toISOString() };
    case "month":
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    case "all":
      return {};
    case "custom":
      return {
        from: customFrom ? new Date(customFrom).toISOString() : undefined,
        to: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined,
      };
  }
}

// Reusable date filter bar component
function DateFilterBar({
  preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, onApplyCustom,
}: {
  preset: DatePreset; setPreset: (p: DatePreset) => void;
  customFrom: string; setCustomFrom: (v: string) => void;
  customTo: string; setCustomTo: (v: string) => void;
  onApplyCustom: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {DATE_PRESETS.map((p) => (
          <button key={p.value} onClick={() => setPreset(p.value)}
            className={`h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              preset === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          <Button size="sm" onClick={onApplyCustom}>Apply</Button>
        </div>
      )}
    </div>
  );
}

export default function FoodInventoryPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { stock, loading, upsert } = useFoodStock(rid);
  const { ingredients, update: updateIngredient } = useIngredients(rid);
  const { groups } = useInventoryGroups(rid);
  // Movements: food_stock_logs (both in/out from orders + manual)
  const { logs: movementLogs, loading: movementsLoading, fetchLogs: fetchMovements, createLog, clearLogs: clearMovements } = useFoodStockLogs(rid);
  const orderDrivenLogs = movementLogs.filter((l) => l.reason !== "manual_restock" && l.quantity_change < 0);
  // Stock In Summary: transactions table (source of truth for all restocks including older ones)
  const { entries: stockInEntries, loading: stockInLoading, fetchEntries: fetchStockIn, clear: clearStockIn } = useRestockTransactions(rid);
  const { methods: paymentMethods } = usePaymentMethods(rid);
  const { vendors } = useVendors();
  const { create: createTransaction } = useTransactions(rid);
  const { categories: expenseCategories, create: createExpenseCategory } = useExpenseCategories();

  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"group" | "stock">("stock");

  // Add stock dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<FoodStock | null>(null);
  const [addQty, setAddQty] = useState("");
  const [restockDate, setRestockDate] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "due">("paid");
  const [restockVendorId, setRestockVendorId] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit ingredient dialog
  const [editIngOpen, setEditIngOpen] = useState(false);
  const [editIngTarget, setEditIngTarget] = useState<{ id: string; current_qty: number; old_unit: string; old_unit_type: string; old_unit_price: number; old_name: string } | null>(null);
  const [editIngForm, setEditIngForm] = useState<IngForm>({ name: "", unit_type: "weight", default_unit: "g", unit_price: "", inventory_group_id: "" });
  const [editIngSaving, setEditIngSaving] = useState(false);

  // Stock Movements dialog
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [movementsIngredientId, setMovementsIngredientId] = useState("");
  const [movementsIngredientName, setMovementsIngredientName] = useState("");
  const [movementsPreset, setMovementsPreset] = useState<DatePreset>("all");
  const [movementsCustomFrom, setMovementsCustomFrom] = useState("");
  const [movementsCustomTo, setMovementsCustomTo] = useState("");

  // Stock In Summary dialog
  const [stockInOpen, setStockInOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stockInIngredientId, setStockInIngredientId] = useState("");
  const [stockInIngredientName, setStockInIngredientName] = useState("");
  const [stockInUnit, setStockInUnit] = useState("");
  const [stockInUnitPrice, setStockInUnitPrice] = useState(0);
  const [stockInPreset, setStockInPreset] = useState<DatePreset>("all");
  const [stockInCustomFrom, setStockInCustomFrom] = useState("");
  const [stockInCustomTo, setStockInCustomTo] = useState("");

  // Merge ingredients with their stock data
  const items = useMemo(() => {
    return ingredients.map((ing) => {
      const s = stock.find((st) => st.ingredient_id === ing.id);
      return { ingredient: ing, quantity: s?.quantity ?? 0, last_updated: s?.updated_at, stock_id: s?.id };
    });
  }, [ingredients, stock]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.ingredient.name.toLowerCase().includes(search.toLowerCase());
      const matchGroup = filterGroup ? item.ingredient.inventory_group_id === filterGroup : true;
      const matchStatus = filterStatus
        ? (filterStatus === "empty" && item.quantity <= 0) ||
          (filterStatus === "low" && item.quantity > 0 && item.quantity <= LOW_THRESHOLD) ||
          (filterStatus === "sufficient" && item.quantity > LOW_THRESHOLD)
        : true;
      return matchSearch && matchGroup && matchStatus;
    });
  }, [items, search, filterGroup, filterStatus]);

  // Stats
  const emptyCount = items.filter((i) => i.quantity <= 0).length;
  const lowCount = items.filter((i) => i.quantity > 0 && i.quantity <= LOW_THRESHOLD).length;
  const totalValue = items.reduce((s, i) => s + i.quantity * i.ingredient.unit_price, 0);

  // ── Open handlers ──
  const openAddStock = (ingredientId: string) => {
    const stockItem = stock.find((s) => s.ingredient_id === ingredientId);
    setAdjustItem(stockItem ?? {
      id: "", ingredient_id: ingredientId, restaurant_id: rid!, quantity: 0,
      updated_at: new Date().toISOString(),
    });
    setAddQty("");
    const today = new Date();
    setRestockDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
    setPaymentMethodId("");
    setPaymentStatus("paid");
    setRestockVendorId("");
    setAdjustOpen(true);
  };

  const openEditIngredient = (ingredient: (typeof ingredients)[0], currentQty: number) => {
    setEditIngTarget({ id: ingredient.id, current_qty: currentQty, old_unit: ingredient.default_unit, old_unit_type: ingredient.unit_type, old_unit_price: ingredient.unit_price, old_name: ingredient.name });
    setEditIngForm({ name: ingredient.name, unit_type: ingredient.unit_type, default_unit: ingredient.default_unit, unit_price: String(ingredient.unit_price), inventory_group_id: ingredient.inventory_group_id ?? "" });
    setEditIngOpen(true);
  };

  const handleSaveIngredient = async () => {
    if (!editIngTarget || !rid) return;
    if (!editIngForm.name.trim()) { toast.error("Name required"); return; }
    const newPrice = parseFloat(editIngForm.unit_price);
    if (isNaN(newPrice) || newPrice < 0) { toast.error("Valid unit price required"); return; }
    setEditIngSaving(true);

    const { error } = await updateIngredient(editIngTarget.id, {
      name: editIngForm.name.trim(),
      unit_type: editIngForm.unit_type as "weight" | "volume" | "unit" | "quantity",
      default_unit: editIngForm.default_unit,
      unit_price: newPrice,
      inventory_group_id: editIngForm.inventory_group_id || undefined,
    });
    if (error) { toast.error(error.message); setEditIngSaving(false); return; }

    // Reconcile past restock transactions: keep the qty number as-is (the user's intended amount),
    // update the unit label in the description and recalculate the amount with the new price.
    // This fixes cases where the ingredient was set up with wrong unit/price (e.g. "g"/1.4 instead of "kg"/1400).
    const unitChanged = editIngTarget.old_unit !== editIngForm.default_unit;
    const priceChanged = editIngTarget.old_unit_price !== newPrice;
    if ((unitChanged || priceChanged) && rid) {
      const supabase = createClient();
      const safeName = editIngTarget.old_name.replace(/[%_]/g, "\\$&");
      const { data: txRows } = await supabase
        .from("transactions")
        .select("id, description")
        .eq("restaurant_id", rid)
        .eq("type", "expense")
        .ilike("description", `Stock restock: ${safeName} +%`);

      let updatedCount = 0;
      for (const tx of txRows ?? []) {
        const match = tx.description?.match(/\+([0-9.]+)/);
        if (!match) continue;
        const qty = parseFloat(match[1]);
        if (isNaN(qty)) continue;
        const newAmount = parseFloat((qty * newPrice).toFixed(2));
        const newDesc = tx.description.replace(
          /\+[0-9.]+\s*\S*$/,
          `+${qty.toFixed(2)} ${editIngForm.default_unit}`
        );
        await supabase.from("transactions").update({ amount: newAmount, description: newDesc }).eq("id", tx.id);
        updatedCount++;
      }
      if (updatedCount > 0) {
        toast.success(`Ingredient updated! ${updatedCount} past transaction${updatedCount > 1 ? "s" : ""} recalculated.`);
      } else {
        toast.success("Ingredient updated!");
      }
    } else {
      toast.success("Ingredient updated!");
    }

    setEditIngOpen(false);
    setEditIngSaving(false);
  };

  const [reconciling, setReconciling] = useState(false);

  // Reconcile ALL restock transactions for ALL ingredients:
  // For each ingredient, find every "Stock restock: {name} +{qty}" transaction and
  // rewrite the amount as qty × current_unit_price and fix the unit label.
  const handleReconcileAll = async () => {
    if (!rid || ingredients.length === 0) return;
    setReconciling(true);
    const supabase = createClient();
    let totalFixed = 0;

    for (const ing of ingredients) {
      const safeName = ing.name.replace(/[%_]/g, "\\$&");
      const { data: txRows } = await supabase
        .from("transactions")
        .select("id, description, amount")
        .eq("restaurant_id", rid)
        .eq("type", "expense")
        .ilike("description", `Stock restock: ${safeName} +%`);

      for (const tx of txRows ?? []) {
        const match = tx.description?.match(/\+([0-9.]+)/);
        if (!match) continue;
        const qty = parseFloat(match[1]);
        if (isNaN(qty)) continue;
        const correctAmount = parseFloat((qty * ing.unit_price).toFixed(2));
        // Fix description: replace "+{old_qty} {old_unit}" with "+{qty} {current_unit}"
        const newDesc = (tx.description as string).replace(
          /\+[0-9.]+\s*\S*$/,
          `+${qty.toFixed(2)} ${ing.default_unit}`
        );
        const amountWrong = Math.abs(tx.amount - correctAmount) > 0.001;
        const descWrong = tx.description !== newDesc;
        if (amountWrong || descWrong) {
          await supabase.from("transactions")
            .update({ amount: correctAmount, description: newDesc })
            .eq("id", tx.id);
          totalFixed++;
        }
      }
    }

    setReconciling(false);
    if (totalFixed > 0) {
      toast.success(`Fixed ${totalFixed} transaction${totalFixed > 1 ? "s" : ""}. Reload Income & Expenses to see updated values.`);
    } else {
      toast.info("All restock transactions are already correct.");
    }
  };

  const openMovements = (ingredientId: string, ingredientName: string) => {
    setMovementsIngredientId(ingredientId);
    setMovementsIngredientName(ingredientName);
    setMovementsPreset("all");
    setMovementsCustomFrom("");
    setMovementsCustomTo("");
    fetchMovements(ingredientId);
    setMovementsOpen(true);
  };

  const applyMovementsPreset = (preset: DatePreset) => {
    setMovementsPreset(preset);
    if (preset !== "custom") {
      const { from, to } = getDateRange(preset, movementsCustomFrom, movementsCustomTo);
      fetchMovements(movementsIngredientId, from, to);
    }
  };

  const printStockIn = () => {
    const presetLabel: Record<string, string> = { today: "Today", week: "This Week", month: "This Month", all: "All Time", custom: `${stockInCustomFrom} – ${stockInCustomTo}` };
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Stock In Summary — ${stockInIngredientName}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.sub { font-size: 12px; color: #666; margin-bottom: 20px; }
        .summary { display: flex; gap: 16px; margin-bottom: 20px; }
        .card { flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .card .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .05em; margin-bottom: 4px; }
        .card .value { font-size: 20px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: .05em; }
        td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
        .qty { color: #16a34a; font-weight: 600; }
        .cost { font-weight: 500; }
        @media print { button { display: none; } }
      </style></head><body>
      <h1>Stock In Summary — ${stockInIngredientName}</h1>
      <p class="sub">Period: ${presetLabel[stockInPreset] ?? stockInPreset} &nbsp;|&nbsp; Printed: ${format(new Date(), "dd MMM yyyy, HH:mm")}</p>
      <div class="summary">
        <div class="card"><div class="label">Total Quantity In</div><div class="value">${totalStockIn.toFixed(2)} ${stockInUnit}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">${stockInEntries.length} restock entries</div></div>
        <div class="card"><div class="label">Total Cost</div><div class="value">৳${totalStockInCost.toFixed(2)}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">৳${stockInUnitPrice.toFixed(2)} / ${stockInUnit}</div></div>
      </div>
      <table>
        <thead><tr><th>Date & Time</th><th>Qty Added</th><th>Cost</th></tr></thead>
        <tbody>${stockInEntries.map(e => `<tr><td>${format(new Date(e.createdAt), "dd MMM yyyy, HH:mm")}</td><td class="qty">+${e.qty.toFixed(2)} ${stockInUnit}</td><td class="cost">৳${e.amount.toFixed(2)}</td></tr>`).join("")}</tbody>
      </table>
      <script>window.onload = () => window.print();<\/script>
      </body></html>`);
    win.document.close();
  };

  const openStockIn = (ingredientId: string, ingredientName: string, unit: string, unitPrice: number) => {
    setStockInIngredientId(ingredientId);
    setStockInIngredientName(ingredientName);
    setStockInUnit(unit);
    setStockInUnitPrice(unitPrice);
    setStockInPreset("all");
    setStockInCustomFrom("");
    setStockInCustomTo("");
    fetchStockIn(ingredientName); // fetch all-time by default
    setStockInOpen(true);
  };

  const applyStockInPreset = (preset: DatePreset) => {
    setStockInPreset(preset);
    if (preset !== "custom") {
      const { from, to } = getDateRange(preset, stockInCustomFrom, stockInCustomTo);
      fetchStockIn(stockInIngredientName, from, to);
    }
  };

  // ── Kitchen Expenses category helper ──
  const getKitchenExpensesCategoryId = async (): Promise<string | null> => {
    const existing = expenseCategories.find(
      (c) => c.type === "expense" && c.name.toLowerCase() === "kitchen expenses"
    );
    if (existing) return existing.id;
    const { error } = await createExpenseCategory("Kitchen Expenses", "expense");
    if (error) return null;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("expense_categories").select("id").eq("user_id", user.id)
      .ilike("name", "kitchen expenses").limit(1);
    return data?.[0]?.id ?? null;
  };

  // ── Add Stock handler ──
  const handleAddStock = async () => {
    if (!adjustItem || !rid) return;
    const qty = parseFloat(addQty);
    if (isNaN(qty) || qty <= 0) return toast.error("Enter a quantity greater than 0");
    setSaving(true);

    const currentQty = adjustItem.quantity ?? 0;
    const newTotal = currentQty + qty;
    const ingredient = ingredients.find((i) => i.id === adjustItem.ingredient_id);

    const { error } = await upsert(adjustItem.ingredient_id, newTotal);
    if (error) { toast.error(error.message); setSaving(false); return; }

    // Write stock log entry so Stock In Summary can show this restock
    // Use restockDate (may be backdated) as the created_at timestamp
    const logCreatedAt = restockDate
      ? (() => { const [y, m, d] = restockDate.split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0).toISOString(); })()
      : new Date().toISOString();
    await createLog({
      ingredient_id: adjustItem.ingredient_id,
      quantity_change: qty,
      reason: "manual_restock",
      created_at: logCreatedAt,
    });

    if (ingredient) {
      const amount = qty * (ingredient.unit_price ?? 0);
      if (amount > 0) {
        const categoryId = await getKitchenExpensesCategoryId();
        const txDate = restockDate || (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        })();
        const { error: txError } = await createTransaction({
          restaurant_id: rid, type: "expense", amount,
          description: `Stock restock: ${ingredient.name} +${qty.toFixed(2)} ${ingredient.default_unit}`,
          category_id: categoryId ?? undefined,
          payment_method_id: paymentMethodId || undefined,
          status: paymentStatus,
          transaction_date: txDate,
        });
        if (txError) toast.warning("Stock updated but expense could not be recorded");
      }
    }

    toast.success("Stock updated!");
    setAdjustOpen(false);
    setSaving(false);
  };

  if (!rid) return (
    <div><Header title="Food Inventory" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
        <Layers size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
        <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
      </div></div>
    </div>
  );

  const adjustIngredient = adjustItem ? ingredients.find((i) => i.id === adjustItem.ingredient_id) : null;
  const addQtyNum = parseFloat(addQty);
  const addedAmount = !isNaN(addQtyNum) && addQtyNum > 0 && adjustIngredient
    ? addQtyNum * adjustIngredient.unit_price : 0;
  const activePayments = paymentMethods.filter((p) => p.is_active);

  // Stock In summary stats — sourced from transactions table
  const totalStockIn = stockInEntries.reduce((s, e) => s + e.qty, 0);
  const totalStockInCost = stockInEntries.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <Header title="Food Inventory" />
      <div className="p-6 space-y-4">

        {/* ── Toolbar ── */}
        <div className="bg-white border border-border rounded-xl shadow-sm shrink-0 h-[62px] flex items-center px-6 gap-4 overflow-x-auto">
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
              className="h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">All Groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">All Status</option>
              <option value="empty">Empty</option>
              <option value="low">Low Stock</option>
              <option value="sufficient">Sufficient</option>
            </select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleReconcileAll} loading={reconciling} title="Recalculate all restock transaction costs from current ingredient prices">
            <RefreshCcw size={13} /> Reconcile Costs
          </Button>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients..."
              className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-[18px]">
          {[
            { label: "Total Ingredients", value: items.length, sub: "tracked", color: "text-gray-900" },
            { label: "Total Stock Value", value: `৳${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "estimated", color: "text-gray-900" },
            { label: "Low Stock", value: lowCount, sub: "need restocking", color: lowCount > 0 ? "text-amber-600" : "text-gray-900" },
            { label: "Empty / Out", value: emptyCount, sub: "urgent", color: emptyCount > 0 ? "text-red-600" : "text-gray-900" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-border shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex border-b border-border">
            {([
              { key: "group", label: "Group Level Inventory" },
              { key: "stock", label: "Stock Level" },
            ] as { key: "group" | "stock"; label: string }[]).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Group Level ── */}
          {activeTab === "group" && (
            <div className="overflow-x-auto">
              {groups.length === 0 ? (
                <div className="p-12 text-center">
                  <Layers size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No groups defined yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100">
                      {["Group", "Total Items", "Total Value", "Low Stock"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {groups.map((g) => {
                      const groupItems = items.filter((i) => i.ingredient.inventory_group_id === g.id);
                      const groupValue = groupItems.reduce((s, i) => s + i.quantity * i.ingredient.unit_price, 0);
                      const groupLow = groupItems.filter((i) => i.quantity > 0 && i.quantity <= LOW_THRESHOLD).length;
                      const groupEmpty = groupItems.filter((i) => i.quantity <= 0).length;
                      return (
                        <tr key={g.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-900">{g.name}</td>
                          <td className="px-5 py-3 text-gray-600">{groupItems.length}</td>
                          <td className="px-5 py-3 text-gray-600">৳{groupValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {groupLow > 0 && <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">{groupLow} low</span>}
                              {groupEmpty > 0 && <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">{groupEmpty} empty</span>}
                              {groupLow === 0 && groupEmpty === 0 && <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Stock Level ── */}
          {activeTab === "stock" && (
            <>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h3 className="text-gray-700 text-sm">Stock Levels <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <Layers size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No ingredients found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-100">
                        {["Ingredient", "Group", "Unit", "Unit Price", "Current Stock", "Stock Value", "Status", "Last Updated", "", "", "", ""].map((h, i) => (
                          <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map(({ ingredient, quantity, last_updated }) => {
                        const status = stockStatus(quantity);
                        return (
                          <tr key={ingredient.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900">{ingredient.name}</td>
                            <td className="px-4 py-3">{ingredient.inventory_groups ? <Badge variant="purple">{ingredient.inventory_groups.name}</Badge> : <span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="px-4 py-3 text-gray-500">{ingredient.default_unit}</td>
                            <td className="px-4 py-3 text-gray-600">৳{Number(ingredient.unit_price).toFixed(2)}</td>
                            <td className="px-4 py-3 text-gray-700">{quantity}</td>
                            <td className="px-4 py-3 text-gray-600">৳{(quantity * ingredient.unit_price).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.variant === "success" ? "bg-green-50 text-green-700" : status.variant === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                {status.icon}{status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{last_updated ? format(new Date(last_updated), "dd MMM, HH:mm") : "—"}</td>
                            {/* Add Stock */}
                            <td className="px-2 py-3">
                              <Button variant="ghost" size="sm" title="Add stock" onClick={() => openAddStock(ingredient.id)}>
                                <Plus size={13} />
                              </Button>
                            </td>
                            {/* Stock Movements */}
                            <td className="px-2 py-3">
                              <Button variant="ghost" size="sm" title="Stock movements" onClick={() => openMovements(ingredient.id, ingredient.name)}>
                                <History size={13} />
                              </Button>
                            </td>
                            {/* Stock In Summary */}
                            <td className="px-2 py-3">
                              <Button variant="ghost" size="sm" title="Stock in summary" onClick={() => openStockIn(ingredient.id, ingredient.name, ingredient.default_unit, ingredient.unit_price)}>
                                <PackagePlus size={13} />
                              </Button>
                            </td>
                            {/* Edit Ingredient */}
                            <td className="px-2 py-3">
                              <Button variant="ghost" size="sm" title="Edit ingredient" onClick={() => openEditIngredient(ingredient, quantity)}>
                                <Pencil size={13} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Stock Movements Dialog ── */}
      <Dialog
        open={movementsOpen}
        onOpenChange={(open) => { setMovementsOpen(open); if (!open) clearMovements(); }}
        title={`Stock Movements — ${movementsIngredientName}`}
        footer={<Button variant="outline" onClick={() => setMovementsOpen(false)}>Close</Button>}
      >
        <div className="space-y-3">
          <DateFilterBar
            preset={movementsPreset} setPreset={applyMovementsPreset}
            customFrom={movementsCustomFrom} setCustomFrom={setMovementsCustomFrom}
            customTo={movementsCustomTo} setCustomTo={setMovementsCustomTo}
            onApplyCustom={() => {
              const { from, to } = getDateRange("custom", movementsCustomFrom, movementsCustomTo);
              fetchMovements(movementsIngredientId, from, to);
            }}
          />
          <div className="max-h-[400px] overflow-y-auto">
            {movementsLoading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : movementLogs.length === 0 ? (
              <div className="text-center py-10">
                <History size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No stock changes in this period.</p>
              </div>
            ) : orderDrivenLogs.length === 0 ? (
              <div className="text-center py-10">
                <History size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No order-driven reductions in this period.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Date & Time</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Order</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Change</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orderDrivenLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-3 text-gray-400 text-xs whitespace-nowrap">{format(new Date(log.created_at), "dd MMM, HH:mm")}</td>
                      <td className="py-2.5 pr-3 text-gray-600 text-xs">{log.order_number ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-xs">
                        <span className="text-red-600">{Number(log.quantity_change).toFixed(3)}</span>
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs capitalize">{log.reason.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Dialog>

      {/* ── Stock In Summary Dialog ── */}
      <Dialog
        open={stockInOpen}
        onOpenChange={(open) => { setStockInOpen(open); if (!open) clearStockIn(); }}
        title={`Stock In Summary — ${stockInIngredientName}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={printStockIn} disabled={stockInEntries.length === 0}>
              <Printer size={13} /> Print / PDF
            </Button>
            <Button variant="outline" onClick={() => setStockInOpen(false)}>Close</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <DateFilterBar
            preset={stockInPreset} setPreset={applyStockInPreset}
            customFrom={stockInCustomFrom} setCustomFrom={setStockInCustomFrom}
            customTo={stockInCustomTo} setCustomTo={setStockInCustomTo}
            onApplyCustom={() => {
              const { from, to } = getDateRange("custom", stockInCustomFrom, stockInCustomTo);
              fetchStockIn(stockInIngredientName, from, to);
            }}
          />

          {stockInLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : (
            <>
              {/* Summary totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Total Quantity In</p>
                  <p className="text-xl font-bold text-green-700">{totalStockIn.toFixed(2)} <span className="text-sm font-normal">{stockInUnit}</span></p>
                  <p className="text-xs text-green-500 mt-0.5">{stockInEntries.length} restock entries</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">Total Cost</p>
                  <p className="text-xl font-bold text-orange-700">৳{totalStockInCost.toFixed(2)}</p>
                  <p className="text-xs text-orange-500 mt-0.5">৳{stockInUnitPrice.toFixed(2)} / {stockInUnit}</p>
                </div>
              </div>

              {/* Restock entries table */}
              {stockInEntries.length === 0 ? (
                <div className="text-center py-8">
                  <PackagePlus size={32} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No stock added in this period.</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Date & Time</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Qty Added</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Cost</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stockInEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-2.5 pr-3 text-gray-400 text-xs whitespace-nowrap">{format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm")}</td>
                          <td className="py-2.5 pr-3 text-right font-semibold text-xs text-green-600">
                            +{entry.qty.toFixed(2)} {stockInUnit}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-xs text-gray-700 font-medium">
                            ৳{entry.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-gray-400 text-xs">Manual restock</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Dialog>

      {/* ── Edit Ingredient Dialog ── */}
      <Dialog
        open={editIngOpen}
        onOpenChange={setEditIngOpen}
        title="Edit Ingredient"
        footer={
          <><Button variant="outline" onClick={() => setEditIngOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveIngredient} loading={editIngSaving}>Save Changes</Button></>
        }
      >
        <div className="space-y-4">
          <Input label="Ingredient Name" value={editIngForm.name} onChange={(e) => setEditIngForm(p => ({ ...p, name: e.target.value }))} />
          <Select label="Unit Type" value={editIngForm.unit_type}
            onChange={(e) => setEditIngForm(p => ({ ...p, unit_type: e.target.value, default_unit: UNIT_OPTIONS[e.target.value]?.[0] ?? "" }))}
            options={UNIT_TYPES}
          />
          <Select label="Default Unit" value={editIngForm.default_unit}
            onChange={(e) => setEditIngForm(p => ({ ...p, default_unit: e.target.value }))}
            options={(UNIT_OPTIONS[editIngForm.unit_type] ?? []).map(u => ({ value: u, label: u }))}
          />
          <Input label={`Unit Price (৳ per ${editIngForm.default_unit})`} type="number" min="0" step="0.01" placeholder="0.00"
            value={editIngForm.unit_price} onChange={(e) => setEditIngForm(p => ({ ...p, unit_price: e.target.value }))}
          />
          {editIngTarget && (editIngTarget.old_unit !== editIngForm.default_unit || editIngTarget.old_unit_price !== parseFloat(editIngForm.unit_price || "0")) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Past transactions will be recalculated</p>
              <p>All <em>Stock restock</em> entries for this ingredient will be updated — the quantity number stays the same but the unit label and cost will reflect the new settings.</p>
              {editIngTarget.old_unit !== editIngForm.default_unit && (
                <p>Example: <strong>+105.00 {editIngTarget.old_unit}</strong> → <strong>+105.00 {editIngForm.default_unit || "…"}</strong> at ৳{editIngForm.unit_price || "0"}/{editIngForm.default_unit || "…"} = ৳{(105 * parseFloat(editIngForm.unit_price || "0")).toLocaleString()}</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Inventory Group</label>
            <select value={editIngForm.inventory_group_id} onChange={(e) => setEditIngForm(p => ({ ...p, inventory_group_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      </Dialog>

      {/* ── Add Stock Dialog ── */}
      <Dialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title="Add Stock"
        footer={
          <><Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStock} loading={saving}>Add Stock</Button></>
        }
      >
        {adjustIngredient && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="font-medium text-gray-800">{adjustIngredient.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Current stock: <strong>{adjustItem?.quantity ?? 0} {adjustIngredient.default_unit}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={restockDate}
                max={(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; })()}
                onChange={(e) => setRestockDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {restockDate !== (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; })() && (
                <p className="text-xs text-amber-600">Backdated entry — recording for a previous date</p>
              )}
            </div>

            <Input
              label={`Quantity to Add (${adjustIngredient.default_unit})`}
              type="number" min="0.01" step="0.01" placeholder="0"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              hint={`Unit price: ৳${adjustIngredient.unit_price} / ${adjustIngredient.default_unit}`}
            />

            {addQtyNum > 0 && !isNaN(addQtyNum) && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                <p className="text-xs text-blue-700">
                  New total: <strong>{((adjustItem?.quantity ?? 0) + addQtyNum).toFixed(2)} {adjustIngredient.default_unit}</strong>
                </p>
              </div>
            )}

            {addedAmount > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 space-y-3">
                <p className="text-sm font-medium text-orange-700">
                  Cost: <strong>৳{addedAmount.toFixed(2)}</strong> — will be logged as a Kitchen Expense
                </p>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Payment Status</p>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                    {([
                      { value: "paid", label: "Paid" },
                      { value: "due", label: "Unpaid / Due" },
                    ] as { value: "paid" | "due"; label: string }[]).map((s) => (
                      <button key={s.value} onClick={() => setPaymentStatus(s.value)}
                        className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                          paymentStatus === s.value ? "bg-[#111827] text-white" : "text-gray-500 hover:bg-gray-50"
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Payment Method</p>
                  <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    <option value="">Select payment method…</option>
                    {activePayments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Vendor <span className="text-gray-400">(optional)</span></p>
                  <select value={restockVendorId} onChange={(e) => setRestockVendorId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    <option value="">Select vendor…</option>
                    {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ""}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
