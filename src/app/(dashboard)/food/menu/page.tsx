"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/image-upload";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useFoodCategories } from "@/hooks/use-food-categories";
import { useIngredients } from "@/hooks/use-ingredients";
import { useFoodItems } from "@/hooks/use-food-items";
import {
  Plus, Search, Edit2, Trash2, LayoutGrid, List,
  ChefHat, X, TrendingUp, TrendingDown, FlaskConical,
  Package, Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { FoodItem } from "@/types";

// ─── Types ────────────────────────────────────────────────
interface IngRow { ingredient_id: string; quantity: string; unit: string; }
interface AddonRow { name: string; price: string; }
interface OptionGroup { name: string; options: string[]; }

interface MenuForm {
  name: string;
  food_category_id: string;
  restaurant_ids: string[];
  sell_price: string;
  image_url: string;
  is_active: boolean;
  availability_type: "premade" | "quantity";
  available_quantity: string;
  ingredients: IngRow[];
  addons: AddonRow[];
  option_groups: OptionGroup[];
}

const emptyForm: MenuForm = {
  name: "", food_category_id: "", restaurant_ids: [],
  sell_price: "", image_url: "", is_active: true,
  availability_type: "premade", available_quantity: "0",
  ingredients: [], addons: [], option_groups: [],
};

function calcCost(ingredients: IngRow[], list: { id: string; unit_price: number }[]) {
  return ingredients.reduce((sum, row) => {
    const ing = list.find((i) => i.id === row.ingredient_id);
    return sum + (ing ? ing.unit_price * (parseFloat(row.quantity) || 0) : 0);
  }, 0);
}

// ─── Food Card ────────────────────────────────────────────
function FoodCard({ item, onEdit, onDelete, onToggle }: {
  item: FoodItem;
  onEdit: (i: FoodItem) => void;
  onDelete: (i: FoodItem) => void;
  onToggle: (i: FoodItem, v: boolean) => void;
}) {
  const cost = item.food_item_ingredients?.reduce((s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0) ?? 0;
  const profit = item.sell_price - cost;
  const pct = item.sell_price > 0 ? (profit / item.sell_price) * 100 : 0;
  const isQuantity = item.availability_type === "quantity";
  const qty = item.available_quantity ?? 0;
  const isEmpty = isQuantity && qty <= 0;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-shadow ${isEmpty ? "border-red-200" : "border-border"}`}>
      {/* Image */}
      <div className="relative h-36 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <ChefHat size={32} className="text-orange-300" />
        )}
        {/* Availability badge */}
        {isQuantity && (
          <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${
            isEmpty ? "bg-red-500 text-white" : qty <= 3 ? "bg-orange-500 text-white" : "bg-green-500 text-white"
          }`}>
            {isEmpty ? "Empty" : `${qty} left`}
          </div>
        )}
        {!isQuantity && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap size={9} /> Premade
          </div>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Title + toggle */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{item.name}</p>
            {item.food_categories && (
              <Badge variant="info" className="mt-1">{item.food_categories.name}</Badge>
            )}
          </div>
          <Switch checked={item.is_active} onCheckedChange={(v) => onToggle(item, v)} />
        </div>

        {/* Ingredients — readable list */}
        {(item.food_item_ingredients?.length ?? 0) > 0 && (
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
              <FlaskConical size={10} /> Ingredients
            </p>
            <div className="space-y-1">
              {item.food_item_ingredients?.map((r, i) => {
                const lineTotal = (r.ingredients?.unit_price ?? 0) * r.quantity;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                      <span className="text-gray-700 font-medium truncate">{r.ingredients?.name ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-gray-400">{r.quantity} {r.unit}</span>
                      {lineTotal > 0 && (
                        <span className="text-gray-500 font-medium">৳{lineTotal.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cost / Price / Margin */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-xs">
          <div className="text-center">
            <p className="text-gray-400">Cost</p>
            <p className="font-semibold text-gray-700 mt-0.5">৳{cost.toFixed(2)}</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-gray-400">Price</p>
            <p className="font-semibold text-gray-700 mt-0.5">৳{Number(item.sell_price).toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400">Margin</p>
            <p className={`font-semibold mt-0.5 flex items-center justify-center gap-0.5 ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
              {profit >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {pct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(item)}>
            <Edit2 size={12} /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(item)}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function FoodMenuPage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { categories, create: createCategory, remove: removeCategory } = useFoodCategories(rid);
  const { ingredients } = useIngredients(rid);
  const { items, loading, create, update, remove, toggleStatus } = useFoodItems(rid);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [form, setForm] = useState<MenuForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const filtered = useMemo(() =>
    items.filter((item) =>
      !item.is_recipe &&
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (filterStatus === "" ? true : filterStatus === "active" ? item.is_active : !item.is_active) &&
      (filterCat ? item.food_category_id === filterCat : true)
    ), [items, search, filterStatus, filterCat]);

  const ingredientCost = calcCost(form.ingredients, ingredients.map((i) => ({ id: i.id, unit_price: i.unit_price })));
  const sellPrice = parseFloat(form.sell_price) || 0;
  const profitAmt = sellPrice - ingredientCost;
  const profitPct = sellPrice > 0 ? (profitAmt / sellPrice) * 100 : 0;

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, restaurant_ids: rid ? [rid] : [] }); setMenuOpen(true); };

  const openEdit = (item: FoodItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      food_category_id: item.food_category_id ?? "",
      restaurant_ids: item.food_item_restaurants?.map((r) => r.restaurant_id) ?? [],
      sell_price: String(item.sell_price),
      image_url: item.image_url ?? "",
      is_active: item.is_active,
      availability_type: item.availability_type ?? "premade",
      available_quantity: String(item.available_quantity ?? 0),
      ingredients: item.food_item_ingredients?.map((r) => ({
        ingredient_id: r.ingredient_id, quantity: String(r.quantity), unit: r.unit,
      })) ?? [],
      addons: item.food_item_addons?.map((a) => ({ name: a.name, price: String(a.price) })) ?? [],
      option_groups: item.food_item_option_groups?.map((g) => ({
        name: g.name, options: g.food_item_options?.map((o) => o.label) ?? [],
      })) ?? [],
    });
    setMenuOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Food name required");
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);

    const itemData = {
      name: form.name.trim(),
      food_category_id: form.food_category_id || null,
      sell_price: parseFloat(form.sell_price) || 0,
      image_url: form.image_url || null,
      is_active: form.is_active,
      is_recipe: false,
      availability_type: form.availability_type,
      available_quantity: form.availability_type === "quantity" ? parseInt(form.available_quantity) || 0 : 0,
    };
    const restaurantIds = form.restaurant_ids.length ? form.restaurant_ids : [rid];
    const ings = form.ingredients.filter((r) => r.ingredient_id).map((r) => ({
      ingredient_id: r.ingredient_id, quantity: parseFloat(r.quantity) || 0, unit: r.unit,
    }));
    const addons = form.addons.filter((a) => a.name).map((a) => ({ name: a.name, price: parseFloat(a.price) || 0 }));
    const optGroups = form.option_groups.filter((g) => g.name).map((g) => ({
      name: g.name, options: g.options.filter(Boolean),
    }));

    const { error } = editing
      ? await update(editing.id, itemData, restaurantIds, ings, addons, optGroups)
      : await create(itemData, restaurantIds, ings, addons, optGroups);

    if (error) toast.error((error as Error).message ?? "Save failed");
    else { toast.success(editing ? "Updated!" : "Food added!"); setMenuOpen(false); }
    setSaving(false);
  };

  const toggleRestaurant = (id: string) =>
    setForm((p) => ({
      ...p,
      restaurant_ids: p.restaurant_ids.includes(id)
        ? p.restaurant_ids.filter((r) => r !== id)
        : [...p.restaurant_ids, id],
    }));

  const addIngRow = () => setForm((p) => ({ ...p, ingredients: [...p.ingredients, { ingredient_id: "", quantity: "", unit: "" }] }));
  const removeIngRow = (idx: number) => setForm((p) => ({ ...p, ingredients: p.ingredients.filter((_, i) => i !== idx) }));
  const setIngRow = (idx: number, k: keyof IngRow, v: string) =>
    setForm((p) => {
      const rows = [...p.ingredients];
      rows[idx] = { ...rows[idx], [k]: v };
      if (k === "ingredient_id") { const ing = ingredients.find((i) => i.id === v); if (ing) rows[idx].unit = ing.default_unit; }
      return { ...p, ingredients: rows };
    });

  const addAddon = () => setForm((p) => ({ ...p, addons: [...p.addons, { name: "", price: "" }] }));
  const removeAddon = (idx: number) => setForm((p) => ({ ...p, addons: p.addons.filter((_, i) => i !== idx) }));
  const setAddon = (idx: number, k: keyof AddonRow, v: string) =>
    setForm((p) => { const a = [...p.addons]; a[idx] = { ...a[idx], [k]: v }; return { ...p, addons: a }; });

  const addOptionGroup = () => setForm((p) => ({ ...p, option_groups: [...p.option_groups, { name: "", options: [""] }] }));
  const removeOptionGroup = (gi: number) => setForm((p) => ({ ...p, option_groups: p.option_groups.filter((_, i) => i !== gi) }));
  const setOptionGroupName = (gi: number, v: string) =>
    setForm((p) => { const g = [...p.option_groups]; g[gi] = { ...g[gi], name: v }; return { ...p, option_groups: g }; });
  const addOption = (gi: number) =>
    setForm((p) => { const g = [...p.option_groups]; g[gi] = { ...g[gi], options: [...g[gi].options, ""] }; return { ...p, option_groups: g }; });
  const removeOption = (gi: number, oi: number) =>
    setForm((p) => { const g = [...p.option_groups]; g[gi] = { ...g[gi], options: g[gi].options.filter((_, i) => i !== oi) }; return { ...p, option_groups: g }; });
  const setOption = (gi: number, oi: number, v: string) =>
    setForm((p) => { const g = [...p.option_groups]; const opts = [...g[gi].options]; opts[oi] = v; g[gi] = { ...g[gi], options: opts }; return { ...p, option_groups: g }; });

  if (!rid) return (
    <div><Header title="Food Menu" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border p-12 text-center">
        <ChefHat size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
      </div></div>
    </div>
  );

  return (
    <div>
      <Header title="Food Menu" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search food..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setView("grid")} className={`px-3 py-2 ${view === "grid" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}><LayoutGrid size={14} /></button>
              <button onClick={() => setView("list")} className={`px-3 py-2 ${view === "list" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}><List size={14} /></button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>Categories</Button>
            <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Food</Button>
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-700">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </p>

        {loading ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <ChefHat size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{search || filterStatus || filterCat ? "No results" : "No food items yet"}</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <FoodCard key={item.id} item={item} onEdit={openEdit}
                onDelete={async (i) => { if (!confirm(`Delete "${i.name}"?`)) return; await remove(i.id); toast.success("Deleted"); }}
                onToggle={(i, v) => toggleStatus(i.id, v)} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/60">
                  {["Photo", "Name", "Category", "Cost", "Price", "Profit", "Availability", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const cost = item.food_item_ingredients?.reduce((s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0) ?? 0;
                  const profit = item.sell_price - cost;
                  const pct = item.sell_price > 0 ? (profit / item.sell_price) * 100 : 0;
                  const isQ = item.availability_type === "quantity";
                  const qtyLeft = item.available_quantity ?? 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center">
                          {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <ChefHat size={16} className="text-orange-300" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3">{item.food_categories ? <Badge variant="info">{item.food_categories.name}</Badge> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600">৳{cost.toFixed(2)}</td>
                      <td className="px-4 py-3 font-medium">৳{Number(item.sell_price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isQ ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${qtyLeft <= 0 ? "bg-red-50 text-red-600" : qtyLeft <= 3 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>
                            {qtyLeft <= 0 ? "Empty" : `${qtyLeft} left`}
                          </span>
                        ) : (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Zap size={9} /> Premade
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><Switch checked={item.is_active} onCheckedChange={(v) => toggleStatus(item.id, v)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}><Edit2 size={13} /></Button>
                          <Button variant="danger" size="sm" onClick={async () => { if (!confirm(`Delete?`)) return; await remove(item.id); }}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen} title={editing ? "Edit Food Item" : "Add Food Item"} className="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setMenuOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save Changes" : "Add Food"}</Button></>}>
        <div className="space-y-5">
          {/* Photo */}
          <ImageUpload
            bucket="food-images"
            value={form.image_url}
            onChange={(url) => setForm((p) => ({ ...p, image_url: url }))}
            label="Food Photo"
          />

          {/* Basic */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Food Name *" placeholder="e.g. Butter Chicken" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select value={form.food_category_id} onChange={(e) => setForm((p) => ({ ...p, food_category_id: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sell Price (৳)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.sell_price}
                onChange={(e) => setForm((p) => ({ ...p, sell_price: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          {/* Availability */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Availability Type</label>
              <p className="text-xs text-gray-500 mb-2">Choose how this item is available for ordering</p>
              <div className="flex gap-2">
                {([
                  { value: "premade", label: "Premade", desc: "Always ready to sell instantly", icon: <Zap size={14} /> },
                  { value: "quantity", label: "Quantity", desc: "Limited units available to sell", icon: <Package size={14} /> },
                ] as const).map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm((p) => ({ ...p, availability_type: opt.value }))}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
                      form.availability_type === opt.value
                        ? "border-orange-500 bg-white"
                        : "border-transparent bg-white/60 hover:bg-white"
                    }`}>
                    <div className={`flex items-center gap-1.5 font-medium text-sm mb-0.5 ${form.availability_type === opt.value ? "text-orange-600" : "text-gray-700"}`}>
                      {opt.icon} {opt.label}
                    </div>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.availability_type === "quantity" && (
              <Input
                label="Available Quantity"
                type="number" min="0" step="1"
                value={form.available_quantity}
                onChange={(e) => setForm((p) => ({ ...p, available_quantity: e.target.value }))}
                hint="How many of this item can be ordered right now"
              />
            )}
          </div>

          {/* Restaurants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Restaurants</label>
            <div className="flex flex-wrap gap-2">
              {restaurants.map((r) => (
                <button key={r.id} type="button" onClick={() => toggleRestaurant(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.restaurant_ids.includes(r.id)
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <FlaskConical size={14} className="text-gray-400" /> Ingredients
              </label>
              <Button variant="ghost" size="sm" onClick={addIngRow}><Plus size={12} /> Add</Button>
            </div>
            {form.ingredients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">No ingredients added</div>
            ) : (
              <div className="space-y-2">
                {form.ingredients.map((row, idx) => {
                  const ing = ingredients.find((i) => i.id === row.ingredient_id);
                  const rowCost = ing ? ing.unit_price * (parseFloat(row.quantity) || 0) : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={row.ingredient_id} onChange={(e) => setIngRow(idx, "ingredient_id", e.target.value)}
                        className="flex-1 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="">Select ingredient</option>
                        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" placeholder="Qty" value={row.quantity}
                        onChange={(e) => setIngRow(idx, "quantity", e.target.value)}
                        className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      <span className="text-xs text-gray-400 w-8">{row.unit}</span>
                      <span className="text-xs text-gray-500 w-14 text-right">৳{rowCost.toFixed(2)}</span>
                      <button onClick={() => removeIngRow(idx)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={12} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {sellPrice > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100 grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-gray-400">Cost</p><p className="font-semibold text-sm text-gray-700 mt-0.5">৳{ingredientCost.toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-400">Profit</p><p className={`font-semibold text-sm mt-0.5 ${profitAmt >= 0 ? "text-green-600" : "text-red-500"}`}>৳{profitAmt.toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-400">Margin</p><p className={`font-semibold text-sm mt-0.5 ${profitPct >= 0 ? "text-green-600" : "text-red-500"}`}>{profitPct.toFixed(1)}%</p></div>
              </div>
            )}
          </div>

          {/* Addons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Addons</label>
              <Button variant="ghost" size="sm" onClick={addAddon}><Plus size={12} /> Add</Button>
            </div>
            {form.addons.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">No addons</div>
            ) : (
              <div className="space-y-2">
                {form.addons.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input placeholder="Addon name" value={a.name} onChange={(e) => setAddon(idx, "name", e.target.value)}
                      className="flex-1 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <input type="number" min="0" step="0.01" placeholder="Price" value={a.price} onChange={(e) => setAddon(idx, "price", e.target.value)}
                      className="w-24 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <button onClick={() => removeAddon(idx)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Option Groups */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Option Groups</label>
              <Button variant="ghost" size="sm" onClick={addOptionGroup}><Plus size={12} /> Add Group</Button>
            </div>
            {form.option_groups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">No option groups (e.g. Size, Spice Level)</div>
            ) : (
              <div className="space-y-3">
                {form.option_groups.map((group, gi) => (
                  <div key={gi} className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input placeholder="Group name (e.g. Size)" value={group.name} onChange={(e) => setOptionGroupName(gi, e.target.value)}
                        className="flex-1 h-8 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      <button onClick={() => removeOptionGroup(gi)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={12} /></button>
                    </div>
                    <div className="space-y-1.5 pl-2">
                      {group.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => setOption(gi, oi, e.target.value)}
                            className="flex-1 h-7 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                          <button onClick={() => removeOption(gi, oi)} className="w-6 h-6 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={10} /></button>
                        </div>
                      ))}
                      <button onClick={() => addOption(gi)} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 mt-1">
                        <Plus size={10} /> Add option
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} label={`Status: ${form.is_active ? "Active" : "Inactive"}`} />
        </div>
      </Dialog>

      {/* ── Categories ── */}
      <Dialog open={catOpen} onOpenChange={setCatOpen} title="Food Categories">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCat()}
              placeholder="Category name…" className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <Button size="sm" onClick={handleAddCat}><Plus size={14} /> Add</Button>
          </div>
          {categories.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No categories yet</p> : (
            <div className="space-y-1.5">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                  <span className="flex-1 text-sm text-gray-700">{c.name}</span>
                  <button onClick={async () => { if (confirm("Delete?")) await removeCategory(c.id); }}
                    className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );

  async function handleAddCat() {
    if (!newCatName.trim() || !rid) return;
    const { error } = await createCategory(newCatName.trim(), rid);
    if (error) toast.error((error as Error).message);
    else { setNewCatName(""); toast.success("Category added"); }
  }
}
