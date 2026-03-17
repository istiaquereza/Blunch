"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useFoodStock } from "@/hooks/use-food-stock";
import { useIngredients } from "@/hooks/use-ingredients";
import { useInventoryGroups } from "@/hooks/use-inventory-groups";
import { Layers, Search, Edit2, Plus, Minus, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { FoodStock } from "@/types";

const LOW_THRESHOLD = 5;
const EMPTY_THRESHOLD = 0;

function stockStatus(qty: number): { label: string; variant: "danger" | "warning" | "success"; icon: React.ReactNode } {
  if (qty <= EMPTY_THRESHOLD) return { label: "Empty", variant: "danger", icon: <XCircle size={12} /> };
  if (qty <= LOW_THRESHOLD) return { label: "Low", variant: "warning", icon: <AlertTriangle size={12} /> };
  return { label: "Sufficient", variant: "success", icon: <CheckCircle2 size={12} /> };
}

export default function FoodInventoryPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { stock, loading, upsert, adjustStock } = useFoodStock(rid);
  const { ingredients } = useIngredients(rid);
  const { groups } = useInventoryGroups(rid);

  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<FoodStock | null>(null);
  const [newQty, setNewQty] = useState("");
  const [saving, setSaving] = useState(false);

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
      const status = stockStatus(item.quantity);
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

  const openAdjust = (item: FoodStock | { ingredient_id: string; quantity: number; updated_at?: string; id?: string }) => {
    const stockItem = stock.find((s) => s.ingredient_id === (item as { ingredient_id: string }).ingredient_id);
    if (stockItem) {
      setAdjustItem(stockItem);
    } else {
      // No stock record yet — create a pseudo one
      setAdjustItem({
        id: "",
        ingredient_id: (item as { ingredient_id: string }).ingredient_id,
        restaurant_id: rid!,
        quantity: 0,
        updated_at: new Date().toISOString(),
      });
    }
    setNewQty(String((item as { quantity: number }).quantity));
    setAdjustOpen(true);
  };

  const handleAdjust = async () => {
    if (!adjustItem) return;
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) return toast.error("Enter a valid quantity");
    setSaving(true);
    const { error } = await upsert(adjustItem.ingredient_id, qty);
    if (error) toast.error(error.message);
    else { toast.success("Stock updated!"); setAdjustOpen(false); }
    setSaving(false);
  };

  if (!rid) return (
    <div><Header title="Food Inventory" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border p-12 text-center">
        <Layers size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
        <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
      </div></div>
    </div>
  );

  const adjustIngredient = adjustItem ? ingredients.find((i) => i.id === adjustItem.ingredient_id) : null;

  return (
    <div>
      <Header title="Food Inventory" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Ingredients", value: items.length, sub: "tracked", color: "text-gray-900" },
            { label: "Total Stock Value", value: `৳${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "estimated", color: "text-gray-900" },
            { label: "Low Stock", value: lowCount, sub: "need restocking", color: lowCount > 0 ? "text-amber-600" : "text-gray-900" },
            { label: "Empty / Out", value: emptyCount, sub: "urgent", color: emptyCount > 0 ? "text-red-600" : "text-gray-900" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Status</option>
              <option value="empty">Empty</option>
              <option value="low">Low Stock</option>
              <option value="sufficient">Sufficient</option>
            </select>
          </div>
        </div>

        {/* Group-wise breakdown */}
        {groups.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {groups.map((g) => {
              const groupItems = items.filter((i) => i.ingredient.inventory_group_id === g.id);
              const groupValue = groupItems.reduce((s, i) => s + i.quantity * i.ingredient.unit_price, 0);
              const groupLow = groupItems.filter((i) => i.quantity <= LOW_THRESHOLD).length;
              return (
                <div key={g.id} className="bg-white rounded-xl border border-border p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{g.name}</p>
                    <p className="text-xs text-gray-400">{groupItems.length} items · ৳{groupValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  {groupLow > 0 && (
                    <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">{groupLow} low</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-gray-900 text-sm">Stock Levels <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
          </div>
          {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Layers size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No ingredients found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    {["Ingredient", "Group", "Unit", "Unit Price", "Current Stock", "Stock Value", "Status", "Last Updated", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={async () => {
                              const { error } = await adjustStock(ingredient.id, -1);
                              if (error) toast.error("Failed to update");
                            }} className="w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors">
                              <Minus size={11} />
                            </button>
                            <span className="font-semibold text-gray-900 min-w-[2.5rem] text-center">{quantity}</span>
                            <button onClick={async () => {
                              const { error } = await adjustStock(ingredient.id, 1);
                              if (error) toast.error("Failed to update");
                            }} className="w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-500 flex items-center justify-center transition-colors">
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">৳{(quantity * ingredient.unit_price).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.variant === "success" ? "bg-green-50 text-green-700" : status.variant === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {status.icon}{status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{last_updated ? format(new Date(last_updated), "dd MMM, HH:mm") : "—"}</td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" onClick={() => {
                            const s = stock.find((st) => st.ingredient_id === ingredient.id);
                            openAdjust(s ?? { ingredient_id: ingredient.id, quantity });
                          }}><Edit2 size={13} /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen} title="Adjust Stock"
        footer={<><Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button><Button onClick={handleAdjust} loading={saving}>Save</Button></>}>
        {adjustIngredient && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="font-medium text-gray-800">{adjustIngredient.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Current stock: <strong>{adjustItem?.quantity ?? 0} {adjustIngredient.default_unit}</strong></p>
            </div>
            <Input
              label={`New Quantity (${adjustIngredient.default_unit})`}
              type="number" min="0" step="0.01"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              hint={`Unit price: ৳${adjustIngredient.unit_price} / ${adjustIngredient.default_unit}`}
            />
            {newQty !== "" && !isNaN(parseFloat(newQty)) && (
              <div className="bg-orange-50 rounded-lg px-4 py-3">
                <p className="text-sm text-orange-700">New stock value: <strong>৳{(parseFloat(newQty) * adjustIngredient.unit_price).toFixed(2)}</strong></p>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
