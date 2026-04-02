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
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Search, Edit2, Trash2, LayoutGrid, List,
  ChefHat, X, TrendingUp, TrendingDown, FlaskConical,
  Package, Zap, ScrollText, Layers, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import type { FoodItem } from "@/types";

// ─── Recipe Log Types ──────────────────────────────────────
interface RecipeLog {
  id: string;
  status: string;
  quantity: number;
  trial_cost: number | null;
  comment: string | null;
  logged_at: string;
}

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
function FoodCard({ item, onEdit, onDelete, onToggle, onViewHistory, onViewIngredients }: {
  item: FoodItem;
  onEdit: (i: FoodItem) => void;
  onDelete: (i: FoodItem) => void;
  onToggle: (i: FoodItem, v: boolean) => void;
  onViewHistory: (i: FoodItem) => void;
  onViewIngredients: (i: FoodItem) => void;
}) {
  const cost = item.food_item_ingredients?.reduce((s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0) ?? 0;
  const profit = item.sell_price - cost;
  const pct = item.sell_price > 0 ? (profit / item.sell_price) * 100 : 0;
  const isQuantity = item.availability_type === "quantity";
  const qty = item.available_quantity ?? 0;
  const isEmpty = isQuantity && qty <= 0;
  const ings = item.food_item_ingredients ?? [];

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col ${isEmpty ? "border-red-200" : "border-border"}`}>
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <ChefHat size={22} className="text-orange-300" />
        )}
        {isQuantity && (
          <div className={`absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            isEmpty ? "bg-red-500 text-white" : qty <= 3 ? "bg-orange-500 text-white" : "bg-green-500 text-white"
          }`}>
            {isEmpty ? "Empty" : `${qty}`}
          </div>
        )}
        {!isQuantity && (
          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Zap size={9} /> <span className="hidden sm:inline">Premade</span>
          </div>
        )}
        {item.recipe_status === "launch" && (
          <div className="absolute bottom-1.5 left-1.5 bg-purple-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <ScrollText size={9} /> <span className="hidden sm:inline">Recipe</span>
          </div>
        )}
      </div>

      <div className="p-2 sm:p-2.5 flex flex-col flex-1 gap-1.5 sm:gap-2">
        {/* Name + Category */}
        <div className="min-w-0">
          <p className="text-gray-700 text-xs sm:text-sm leading-tight truncate">{item.name}</p>
          {item.food_categories && (
            <span className="text-[9px] sm:text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block truncate max-w-full">{item.food_categories.name}</span>
          )}
        </div>

        {/* Cost / Price / Margin */}
        <div className="grid grid-cols-3 gap-0.5 pt-1.5 border-t border-gray-100">
          <div className="text-center">
            <p className="text-[9px] text-gray-400 leading-none">Cost</p>
            <p className="font-bold text-gray-700 text-[10px] sm:text-xs mt-0.5">৳{cost.toFixed(0)}</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-[9px] text-gray-400 leading-none">Price</p>
            <p className="font-bold text-gray-700 text-[10px] sm:text-xs mt-0.5">৳{Number(item.sell_price).toFixed(0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400 leading-none">Margin</p>
            <p className={`font-bold text-[10px] sm:text-xs mt-0.5 flex items-center justify-center gap-0.5 ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
              {profit >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
              {pct.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Bottom row: Actions + Status */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="flex items-center gap-0.5">
            {item.recipe_status === "launch" && (
              <button onClick={() => onViewHistory(item)} title="Recipe research history"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-purple-500 hover:bg-purple-50 transition-colors">
                <ScrollText size={12} />
              </button>
            )}
            {ings.length > 0 && (
              <button onClick={() => onViewIngredients(item)} title="View ingredients"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <Layers size={12} />
              </button>
            )}
            <button onClick={() => onEdit(item)} title="Edit"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <Edit2 size={12} />
            </button>
            <button onClick={() => onDelete(item)} title="Delete"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
          <button
            onClick={() => onToggle(item, !item.is_active)}
            className={`inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-semibold transition-colors ${
              item.is_active
                ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600"
                : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
            }`}>
            {item.is_active ? <ToggleRight size={11} /> : <ToggleLeft size={11} />}
            {item.is_active ? "Active" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function FoodMenuPage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { categories, create: createCategory, update: updateCategory, remove: removeCategory } = useFoodCategories(rid);
  const { ingredients } = useIngredients(rid);
  const { items, loading, create, update, remove, toggleStatus } = useFoodItems(rid);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterCat, setFilterCat] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [form, setForm] = useState<MenuForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [addingCatInForm, setAddingCatInForm] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const [historyItem, setHistoryItem] = useState<FoodItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<RecipeLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [ingItem, setIngItem] = useState<FoodItem | null>(null);

  const openHistory = async (item: FoodItem) => {
    setHistoryItem(item);
    setHistoryLogs([]);
    setHistoryLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("recipe_logs")
      .select("*")
      .eq("food_item_id", item.id)
      .order("logged_at", { ascending: false });
    if (error) console.error("Recipe logs error:", error);
    setHistoryLogs(data ?? []);
    setHistoryLoading(false);
  };

  const handleInlineAddCat = async () => {
    if (!inlineCatName.trim() || !rid) return;
    const { error, data } = await createCategory(inlineCatName.trim(), rid);
    if (error) { toast.error("Failed to add category"); return; }
    if (data) setForm((p) => ({ ...p, food_category_id: data.id }));
    toast.success(`Category "${inlineCatName.trim()}" added`);
    setAddingCatInForm(false);
    setInlineCatName("");
  };

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
    if (!form.name.trim()) return toast.error("Food name is required");
    if (!form.food_category_id) return toast.error("Please select a category");
    if (!form.sell_price || parseFloat(form.sell_price) <= 0) return toast.error("Sell price must be greater than 0");
    const validIngs = form.ingredients.filter((r) => r.ingredient_id);
    if (validIngs.length === 0) return toast.error("Add at least one ingredient");
    const restaurantIds = form.restaurant_ids.length ? form.restaurant_ids : rid ? [rid] : [];
    if (restaurantIds.length === 0) return toast.error("Select at least one restaurant");
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);

    const itemData = {
      name: form.name.trim(),
      food_category_id: form.food_category_id || undefined,
      sell_price: parseFloat(form.sell_price) || 0,
      image_url: form.image_url || undefined,
      is_active: form.is_active,
      is_recipe: false,
      availability_type: form.availability_type,
      available_quantity: form.availability_type === "quantity" ? parseInt(form.available_quantity) || 0 : 0,
    };
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
    else {
      const msg = editing ? "Updated!" : restaurantIds.length > 1
        ? `"${form.name}" added to ${restaurantIds.length} restaurants (each editable separately)`
        : "Food added!";
      toast.success(msg);
      setMenuOpen(false);
    }
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
      <div className="p-4 md:p-6"><div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
        <ChefHat size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
      </div></div>
    </div>
  );

  return (
    <div>
      <Header title="Food Menu" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="bg-white rounded-xl border border-border shadow-sm shrink-0 flex flex-wrap items-center px-[14px] gap-3 overflow-x-auto py-2.5 md:h-[62px] md:py-0">
          <div className="flex items-center gap-2 flex-1 flex-wrap min-w-0">
            {/* Status tabs */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 shrink-0">
              {(["active", "", "inactive"] as const).map((val, i) => (
                <button key={i} onClick={() => setFilterStatus(val)}
                  className={`h-7 px-2.5 sm:px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    filterStatus === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {val === "" ? "All" : val === "active" ? "Active" : "Inactive"}
                </button>
              ))}
            </div>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              className="h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent max-w-[140px] sm:max-w-none">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 shrink-0">
              <button onClick={() => setView("grid")} className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all flex items-center ${view === "grid" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><LayoutGrid size={14} /></button>
              <button onClick={() => setView("list")} className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all flex items-center ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><List size={14} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="md" onClick={() => setCatOpen(true)} className="hidden sm:flex">Categories</Button>
            <Button size="md" onClick={openAdd}><Plus size={14} /> <span className="hidden sm:inline">Add Food</span><span className="sm:hidden">Add</span></Button>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className="w-32 sm:w-48 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
            </div>
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-700">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </p>

        {loading ? (
          <div className="bg-white rounded-xl border border-border shadow-sm p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
            <ChefHat size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{search || filterStatus || filterCat ? "No results" : "No food items yet"}</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-x-4 sm:gap-y-[18px]">
            {filtered.map((item) => (
              <FoodCard key={item.id} item={item} onEdit={openEdit}
                onDelete={async (i) => { if (!confirm(`Delete "${i.name}"?`)) return; const { error } = await remove(i.id); if (error) toast.error(error.message); else toast.success("Deleted"); }}
                onToggle={(i, v) => toggleStatus(i.id, v)}
                onViewHistory={openHistory}
                onViewIngredients={(i) => setIngItem(i)} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/60">
                  {["Photo", "Name", "Category", "Cost", "Price", "Margin", "Availability", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const cost = item.food_item_ingredients?.reduce((s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0) ?? 0;
                  const profit = item.sell_price - cost;
                  const pct = item.sell_price > 0 ? (profit / item.sell_price) * 100 : 0;
                  const isQ = item.availability_type === "quantity";
                  const qtyLeft = item.available_quantity ?? 0;
                  const tableIngs = item.food_item_ingredients ?? [];
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <ChefHat size={16} className="text-gray-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-sm">{item.name}</td>
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(item.id, !item.is_active)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            item.is_active ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600" : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
                          }`}>
                          {item.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {item.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 items-center justify-end">
                          {item.recipe_status === "launch" && (
                            <button onClick={() => openHistory(item)} title="Recipe history"
                              className="w-8 h-8 rounded-md flex items-center justify-center text-purple-500 hover:bg-purple-50 transition-colors">
                              <ScrollText size={14} />
                            </button>
                          )}
                          {tableIngs.length > 0 && (
                            <button onClick={() => setIngItem(item)} title="View ingredients"
                              className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                              <Layers size={14} />
                            </button>
                          )}
                          <button onClick={() => openEdit(item)} title="Edit"
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={async () => { if (!confirm(`Delete "${item.name}"?`)) return; await remove(item.id); }} title="Delete"
                            className="w-8 h-8 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
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
              {addingCatInForm ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleInlineAddCat(); if (e.key === "Escape") { setAddingCatInForm(false); setInlineCatName(""); } }}
                    placeholder="New category name…"
                    className="flex-1 h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]"
                  />
                  <button type="button" onClick={handleInlineAddCat} className="px-3 h-9 rounded-lg bg-[#111827] text-white text-xs font-semibold hover:bg-black">Add</button>
                  <button type="button" onClick={() => { setAddingCatInForm(false); setInlineCatName(""); }} className="px-3 h-9 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">✕</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select value={form.food_category_id} onChange={(e) => setForm((p) => ({ ...p, food_category_id: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    <option value="">No category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setAddingCatInForm(true)}
                    title="Add new category"
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-600 transition-colors shrink-0">
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sell Price (৳)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.sell_price}
                onChange={(e) => setForm((p) => ({ ...p, sell_price: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]" />
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
                        ? "border-[#111827] bg-white"
                        : "border-transparent bg-white/60 hover:bg-white"
                    }`}>
                    <div className={`flex items-center gap-1.5 font-medium text-sm mb-0.5 ${form.availability_type === opt.value ? "text-[#111827]" : "text-gray-700"}`}>
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
            <label className="block text-sm font-medium text-gray-700 mb-0.5">Restaurants</label>
            {!editing && <p className="text-xs text-gray-400 mb-2">Selecting multiple restaurants creates an independent copy per restaurant — each can have a different price.</p>}
            <div className="flex flex-wrap gap-2">
              {restaurants.map((r) => (
                <button key={r.id} type="button" onClick={() => toggleRestaurant(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.restaurant_ids.includes(r.id)
                      ? "bg-[#111827] text-white border-[#111827]"
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
                        className="flex-1 h-8 px-2 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                        <option value="">Select ingredient</option>
                        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" placeholder="Qty" value={row.quantity}
                        onChange={(e) => setIngRow(idx, "quantity", e.target.value)}
                        className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]" />
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
                      className="flex-1 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]" />
                    <input type="number" min="0" step="0.01" placeholder="Price" value={a.price} onChange={(e) => setAddon(idx, "price", e.target.value)}
                      className="w-24 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]" />
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
                        className="flex-1 h-8 px-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#111827]" />
                      <button onClick={() => removeOptionGroup(gi)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={12} /></button>
                    </div>
                    <div className="space-y-1.5 pl-2">
                      {group.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => setOption(gi, oi, e.target.value)}
                            className="flex-1 h-7 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]" />
                          <button onClick={() => removeOption(gi, oi)} className="w-6 h-6 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={10} /></button>
                        </div>
                      ))}
                      <button onClick={() => addOption(gi)} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mt-1">
                        <Plus size={10} /> Add option
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} label="Status" />
        </div>
      </Dialog>

      {/* ── Recipe Research History ── */}
      {historyItem && (
        <Dialog open={!!historyItem} onOpenChange={(open) => { if (!open) setHistoryItem(null); }} title={`Recipe History — ${historyItem.name}`} className="max-w-lg">
          <div className="space-y-4">
            {historyLoading ? (
              <p className="text-sm text-gray-400 text-center py-6">Loading logs…</p>
            ) : historyLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No research logs found.</p>
            ) : (
              <>
                {/* Summary */}
                {(() => {
                  const totalQty = historyLogs.reduce((s, l) => s + (l.quantity ?? 0), 0);
                  const totalCost = historyLogs.reduce((s, l) => s + (l.trial_cost ?? 0), 0);
                  return (
                    <div className="grid grid-cols-3 gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100 text-center text-sm">
                      <div>
                        <p className="text-xs text-purple-500 font-medium">Trials</p>
                        <p className="font-bold text-purple-800 mt-0.5">{historyLogs.length}</p>
                      </div>
                      <div className="border-x border-purple-200">
                        <p className="text-xs text-purple-500 font-medium">Units Tested</p>
                        <p className="font-bold text-purple-800 mt-0.5">{totalQty}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-500 font-medium">Total R&D Cost</p>
                        <p className="font-bold text-purple-800 mt-0.5">৳{totalCost.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Log entries */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                          {log.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date((log as any).logged_at ?? (log as any).created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-1.5">
                        <span>Qty: <strong>{log.quantity}</strong></span>
                        {log.trial_cost != null && log.trial_cost > 0 && (
                          <span>Cost: <strong className="text-orange-600">৳{log.trial_cost.toFixed(2)}</strong></span>
                        )}
                      </div>
                      {log.comment && (
                        <p className="text-xs text-gray-500 mt-1.5 italic">"{log.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}

      {/* ── Ingredients Modal ── */}
      {ingItem && (() => {
        const ings = ingItem.food_item_ingredients ?? [];
        const totalCost = ings.reduce((s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0);
        const sellPrice = Number(ingItem.sell_price);
        const profit = sellPrice - totalCost;
        const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
        return (
          <Dialog open={!!ingItem} onOpenChange={(open) => { if (!open) setIngItem(null); }}
            title={ingItem.name} className="max-w-md">
            <div className="space-y-4">
              {/* Header info */}
              <div className="space-y-2">
                {ingItem.food_categories && (
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{ingItem.food_categories.name}</p>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Sell Price</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">৳{sellPrice.toFixed(0)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Cost</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">৳{totalCost.toFixed(0)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Margin</p>
                    <p className={`font-bold text-sm mt-0.5 ${margin >= 0 ? "text-green-600" : "text-red-500"}`}>{margin.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Ingredient list */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
                {ings.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No ingredients linked.</p>
                ) : (
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <div className="grid grid-cols-3 gap-0 bg-gray-50 border-b border-gray-100 px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      <span>Ingredient</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Cost</span>
                    </div>
                    {ings.map((r, i) => {
                      const lineTotal = (r.ingredients?.unit_price ?? 0) * r.quantity;
                      return (
                        <div key={i} className="grid grid-cols-3 gap-0 px-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                            <span className="text-gray-700 truncate">{r.ingredients?.name ?? "—"}</span>
                          </div>
                          <span className="text-center text-gray-500 text-xs self-center">{r.quantity} {r.unit}</span>
                          <span className="text-right font-medium text-orange-600 self-center">{lineTotal > 0 ? `৳${lineTotal.toFixed(2)}` : "—"}</span>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-3 gap-0 px-3 py-2 bg-gray-50 border-t border-gray-200 text-sm font-semibold">
                      <span className="col-span-2 text-gray-600">Total Cost</span>
                      <span className="text-right text-orange-700">৳{totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Dialog>
        );
      })()}

      {/* ── Categories ── */}
      <Dialog open={catOpen} onOpenChange={setCatOpen} title="Food Categories">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCat()}
              placeholder="Category name…" className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]" />
            <Button size="sm" onClick={handleAddCat}><Plus size={14} /> Add</Button>
          </div>
          {categories.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No categories yet</p> : (
            <div className="space-y-1.5">
              {categories.map((c) => {
                const count = items.filter((i) => !i.is_recipe && i.food_category_id === c.id).length;
                const isEditing = editingCatId === c.id;
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            if (editingCatName.trim()) await updateCategory(c.id, { name: editingCatName.trim() });
                            setEditingCatId(null);
                          }
                          if (e.key === "Escape") setEditingCatId(null);
                        }}
                        className="flex-1 h-7 px-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#111827]"
                      />
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-gray-700 font-medium">{c.name}</span>
                        <span className="text-xs text-gray-400 font-medium px-1.5 py-0.5 bg-gray-200 rounded-full shrink-0">{count}</span>
                      </>
                    )}
                    {isEditing ? (
                      <>
                        <button
                          onClick={async () => {
                            if (editingCatName.trim()) await updateCategory(c.id, { name: editingCatName.trim() });
                            setEditingCatId(null);
                          }}
                          className="w-7 h-7 rounded-lg text-green-600 hover:bg-green-50 flex items-center justify-center text-xs font-bold">✓</button>
                        <button onClick={() => setEditingCatId(null)}
                          className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X size={12} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }}
                          className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 flex items-center justify-center"><Edit2 size={12} /></button>
                        <button onClick={async () => { if (confirm(`Delete "${c.name}"?`)) await removeCategory(c.id); }}
                          className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                );
              })}
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
