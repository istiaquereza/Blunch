"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useProductRequisitions, shortReqId } from "@/hooks/use-product-requisitions";
import { useIngredients } from "@/hooks/use-ingredients";
import { useInventoryGroups } from "@/hooks/use-inventory-groups";
import { useVendors } from "@/hooks/use-vendors";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useBazarCategories } from "@/hooks/use-bazar-categories";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingCart, Plus, Trash2, ChevronDown, ChevronUp,
  Check, X, Eye, Search, AlertCircle, Edit2, Printer,
  Zap, Loader2, ChefHat, Calendar as CalendarIcon,
  Tag, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import type { ProductRequisition } from "@/types";

// ─── Date preset helpers ───────────────────────────────────
type DatePreset = "today" | "last7" | "this_month" | "last_month" | "all" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today",      label: "Today" },
  { value: "last7",      label: "Last 7 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "all",        label: "All Time" },
  { value: "custom",     label: "Custom Range" },
];

function getDateRange(
  preset: DatePreset, customFrom: string, customTo: string
): { from: string; to: string } | null {
  const now = new Date();
  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "today":      return { from: ymd(now), to: ymd(now) };
    case "last7":      return { from: ymd(subDays(now, 6)), to: ymd(now) };
    case "this_month": return { from: ymd(startOfMonth(now)), to: ymd(endOfMonth(now)) };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { from: ymd(startOfMonth(prev)), to: ymd(endOfMonth(prev)) };
    }
    case "custom": return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    default:           return null; // all time — no filter
  }
}

interface ReqItemRow {
  ingredient_id: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

const statusBadge = (s: ProductRequisition["status"]) =>
  s === "approved" ? "success" : s === "rejected" ? "danger" : "warning";

const statusLabel: Record<ProductRequisition["status"], string> = {
  submitted: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

// ─── PDF Print helper ─────────────────────────────────────
function printRequisition(req: ProductRequisition, restaurantName?: string) {
  const total = req.product_requisition_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
  const rows = req.product_requisition_items?.map((item) => `
    <tr>
      <td>${item.ingredients?.name ?? "—"}</td>
      <td style="text-align:right">${item.quantity}</td>
      <td style="text-align:right">${item.unit}</td>
      <td style="text-align:right">৳${item.unit_price.toFixed(2)}</td>
      <td style="text-align:right">৳${item.total_price.toFixed(2)}</td>
    </tr>
  `).join("") ?? "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Bazar List — ${format(new Date(req.requisition_date), "dd MMM yyyy")}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; border-bottom: 2px solid #333; padding: 6px 4px; font-size: 11px; text-transform: uppercase; }
  td { padding: 6px 4px; border-bottom: 1px solid #eee; }
  .total-row td { border-top: 2px solid #333; font-weight: bold; }
  .badge { display:inline-block; padding: 2px 8px; border-radius: 99px; font-size:11px;
    background: ${req.status === "approved" ? "#d1fae5" : req.status === "rejected" ? "#fee2e2" : "#fef3c7"};
    color: ${req.status === "approved" ? "#065f46" : req.status === "rejected" ? "#991b1b" : "#92400e"};
  }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>Bazar Requisition List</h1>
  <div class="meta">
    ${restaurantName ? `<strong>${restaurantName}</strong> &nbsp;·&nbsp; ` : ""}
    Date: <strong>${format(new Date(req.requisition_date), "dd MMM yyyy")}</strong>
    &nbsp;·&nbsp; Status: <span class="badge">${statusLabel[req.status]}</span>
    ${req.notes ? `<br>Notes: ${req.notes}` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Ingredient</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4" style="text-align:right">Grand Total</td>
        <td style="text-align:right">৳${total.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

// ─── Requisition Automation Modal ─────────────────────────────────────────────
const SAVED_LISTS_KEY = "bazar_auto_food_lists";

interface MenuItemRow { food_item_id: string; name: string; qty: number; req_qty: string; }
interface IngredientComputedRow {
  ingredient_id: string;
  name: string;
  unit: string;
  qty_needed: number;
  in_stock: number;
  deficit: number;
  enough: boolean;
  req_qty: string;
}
interface SavedList { name: string; items: { id: string; name: string; qty: number }[]; }

function RequisitionAutomationModal({
  rid, ingredients, vendors, onUse, onClose,
}: {
  rid: string;
  ingredients: any[];
  vendors: any[];
  onUse: (items: ReqItemRow[], vendorId?: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"date" | "food">("date");
  const [vendorId, setVendorId] = useState("");

  // Shared results
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [ingredientRows, setIngredientRows] = useState<IngredientComputedRow[]>([]);
  const [computing, setComputing] = useState(false);
  const [computed, setComputed] = useState(false);

  // Tab 1
  const [autoDate, setAutoDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Tab 2
  const [allFoods, setAllFoods] = useState<any[]>([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [foodSearch, setFoodSearch] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<{ id: string; name: string; qty: number }[]>([]);

  // Saved lists
  const [savedLists, setSavedLists] = useState<SavedList[]>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_LISTS_KEY) ?? "[]"); } catch { return []; }
  });
  const [showSaveDlg, setShowSaveDlg] = useState(false);
  const [listName, setListName] = useState("");

  // Fetch food items for tab 2
  useEffect(() => {
    if (!rid) return;
    setLoadingFoods(true);
    createClient()
      .from("food_items")
      .select("id, name, food_item_restaurants!inner(restaurant_id)")
      .eq("food_item_restaurants.restaurant_id", rid)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => { setAllFoods(data ?? []); setLoadingFoods(false); });
  }, [rid]);

  // Core: compute ingredient breakdown from soldMap (food_item_id → qty)
  const computeIngredients = async (soldMap: Map<string, number>, menuRows: MenuItemRow[]) => {
    const supabase = createClient();
    const foodItemIds = Array.from(soldMap.keys()).filter(Boolean);

    if (foodItemIds.length === 0) {
      setMenuItems(menuRows);
      setIngredientRows([]);
      setComputed(true);
      return;
    }

    // Step 1: fetch recipe entries (no join — more reliable)
    const { data: fiiData, error: fiiError } = await supabase
      .from("food_item_ingredients")
      .select("food_item_id, ingredient_id, quantity, unit")
      .in("food_item_id", foodItemIds);

    if (fiiError) {
      toast.error(`Failed to fetch recipes: ${fiiError.message}`);
      setComputed(true);
      return;
    }

    if (!fiiData || fiiData.length === 0) {
      setMenuItems(menuRows);
      setIngredientRows([]);
      setComputed(true);
      toast.warning(`No recipes found for ${menuRows.length} menu item(s). Go to Food Items → open an item → add its ingredient recipe.`);
      return;
    }

    // Step 2: aggregate ingredient quantities
    const ingQtyMap = new Map<string, { unit: string; qty_needed: number }>();
    for (const fii of fiiData) {
      const foodQty = soldMap.get(fii.food_item_id) ?? 0;
      const totalQty = (fii.quantity ?? 0) * foodQty;
      const existing = ingQtyMap.get(fii.ingredient_id);
      if (existing) {
        existing.qty_needed += totalQty;
      } else {
        ingQtyMap.set(fii.ingredient_id, { unit: fii.unit ?? "", qty_needed: totalQty });
      }
    }

    // Step 3: fetch ingredient names separately
    const ingredientIds = Array.from(ingQtyMap.keys());
    const { data: ingData } = await supabase
      .from("ingredients")
      .select("id, name, default_unit")
      .in("id", ingredientIds);

    const ingNameMap = new Map<string, { name: string; default_unit: string }>();
    for (const ing of ingData ?? []) ingNameMap.set(ing.id, { name: ing.name, default_unit: ing.default_unit ?? "" });

    const ingMap = new Map<string, { name: string; unit: string; qty_needed: number }>();
    for (const [id, info] of ingQtyMap.entries()) {
      const ing = ingNameMap.get(id);
      ingMap.set(id, {
        name: ing?.name ?? id,
        unit: info.unit || ing?.default_unit || "",
        qty_needed: info.qty_needed,
      });
    }

    if (ingMap.size === 0) {
      setMenuItems(menuRows);
      setIngredientRows([]);
      setComputed(true);
      toast.warning("Recipe entries found but ingredient details could not be loaded.");
      return;
    }

    const { data: stockData } = await supabase
      .from("food_stock")
      .select("ingredient_id, quantity")
      .eq("restaurant_id", rid)
      .in("ingredient_id", Array.from(ingMap.keys()));

    const stockMap = new Map<string, number>();
    for (const s of stockData ?? []) stockMap.set(s.ingredient_id, s.quantity ?? 0);

    const rows: IngredientComputedRow[] = Array.from(ingMap.entries())
      .map(([id, info]) => {
        const inStock = stockMap.get(id) ?? 0;
        const deficit = Math.max(0, info.qty_needed - inStock);
        return {
          ingredient_id: id,
          name: info.name,
          unit: info.unit,
          qty_needed: parseFloat(info.qty_needed.toFixed(3)),
          in_stock: inStock,
          deficit: parseFloat(deficit.toFixed(3)),
          enough: deficit <= 0,
          req_qty: deficit > 0 ? String(parseFloat(deficit.toFixed(3))) : "0",
        };
      })
      .sort((a, b) => (a.enough ? 1 : 0) - (b.enough ? 1 : 0) || a.name.localeCompare(b.name));

    setMenuItems(menuRows);
    setIngredientRows(rows);
    setComputed(true);
  };

  // Tab 1: compute from date
  const computeFromDate = async () => {
    setComputing(true);
    setComputed(false);
    const supabase = createClient();

    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_items(food_item_id, quantity)")
      .eq("restaurant_id", rid)
      .eq("status", "completed")
      .gte("created_at", `${autoDate}T00:00:00`)
      .lte("created_at", `${autoDate}T23:59:59`);

    if (!orders || orders.length === 0) {
      setMenuItems([]);
      setIngredientRows([]);
      setComputed(true);
      setComputing(false);
      toast.info("No completed orders found for this date");
      return;
    }

    const soldMap = new Map<string, number>();
    for (const order of orders) {
      for (const item of (order as any).order_items ?? []) {
        if (item.food_item_id) soldMap.set(item.food_item_id, (soldMap.get(item.food_item_id) ?? 0) + item.quantity);
      }
    }

    const { data: foodData } = await supabase
      .from("food_items")
      .select("id, name")
      .in("id", Array.from(soldMap.keys()).filter(Boolean));

    const menuRows: MenuItemRow[] = (foodData ?? [])
      .map((f: any) => ({ food_item_id: f.id, name: f.name, qty: soldMap.get(f.id) ?? 0, req_qty: String(soldMap.get(f.id) ?? 0) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    await computeIngredients(soldMap, menuRows);
    setComputing(false);
  };

  // Tab 2: compute from selection
  const computeFromSelection = async () => {
    if (selectedFoods.length === 0) return toast.error("Select at least one food item");
    setComputing(true);
    setComputed(false);
    const soldMap = new Map<string, number>();
    for (const f of selectedFoods) soldMap.set(f.id, f.qty);
    const menuRows: MenuItemRow[] = selectedFoods.map(f => ({ food_item_id: f.id, name: f.name, qty: f.qty, req_qty: String(f.qty) }));
    await computeIngredients(soldMap, menuRows);
    setComputing(false);
  };

  const toggleFood = (food: any) => {
    setSelectedFoods(prev => {
      const exists = prev.find(f => f.id === food.id);
      if (exists) return prev.filter(f => f.id !== food.id);
      return [...prev, { id: food.id, name: food.name, qty: 1 }];
    });
    setComputed(false);
  };

  const updateFoodQty = (id: string, qty: number) => {
    setSelectedFoods(prev => prev.map(f => f.id === id ? { ...f, qty: Math.max(1, qty) } : f));
    setComputed(false);
  };

  const updateReqQty = (id: string, val: string) =>
    setIngredientRows(prev => prev.map(r => r.ingredient_id === id ? { ...r, req_qty: val } : r));

  const updateMenuReqQty = (id: string, val: string) =>
    setMenuItems(prev => prev.map(m => m.food_item_id === id ? { ...m, req_qty: val } : m));

  const recomputeFromMenu = async () => {
    setComputing(true);
    setIngredientRows([]);
    const soldMap = new Map(menuItems.map(m => [m.food_item_id, parseFloat(m.req_qty) || 0]));
    await computeIngredients(soldMap, menuItems);
    setComputing(false);
  };

  const saveList = () => {
    if (!listName.trim()) return;
    const updated = [...savedLists, { name: listName.trim(), items: selectedFoods.map(f => ({ id: f.id, name: f.name, qty: f.qty })) }];
    setSavedLists(updated);
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(updated));
    setShowSaveDlg(false);
    setListName("");
    toast.success("Food list saved!");
  };

  const loadList = (list: SavedList) => {
    const foods = list.items.map(item => {
      const food = allFoods.find(f => f.id === item.id);
      if (!food) return null;
      return { id: food.id, name: food.name, qty: item.qty };
    }).filter(Boolean) as { id: string; name: string; qty: number }[];
    setSelectedFoods(foods);
    setComputed(false);
  };

  const deleteList = (idx: number) => {
    const updated = savedLists.filter((_, i) => i !== idx);
    setSavedLists(updated);
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(updated));
  };

  const neededRows = ingredientRows.filter(r => !r.enough);
  const enoughRows = ingredientRows.filter(r => r.enough);
  const canUse = ingredientRows.some(r => !r.enough && parseFloat(r.req_qty) > 0);

  const useRows = () => {
    const items: ReqItemRow[] = neededRows
      .filter(r => parseFloat(r.req_qty) > 0)
      .map(r => {
        // Match by ID first, then fall back to name match (cross-restaurant ingredient IDs differ)
        let ing = ingredients.find((i: any) => i.id === r.ingredient_id);
        if (!ing) ing = ingredients.find((i: any) => i.name?.toLowerCase() === r.name.toLowerCase());
        return {
          ingredient_id: ing?.id ?? "",
          quantity: r.req_qty,
          unit: r.unit || ing?.default_unit || "",
          unit_price: String(ing?.unit_price ?? 0),
        };
      });
    onUse(items, vendorId || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Zap size={15} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-gray-700">Requisition Automation</h2>
              <p className="text-xs text-gray-400">Compute ingredients needed from sales or food selection, then create a requisition</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>

        {/* Tab bar */}
        <div className="flex px-6 border-b border-gray-100 shrink-0 bg-white">
          {([
            { key: "date", label: "By Sales Date", icon: CalendarIcon },
            { key: "food", label: "By Food Selection", icon: ChefHat },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setComputed(false); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-purple-500 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Tab 1: By Sales Date ── */}
          {tab === "date" && (
            <div className="p-6">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales Date</label>
                  <input type="date" value={autoDate} max={format(new Date(), "yyyy-MM-dd")}
                    onChange={e => { setAutoDate(e.target.value); setComputed(false); }}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <button onClick={computeFromDate} disabled={computing}
                  className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors shrink-0">
                  {computing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {computing ? "Computing…" : "Compute"}
                </button>
              </div>
            </div>
          )}

          {/* ── Tab 2: By Food Selection ── */}
          {tab === "food" && (
            <div className="p-6 space-y-3">
              <div className="flex items-start gap-4">
                {/* Left: food picker */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Pick Menu Items</label>
                    {savedLists.length > 0 && (
                      <select className="h-7 px-2 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" defaultValue=""
                        onChange={e => { const list = savedLists[parseInt(e.target.value)]; if (list) loadList(list); }}>
                        <option value="">Load saved list…</option>
                        {savedLists.map((l, i) => <option key={i} value={i}>{l.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={foodSearch} onChange={e => setFoodSearch(e.target.value)} placeholder="Search menu items…"
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {loadingFoods ? (
                      <div className="p-4 text-center text-sm text-gray-400 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                    ) : allFoods.filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase())).length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-400">No food items found</div>
                    ) : allFoods.filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase())).map(food => {
                        const sel = selectedFoods.find(s => s.id === food.id);
                        return (
                          <div key={food.id} onClick={() => toggleFood(food)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${sel ? "bg-purple-50" : ""}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sel ? "bg-purple-600 border-purple-600" : "border-gray-300"}`}>
                              {sel && <Check size={10} className="text-white" />}
                            </div>
                            <span className="text-sm text-gray-800 truncate">{food.name}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Right: selected + qty */}
                {selectedFoods.length > 0 && (
                  <div className="w-52 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Qty ({selectedFoods.length})</label>
                      <button onClick={() => setShowSaveDlg(true)} className="text-xs text-purple-600 hover:text-purple-700 font-medium">Save list</button>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {selectedFoods.map(food => (
                        <div key={food.id} className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 last:border-0">
                          <span className="text-xs text-gray-700 flex-1 truncate">{food.name}</span>
                          <input type="number" min="1" step="1" value={food.qty}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updateFoodQty(food.id, parseInt(e.target.value) || 1)}
                            className="w-14 h-6 px-1 text-xs rounded-md border border-gray-200 text-center focus:outline-none focus:ring-1 focus:ring-purple-500" />
                          <button onClick={() => toggleFood(food)} className="text-gray-300 hover:text-red-400"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                    {showSaveDlg && (
                      <div className="mt-2 p-2.5 border border-purple-200 rounded-lg bg-purple-50 space-y-2">
                        <input value={listName} onChange={e => setListName(e.target.value)} placeholder="List name…"
                          className="w-full h-7 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white" />
                        <div className="flex gap-1">
                          <button onClick={saveList} className="flex-1 h-6 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700">Save</button>
                          <button onClick={() => setShowSaveDlg(false)} className="flex-1 h-6 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 bg-white">Cancel</button>
                        </div>
                      </div>
                    )}
                    {savedLists.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Saved Lists</p>
                        {savedLists.map((l, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <button onClick={() => loadList(l)} className="text-xs text-purple-600 hover:underline truncate flex-1 text-left">{l.name}</button>
                            <button onClick={() => deleteList(i)} className="text-gray-300 hover:text-red-400"><Trash2 size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={computeFromSelection} disabled={computing || selectedFoods.length === 0}
                className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {computing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {computing ? "Computing…" : "Compute Ingredients"}
              </button>
            </div>
          )}

          {/* ── Shared Results ── */}
          {computed && !computing && (
            <div className="px-6 pb-6 space-y-4">
              {/* Menu items consumed */}
              {menuItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">
                      {tab === "date" ? "Menu Items Sold" : "Selected Menu Items"}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">({menuItems.length})</span>
                    </h3>
                    <button onClick={recomputeFromMenu} disabled={computing}
                      className="h-7 px-3 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                      {computing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                      Recompute
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Menu Item</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty {tab === "date" ? "Sold" : ""}</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Request Qty ✎</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {menuItems.map(item => (
                          <tr key={item.food_item_id} className="hover:bg-gray-50/60">
                            <td className="px-3 py-2 font-medium text-gray-800">{item.name}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{item.qty}</td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" min="0" step="1" value={item.req_qty}
                                onChange={e => updateMenuReqQty(item.food_item_id, e.target.value)}
                                className="w-20 h-7 px-2 text-xs rounded-md border border-purple-200 text-right focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold text-purple-700 tabular-nums" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Edit Request Qty then click <strong>Recompute</strong> to update ingredient breakdown.</p>
                </div>
              )}

              {/* Ingredient breakdown */}
              {ingredientRows.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    Ingredient Breakdown
                    <span className="ml-1.5 text-xs font-normal text-orange-500">{neededRows.length} to order</span>
                    {enoughRows.length > 0 && <span className="ml-1.5 text-xs font-normal text-green-600">· {enoughRows.length} in stock</span>}
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Ingredient</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Need</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">In Stock</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Order Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ingredientRows.map(row => (
                          <tr key={row.ingredient_id} className={row.enough ? "opacity-50" : ""}>
                            <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{row.qty_needed} {row.unit}</td>
                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{row.in_stock} {row.unit}</td>
                            <td className="px-3 py-2 text-right">
                              {row.enough ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
                                  <Check size={10} /> Enough
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <input type="number" min="0" step="0.01" value={row.req_qty}
                                    onChange={e => updateReqQty(row.ingredient_id, e.target.value)}
                                    className="w-20 h-7 px-2 text-xs rounded-md border border-orange-200 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold text-orange-700 tabular-nums" />
                                  <span className="text-xs text-gray-500 w-8 text-left">{row.unit}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-amber-600 border border-dashed border-amber-200 rounded-xl bg-amber-50/50">
                  <AlertCircle size={28} className="mx-auto mb-2 text-amber-300" />
                  <p className="text-sm font-semibold text-amber-700">No ingredient recipes configured</p>
                  <p className="text-xs mt-1 text-amber-600">Go to <strong>Food Items</strong>, select a menu item, and add its ingredient recipe. Without recipes the system can&apos;t compute what to order.</p>
                </div>
              )}
            </div>
          )}

          {computed && !computing && menuItems.length === 0 && ingredientRows.length === 0 && (
            <div className="px-6 pb-6 text-center py-8 text-gray-400">
              <AlertCircle size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No orders found for the selected date.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60 shrink-0">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={useRows} disabled={!canUse}
            className="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center gap-2">
            <ShoppingCart size={14} /> Use as Requisition
            {neededRows.length > 0 && <span className="bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5">{neededRows.filter(r => parseFloat(r.req_qty) > 0).length}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BazarRequestsPage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const rid = activeRestaurant?.id;

  // Use active restaurant for fetching, but allow override in create
  const { requisitions, loading, create, updateRequisition, approve, reject, remove } = useProductRequisitions(rid);
  const { ingredients } = useIngredients(rid);
  const { groups } = useInventoryGroups(rid);
  const { vendors } = useVendors();
  const { methods: paymentMethods } = usePaymentMethods(rid);
  const { categories, create: createCategory, update: updateCategory, remove: removeCategory } = useBazarCategories(rid);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create / Edit dialog shared state
  const [formOpen, setFormOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<ProductRequisition | null>(null);
  const [reqRestaurantId, setReqRestaurantId] = useState(rid ?? "");
  const [reqDate, setReqDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reqNotes, setReqNotes] = useState("");
  const [reqPaymentStatus, setReqPaymentStatus] = useState<"paid" | "due" | "">("paid");
  const [reqPaymentMethodId, setReqPaymentMethodId] = useState("");
  const [reqVendorId, setReqVendorId] = useState("");
  const [reqCategoryId, setReqCategoryId] = useState("");

  // Manage categories dialog
  const [manageCatOpen, setManageCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);

  // Inline category create in form
  const [inlineCatName, setInlineCatName] = useState("");
  const [inlineCatOpen, setInlineCatOpen] = useState(false);
  const [savingInlineCat, setSavingInlineCat] = useState(false);

  // Stock suggestions for new requisition
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [stockLoading, setStockLoading] = useState(false);
  const [reqItems, setReqItems] = useState<ReqItemRow[]>([{ ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]);
  const [saving, setSaving] = useState(false);

  // Automation modal
  const [autoOpen, setAutoOpen] = useState(false);

  // View dialog
  const [viewReq, setViewReq] = useState<ProductRequisition | null>(null);

  // Approve/Reject confirm
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [actioning, setActioning] = useState(false);
  const [memoFile, setMemoFile] = useState<File | null>(null);

  const filtered = useMemo(() => {
    const range = getDateRange(datePreset, customFrom, customTo);
    return requisitions.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          format(new Date(r.requisition_date), "dd MMM yyyy").toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q) ||
          shortReqId(r.id).toLowerCase().includes(q) ||
          (r.vendors?.name ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (range) {
        const d = r.requisition_date.slice(0, 10);
        if (d < range.from || d > range.to) return false;
      }
      return true;
    });
  }, [requisitions, search, filterStatus, datePreset, customFrom, customTo]);

  // Stats
  const pendingCount = requisitions.filter((r) => r.status === "submitted").length;
  const totalApprovedValue = requisitions
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + (r.product_requisition_items?.reduce((ss, i) => ss + i.total_price, 0) ?? 0), 0);

  // ── Row helpers ──────────────────────────────────────────
  const addItemRow = () => setReqItems((p) => [...p, { ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]);
  const removeItemRow = (idx: number) => setReqItems((p) => p.filter((_, i) => i !== idx));
  const updateItemRow = (idx: number, key: keyof ReqItemRow, val: string) => {
    if (key === "ingredient_id" && val) {
      const alreadyAdded = reqItems.some((r, i) => i !== idx && r.ingredient_id === val);
      if (alreadyAdded) {
        const name = ingredients.find((i) => i.id === val)?.name ?? "This ingredient";
        toast.error(`${name} is already added in another row`);
        return;
      }
    }
    setReqItems((p) => {
      const updated = [...p];
      updated[idx] = { ...updated[idx], [key]: val };
      if (key === "ingredient_id" && val) {
        const ing = ingredients.find((i) => i.id === val);
        if (ing) { updated[idx].unit = ing.default_unit; updated[idx].unit_price = String(ing.unit_price); }
      }
      return updated;
    });
  };

  const itemTotal = (item: ReqItemRow) => (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  const grandTotal = reqItems.reduce((s, i) => s + itemTotal(i), 0);

  // Submit is valid when every row has an ingredient + quantity, payment status and method are selected
  const canSubmit =
    reqItems.length > 0 &&
    reqItems.every((r) => r.ingredient_id.trim() !== "" && parseFloat(r.quantity) > 0) &&
    reqPaymentStatus !== "" &&
    reqPaymentMethodId !== "";

  // Fetch stock levels when form opens
  useEffect(() => {
    if (!formOpen || !reqRestaurantId) return;
    setStockLoading(true);
    createClient()
      .from("food_stock")
      .select("ingredient_id, quantity")
      .eq("restaurant_id", reqRestaurantId)
      .then(({ data }) => {
        const m = new Map<string, number>();
        for (const s of data ?? []) m.set(s.ingredient_id, s.quantity ?? 0);
        setStockMap(m);
        setStockLoading(false);
      });
  }, [formOpen, reqRestaurantId]);

  // ── Open dialogs ─────────────────────────────────────────
  const openFromAutomation = (items: ReqItemRow[], vendorId?: string) => {
    setAutoOpen(false);
    setEditingReq(null);
    setReqRestaurantId(rid ?? "");
    setReqDate(format(new Date(), "yyyy-MM-dd"));
    setReqNotes("Auto-generated from requisition automation");
    setReqPaymentStatus("");
    setReqPaymentMethodId("");
    setReqVendorId(vendorId ?? "");
    setReqCategoryId("");
    setInlineCatOpen(false);
    setInlineCatName("");
    setReqItems(items.length > 0 ? items : [{ ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditingReq(null);
    setReqRestaurantId(rid ?? "");
    setReqDate(format(new Date(), "yyyy-MM-dd"));
    setReqNotes("");
    setReqPaymentStatus("");
    setReqPaymentMethodId("");
    setReqVendorId("");
    setReqCategoryId("");
    setInlineCatOpen(false);
    setInlineCatName("");
    setReqItems([{ ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]);
    setFormOpen(true);
  };

  const openEdit = (req: ProductRequisition) => {
    setEditingReq(req);
    setReqRestaurantId(req.restaurant_id);
    setReqDate(req.requisition_date);
    setReqNotes(req.notes ?? "");
    setReqPaymentStatus(req.payment_status ?? "paid");
    setReqPaymentMethodId(req.payment_method_id ?? "");
    setReqVendorId(req.vendor_id ?? "");
    setReqCategoryId(req.bazar_category_id ?? "");
    setInlineCatOpen(false);
    setInlineCatName("");
    setReqItems(
      req.product_requisition_items?.map((i) => ({
        ingredient_id: i.ingredient_id,
        quantity: String(i.quantity),
        unit: i.unit ?? "",
        unit_price: String(i.unit_price),
      })) ?? [{ ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]
    );
    setFormOpen(true);
  };

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    const validItems = reqItems.filter((i) => i.ingredient_id && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) return toast.error("Add at least one item");
    if (reqDate < format(new Date(), "yyyy-MM-dd")) return toast.error("Requisition date cannot be in the past");
    setSaving(true);

    const itemPayload = validItems.map((i) => ({
      ingredient_id: i.ingredient_id,
      quantity: parseFloat(i.quantity),
      unit: i.unit,
      unit_price: parseFloat(i.unit_price) || 0,
      total_price: itemTotal(i),
    }));

    if (editingReq) {
      const { error } = await updateRequisition(editingReq.id, reqDate, reqNotes, itemPayload, reqPaymentStatus || undefined, reqVendorId || undefined, reqPaymentMethodId || undefined, reqCategoryId || undefined);
      if (error) toast.error((error as Error).message);
      else { toast.success("Requisition updated!"); setFormOpen(false); }
    } else {
      const { error } = await create(reqDate, reqNotes, itemPayload, reqRestaurantId || undefined, (reqPaymentStatus || "paid") as "paid" | "due", reqVendorId || undefined, reqPaymentMethodId || undefined, reqCategoryId || undefined);
      if (error) toast.error((error as Error).message);
      else { toast.success("Requisition submitted!"); setFormOpen(false); }
    }
    setSaving(false);
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    setActioning(true);
    let error;
    if (confirmAction.action === "approve") {
      ({ error } = await approve(confirmAction.id, memoFile ?? undefined));
    } else {
      ({ error } = await reject(confirmAction.id));
    }
    if (error) toast.error((error as Error).message);
    else toast.success(confirmAction.action === "approve" ? "Approved! Stock updated." : "Requisition rejected.");
    setConfirmAction(null);
    setMemoFile(null);
    setActioning(false);
  };

  if (!rid) return (
    <div><Header title="Bazar Requests" />
      <div className="p-4 md:p-6"><div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
        <ShoppingCart size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
        <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
      </div></div>
    </div>
  );

  return (
    <div>
      <Header title="Bazar Requests" />
      <div className="p-4 md:p-6 space-y-4">
        {/* ── Toolbar — above the cards ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm shrink-0 flex flex-wrap items-center px-4 md:px-6 gap-3 md:gap-4 py-2.5 md:h-[62px] md:py-0">
            {/* Status */}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-[14px] rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              <option value="">All Status</option>
              <option value="submitted">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Date preset */}
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="h-9 px-[14px] rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Custom date pickers — only shown when preset = custom */}
            {datePreset === "custom" && (
              <>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 px-[14px] rounded-lg border border-[#e5e7eb] text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 px-[14px] rounded-lg border border-[#e5e7eb] text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" />
              </>
            )}

            <div className="flex-1" />
            <button
              onClick={() => setManageCatOpen(true)}
              className="h-9 px-[14px] rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Tag size={13} /> Manage Categories
            </button>
            <button
              onClick={() => setAutoOpen(true)}
              className="h-9 px-3 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Zap size={13} /> Requisition Automation
            </button>
            <Button size="sm" onClick={openCreate}><Plus size={14} /> New Requisition</Button>
            {/* Search — rightmost */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…"
                className="w-48 h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" />
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-[18px]">
          {[
            { label: "Total Requests", value: requisitions.length, sub: "all time" },
            { label: "Pending Review", value: pendingCount, sub: pendingCount > 0 ? "needs action" : "all clear", highlight: pendingCount > 0 },
            { label: "Approved This Month", value: requisitions.filter((r) => r.status === "approved" && new Date(r.requisition_date).getMonth() === new Date().getMonth()).length, sub: "this month" },
            { label: "Total Approved Value", value: `৳${totalApprovedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "all time" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-border shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.highlight ? "text-amber-600" : "text-gray-900"}`}>{c.value}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Requisition Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden overflow-x-auto">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-gray-700 text-sm">Requisitions <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
          </div>
          {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{filterStatus || search ? "No results found" : "No requisitions yet"}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pay Method</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Restaurant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((req) => {
                    const reqTotal = req.product_requisition_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
                    const itemCount = req.product_requisition_items?.length ?? 0;
                    const isExpanded = expandedId === req.id;
                    const restName = restaurants.find((r) => r.id === req.restaurant_id)?.name;

                    return (
                      <React.Fragment key={req.id}>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                              className="text-gray-400 hover:text-gray-600 transition-colors">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {shortReqId(req.id)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <div className="font-medium">{format(new Date(req.created_at), "dd MMM yyyy")}</div>
                            <div className="text-xs text-gray-400">{format(new Date(req.created_at), "hh:mm a")}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusBadge(req.status)}>{statusLabel[req.status]}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {req.payment_status === "due" ? (
                              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Due</span>
                            ) : (
                              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Paid</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {req.payment_methods?.name
                              ? <span className="bg-gray-50 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full">{req.payment_methods.name}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {restName ? <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full">{restName}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {req.vendors?.name ? <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{req.vendors.name}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {req.bazar_categories?.name
                              ? <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">{req.bazar_categories.name}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{itemCount}</td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                            ৳{reqTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => printRequisition(req, restName)} title="Print / Download PDF"
                                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 flex items-center justify-center transition-colors">
                                <Printer size={12} />
                              </button>
                              <button onClick={() => setViewReq(req)} title="View details"
                                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors">
                                <Eye size={12} />
                              </button>
                              {req.status === "submitted" && (
                                <button onClick={() => openEdit(req)} title="Edit requisition"
                                  className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 flex items-center justify-center transition-colors">
                                  <Edit2 size={12} />
                                </button>
                              )}
                              {req.status === "submitted" && (
                                <>
                                  <Button size="sm" onClick={() => setConfirmAction({ id: req.id, action: "approve" })}
                                    className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs h-7 px-2">
                                    <Check size={12} />
                                  </Button>
                                  <Button variant="danger" size="sm" onClick={() => setConfirmAction({ id: req.id, action: "reject" })}
                                    className="text-xs h-7 px-2">
                                    <X size={12} />
                                  </Button>
                                </>
                              )}
                              {req.status === "submitted" && (
                                <button onClick={() => { if (confirm("Delete this requisition?")) remove(req.id); }}
                                  className="w-7 h-7 rounded-lg border border-gray-200 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expanded Items */}
                        {isExpanded && req.product_requisition_items && (
                          <tr key={`${req.id}-expanded`}>
                            <td colSpan={11} className="px-8 py-4 bg-gray-50/50">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 uppercase tracking-wide">
                                    <th className="text-left pb-2 font-semibold">Ingredient</th>
                                    <th className="text-right pb-2 font-semibold">Qty</th>
                                    <th className="text-right pb-2 font-semibold">Unit</th>
                                    <th className="text-right pb-2 font-semibold">Unit Price</th>
                                    <th className="text-right pb-2 font-semibold">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {req.product_requisition_items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-1.5 font-medium text-gray-700">{item.ingredients?.name ?? "—"}</td>
                                      <td className="py-1.5 text-right text-gray-600">{item.quantity}</td>
                                      <td className="py-1.5 text-right text-gray-500">{item.unit}</td>
                                      <td className="py-1.5 text-right text-gray-600">৳{item.unit_price.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-semibold text-gray-800">৳{item.total_price.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={4} className="pt-2 text-right text-gray-500 font-semibold">Grand Total</td>
                                    <td className="pt-2 text-right font-bold text-gray-900">৳{reqTotal.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* ── Create / Edit Requisition Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}
        title={editingReq ? "Edit Requisition" : "New Bazar Requisition"}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!canSubmit}>
              {editingReq ? "Save Changes" : "Submit Requisition"}
            </Button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Restaurant selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Restaurant</label>
              <select value={reqRestaurantId} onChange={(e) => setReqRestaurantId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="">Select restaurant</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <Input label="Requisition Date" type="date" value={reqDate} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setReqDate(e.target.value)} />
          </div>
          {/* Vendor + Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={reqVendorId} onChange={(e) => setReqVendorId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="">Select vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method <span className="text-red-500">*</span></label>
              <select value={reqPaymentMethodId} onChange={(e) => setReqPaymentMethodId(e.target.value)}
                className={`w-full h-9 px-3 rounded-md bg-white shadow-sm text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${reqPaymentMethodId === "" ? "ring-1 ring-inset ring-red-300" : "border border-gray-200"}`}>
                <option value="">Select payment method</option>
                {paymentMethods.filter(m => m.is_active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {reqPaymentMethodId === "" && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Category <span className="text-gray-400 font-normal">(optional)</span></label>
              {!inlineCatOpen && (
                <button type="button" onClick={() => setInlineCatOpen(true)}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium">
                  <Plus size={11} /> New category
                </button>
              )}
            </div>
            {inlineCatOpen ? (
              <div className="flex items-center gap-2">
                <input value={inlineCatName} onChange={(e) => setInlineCatName(e.target.value)}
                  placeholder="Category name…" autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!inlineCatName.trim() || savingInlineCat) return;
                      setSavingInlineCat(true);
                      createCategory(inlineCatName).then(({ data, error }) => {
                        setSavingInlineCat(false);
                        if (error) { toast.error((error as Error).message); return; }
                        if (data) setReqCategoryId(data.id);
                        setInlineCatName("");
                        setInlineCatOpen(false);
                      });
                    }
                    if (e.key === "Escape") { setInlineCatOpen(false); setInlineCatName(""); }
                  }}
                  className="flex-1 h-9 px-3 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <button type="button" disabled={!inlineCatName.trim() || savingInlineCat}
                  onClick={() => {
                    if (!inlineCatName.trim() || savingInlineCat) return;
                    setSavingInlineCat(true);
                    createCategory(inlineCatName).then(({ data, error }) => {
                      setSavingInlineCat(false);
                      if (error) { toast.error((error as Error).message); return; }
                      if (data) setReqCategoryId(data.id);
                      setInlineCatName("");
                      setInlineCatOpen(false);
                    });
                  }}
                  className="h-9 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1 transition-colors">
                  {savingInlineCat ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
                <button type="button" onClick={() => { setInlineCatOpen(false); setInlineCatName(""); }}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            ) : (
              <select value={reqCategoryId} onChange={(e) => setReqCategoryId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          <Input label="Notes (optional)" placeholder="e.g. Weekly market run" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} />

          {/* Payment Status Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Status <span className="text-red-500">*</span>
            </label>
            <div className={`flex rounded-lg border overflow-hidden w-fit ${reqPaymentStatus === "" ? "border-red-300" : "border-gray-200"}`}>
              <button
                type="button"
                onClick={() => setReqPaymentStatus("paid")}
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  reqPaymentStatus === "paid"
                    ? "bg-green-600 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                ✓ Paid
              </button>
              <button
                type="button"
                onClick={() => setReqPaymentStatus("due")}
                className={`px-5 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                  reqPaymentStatus === "due"
                    ? "bg-amber-500 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                ⏱ Due
              </button>
            </div>
            {reqPaymentStatus === "" && (
              <p className="text-xs text-red-500 mt-1.5">Please select a payment status.</p>
            )}
            {reqPaymentStatus === "due" && (
              <p className="text-xs text-amber-600 mt-1.5">This will appear as an outstanding expense in Income &amp; Expenses.</p>
            )}
          </div>

          {/* Stock Suggestions */}
          {!editingReq && ingredients.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-gray-700">Stock Suggestions</label>
                {stockLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
              </div>
              {stockLoading ? null : (() => {
                const empty = ingredients.filter((i) => (stockMap.get(i.id) ?? 0) === 0);
                const low = ingredients.filter((i) => { const q = stockMap.get(i.id) ?? 0; return q > 0 && q < 5; });
                if (empty.length === 0 && low.length === 0) return (
                  <p className="text-xs text-gray-400">All ingredients are well-stocked.</p>
                );
                return (
                  <div className="space-y-2">
                    {empty.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                          Out of Stock ({empty.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {empty.map((ing) => {
                            const already = reqItems.some((r) => r.ingredient_id === ing.id);
                            return (
                              <button
                                key={ing.id}
                                type="button"
                                disabled={already}
                                onClick={() => {
                                  if (already) return;
                                  const emptyRow = reqItems.findIndex((r) => !r.ingredient_id);
                                  if (emptyRow >= 0) {
                                    updateItemRow(emptyRow, "ingredient_id", ing.id);
                                  } else {
                                    setReqItems((p) => [...p, { ingredient_id: ing.id, quantity: "1", unit: ing.default_unit, unit_price: String(ing.unit_price) }]);
                                  }
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  already
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-default"
                                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                }`}
                              >
                                {already ? <Check size={10} /> : <Plus size={10} />}
                                {ing.name}
                                <span className="text-[10px] opacity-60">0 {ing.default_unit}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {low.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Low Stock ({low.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {low.map((ing) => {
                            const qty = stockMap.get(ing.id) ?? 0;
                            const already = reqItems.some((r) => r.ingredient_id === ing.id);
                            return (
                              <button
                                key={ing.id}
                                type="button"
                                disabled={already}
                                onClick={() => {
                                  if (already) return;
                                  const emptyRow = reqItems.findIndex((r) => !r.ingredient_id);
                                  if (emptyRow >= 0) {
                                    updateItemRow(emptyRow, "ingredient_id", ing.id);
                                  } else {
                                    setReqItems((p) => [...p, { ingredient_id: ing.id, quantity: "1", unit: ing.default_unit, unit_price: String(ing.unit_price) }]);
                                  }
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  already
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-default"
                                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                }`}
                              >
                                {already ? <Check size={10} /> : <Plus size={10} />}
                                {ing.name}
                                <span className="text-[10px] opacity-60">{qty} {ing.default_unit}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <Button variant="outline" size="sm" onClick={addItemRow}><Plus size={12} /> Add Item</Button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Ingredient</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24">Qty</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20">Unit</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reqItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <select value={item.ingredient_id} onChange={(e) => updateItemRow(idx, "ingredient_id", e.target.value)}
                          className="w-full h-8 px-2 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                          <option value="">Select ingredient</option>
                          {groups.length > 0 ? groups.map((g) => (
                            <optgroup key={g.id} label={g.name}>
                              {ingredients.filter((i) => i.inventory_group_id === g.id).map((i) => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </optgroup>
                          )) : ingredients.map((i) => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateItemRow(idx, "quantity", e.target.value)}
                          className="w-full h-8 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.unit} onChange={(e) => updateItemRow(idx, "unit", e.target.value)} placeholder="unit"
                          className="w-full h-8 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItemRow(idx, "unit_price", e.target.value)}
                          className="w-full h-8 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-medium text-gray-700">৳{itemTotal(item).toFixed(2)}</td>
                      <td className="px-2 py-1.5">
                        {reqItems.length > 1 && (
                          <button onClick={() => removeItemRow(idx)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center">
                            <X size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Grand Total</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">৳{grandTotal.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </Dialog>

      {/* ── View Requisition Dialog ── */}
      {viewReq && (
        <Dialog open={!!viewReq} onOpenChange={() => setViewReq(null)} title="Requisition Details"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => printRequisition(viewReq, restaurants.find((r) => r.id === viewReq.restaurant_id)?.name)}>
                  <Printer size={13} /> Print / PDF
                </Button>
                {viewReq.status === "submitted" && (
                  <>
                    <Button onClick={() => { setConfirmAction({ id: viewReq.id, action: "approve" }); setViewReq(null); }}
                      className="bg-green-600 hover:bg-green-700 text-white border-0">
                      <Check size={14} /> Approve
                    </Button>
                    <Button variant="danger" onClick={() => { setConfirmAction({ id: viewReq.id, action: "reject" }); setViewReq(null); }}>
                      <X size={14} /> Reject
                    </Button>
                  </>
                )}
              </div>
              <Button variant="outline" onClick={() => setViewReq(null)}>Close</Button>
            </div>
          }>
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Req ID</p>
                <p className="font-mono font-semibold text-gray-600">{shortReqId(viewReq.id)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Date</p>
                <p className="font-medium">{format(new Date(viewReq.requisition_date), "dd MMM yyyy")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Status</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant={statusBadge(viewReq.status)}>{statusLabel[viewReq.status]}</Badge>
                  {viewReq.payment_status === "due" && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Due</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Total</p>
                <p className="font-bold">৳{(viewReq.product_requisition_items?.reduce((s, i) => s + i.total_price, 0) ?? 0).toFixed(2)}</p>
              </div>
            </div>
            {/* Restaurant */}
            {(() => {
              const rn = restaurants.find((r) => r.id === viewReq.restaurant_id)?.name;
              return rn ? (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm text-purple-700">
                  <span className="font-medium">{rn}</span>
                </div>
              ) : null;
            })()}
            {viewReq.notes && <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">{viewReq.notes}</p>}
            {viewReq.status === "approved" && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                <Check size={14} /> Stock has been updated for all approved items.
              </div>
            )}
            {viewReq.memo_url && (
              <a
                href={viewReq.memo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Eye size={14} /> View Bazar Memo
              </a>
            )}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="text-left pb-2">Ingredient</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Unit</th>
                  <th className="text-right pb-2">Price</th>
                  <th className="text-right pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viewReq.product_requisition_items?.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 font-medium text-gray-800">{item.ingredients?.name ?? "—"}</td>
                    <td className="py-2 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-500">{item.unit}</td>
                    <td className="py-2 text-right text-gray-600">৳{item.unit_price.toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold text-gray-800">৳{item.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </Dialog>
      )}

      {/* ── Requisition Automation Modal ── */}
      {autoOpen && (
        <RequisitionAutomationModal
          rid={rid}
          ingredients={ingredients}
          vendors={vendors}
          onUse={openFromAutomation}
          onClose={() => setAutoOpen(false)}
        />
      )}

      {/* ── Approve/Reject Confirm Dialog ── */}
      {confirmAction && (
        <Dialog open={!!confirmAction} onOpenChange={() => { setConfirmAction(null); setMemoFile(null); }}
          title={confirmAction.action === "approve" ? "Approve Requisition?" : "Reject Requisition?"}
          footer={
            <>
              <Button variant="outline" onClick={() => { setConfirmAction(null); setMemoFile(null); }}>Cancel</Button>
              <Button
                onClick={handleAction}
                loading={actioning}
                className={confirmAction.action === "approve" ? "bg-green-600 hover:bg-green-700 text-white border-0" : ""}
                variant={confirmAction.action === "reject" ? "danger" : "primary"}
              >
                {confirmAction.action === "approve" ? "Yes, Approve" : "Yes, Reject"}
              </Button>
            </>
          }>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className={confirmAction.action === "approve" ? "text-green-500 shrink-0 mt-0.5" : "text-red-500 shrink-0 mt-0.5"} />
              <div>
                {confirmAction.action === "approve" ? (
                  <p className="text-sm text-gray-600">
                    Approving this requisition will <strong>update food stock</strong> for all items and create expense transaction records. This action cannot be undone.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Are you sure you want to reject this requisition? The status will be updated to <strong>Rejected</strong> and no stock changes will be made.
                  </p>
                )}
              </div>
            </div>

            {/* Memo upload — only for approve */}
            {confirmAction.action === "approve" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Bazar Memo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <label className={`flex items-center gap-3 w-full h-10 px-3 rounded-lg border cursor-pointer transition-colors ${memoFile ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setMemoFile(e.target.files?.[0] ?? null)}
                  />
                  {memoFile ? (
                    <>
                      <Check size={14} className="text-green-600 shrink-0" />
                      <span className="text-sm text-green-700 truncate">{memoFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setMemoFile(null); }}
                        className="ml-auto text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Click to upload memo (PDF, image, doc)</span>
                  )}
                </label>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* ── Manage Categories Dialog ── */}
      {manageCatOpen && (
        <Dialog open={manageCatOpen} onOpenChange={setManageCatOpen} title="Manage Bazar Categories"
          footer={<Button variant="outline" onClick={() => setManageCatOpen(false)}>Close</Button>}>
          <div className="space-y-4">
            {/* Add new category */}
            <div className="flex items-center gap-2">
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newCatName.trim() || savingCat) return;
                    setSavingCat(true);
                    createCategory(newCatName).then(({ error }) => {
                      setSavingCat(false);
                      if (error) toast.error((error as Error).message);
                      else setNewCatName("");
                    });
                  }
                }}
                className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <button
                type="button"
                disabled={!newCatName.trim() || savingCat}
                onClick={() => {
                  if (!newCatName.trim() || savingCat) return;
                  setSavingCat(true);
                  createCategory(newCatName).then(({ error }) => {
                    setSavingCat(false);
                    if (error) toast.error((error as Error).message);
                    else setNewCatName("");
                  });
                }}
                className="h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {savingCat ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
              </button>
            </div>

            {/* Category list */}
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No categories yet. Add one above.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5">
                    {editingCat?.id === cat.id ? (
                      <>
                        <input
                          value={editingCat.name}
                          onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!editingCat.name.trim()) return;
                              updateCategory(editingCat.id, editingCat.name).then(({ error }) => {
                                if (error) toast.error((error as Error).message);
                                else setEditingCat(null);
                              });
                            }
                            if (e.key === "Escape") setEditingCat(null);
                          }}
                          className="flex-1 h-8 px-2 rounded-md border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <button onClick={() => {
                          if (!editingCat.name.trim()) return;
                          updateCategory(editingCat.id, editingCat.name).then(({ error }) => {
                            if (error) toast.error((error as Error).message);
                            else setEditingCat(null);
                          });
                        }} className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors">
                          <Check size={12} />
                        </button>
                        <button onClick={() => setEditingCat(null)} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 flex items-center justify-center transition-colors">
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <Tag size={13} className="text-orange-400 shrink-0" />
                        <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                        <button onClick={() => setEditingCat({ id: cat.id, name: cat.name })}
                          className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => {
                          if (confirm(`Delete category "${cat.name}"?`)) {
                            removeCategory(cat.id).then(({ error }) => {
                              if (error) toast.error((error as Error).message);
                            });
                          }
                        }} className="w-7 h-7 rounded-lg border border-gray-200 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
