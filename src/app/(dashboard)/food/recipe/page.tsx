"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useFoodCategories } from "@/hooks/use-food-categories";
import { useIngredients } from "@/hooks/use-ingredients";
import { useFoodItems } from "@/hooks/use-food-items";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Search, Edit2, Trash2, BookOpen, X, Send,
  ChefHat, FlaskConical, TrendingUp, TrendingDown,
  MessageSquare, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { FoodItem, RecipeLog } from "@/types";

// ─── Constants ────────────────────────────────────────────
const RECIPE_STATUSES = [
  { value: "research", label: "Research", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  { value: "trial",    label: "Trial",    bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  { value: "testing",  label: "Testing",  bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500" },
  { value: "launch",   label: "Launch",   bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500" },
];

// ─── Types ────────────────────────────────────────────────
interface IngRow { ingredient_id: string; quantity: string; unit: string; }
interface AddonRow { name: string; price: string; }

interface RecipeForm {
  name: string;
  food_category_id: string;
  restaurant_ids: string[];
  sell_price: string;
  image_url: string;
  notes: string;
  is_active: boolean;
  recipe_status: string;
  ingredients: IngRow[];
  addons: AddonRow[];
}

const emptyForm: RecipeForm = {
  name: "", food_category_id: "", restaurant_ids: [],
  sell_price: "", image_url: "", notes: "",
  is_active: true, recipe_status: "research",
  ingredients: [], addons: [],
};

// ─── Recipe Card ──────────────────────────────────────────
function RecipeCard({
  item, onEdit, onDelete,
  logs, logInput, logStatus, logLoading,
  onLogInputChange, onLogStatusChange, onAddLog,
}: {
  item: FoodItem;
  onEdit: (i: FoodItem) => void;
  onDelete: (i: FoodItem) => void;
  logs: RecipeLog[];
  logInput: string;
  logStatus: string;
  logLoading: boolean;
  onLogInputChange: (v: string) => void;
  onLogStatusChange: (v: string) => void;
  onAddLog: () => void;
}) {
  const [showLog, setShowLog] = useState(false);

  const cost = item.food_item_ingredients?.reduce(
    (s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0
  ) ?? 0;
  const profit = item.sell_price - cost;
  const pct = item.sell_price > 0 ? (profit / item.sell_price) * 100 : 0;
  const statusInfo = RECIPE_STATUSES.find((s) => s.value === item.recipe_status);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-sm transition-shadow flex flex-col">
      {/* Photo */}
      <div className="relative h-40 bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={32} className="text-purple-300" />
        )}
        {/* Status badge */}
        {statusInfo && (
          <div className={`absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.label}
          </div>
        )}
        {/* Category */}
        {item.food_categories && (
          <div className="absolute top-2 right-2">
            <Badge variant="purple">{item.food_categories.name}</Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 space-y-3">
        {/* Title + actions */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(item)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Edit2 size={12} />
            </button>
            <button onClick={() => onDelete(item)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-gray-500 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2 italic">
            {item.notes}
          </p>
        )}

        {/* Ingredients — readable list */}
        {(item.food_item_ingredients?.length ?? 0) > 0 && (
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
              <FlaskConical size={10} /> Ingredients
            </p>
            <div className="space-y-1">
              {item.food_item_ingredients?.map((r) => {
                const lineTotal = (r.ingredients?.unit_price ?? 0) * r.quantity;
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs">
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

        {/* Addons */}
        {(item.food_item_addons?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Addons</p>
            <div className="flex flex-wrap gap-1">
              {item.food_item_addons?.map((a) => (
                <span key={a.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {a.name} +৳{Number(a.price).toFixed(0)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cost / Profit */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-400">Cost</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">৳{cost.toFixed(2)}</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-xs text-gray-400">Price</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">৳{Number(item.sell_price).toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Margin</p>
            <p className={`text-xs font-semibold mt-0.5 flex items-center justify-center gap-0.5 ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
              {profit >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {pct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Recipe Log toggle */}
        <button
          onClick={() => setShowLog((v) => !v)}
          className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-gray-700 transition-colors pt-1">
          <span className="flex items-center gap-1">
            <MessageSquare size={11} /> Progress Log
            {logs.length > 0 && (
              <span className="bg-purple-100 text-purple-600 rounded-full px-1.5 py-0 font-medium">{logs.length}</span>
            )}
          </span>
          {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showLog && (
          <div className="space-y-2 pt-1 border-t border-gray-100">
            {/* Log entries */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No logs yet</p>
              ) : logs.map((log) => (
                <div key={log.id} className="text-xs flex gap-2">
                  <span className="text-gray-300 whitespace-nowrap shrink-0 pt-0.5">
                    {formatDate(log.logged_at)}
                  </span>
                  <div>
                    {log.status && (
                      <span className={`inline-block text-xs font-medium px-1.5 py-0 rounded mr-1 ${RECIPE_STATUSES.find((s) => s.value === log.status)?.bg ?? "bg-gray-100"} ${RECIPE_STATUSES.find((s) => s.value === log.status)?.text ?? "text-gray-500"}`}>
                        {log.status}
                      </span>
                    )}
                    <span className="text-gray-600">{log.comment}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Add log */}
            <div className="flex gap-1.5">
              <select value={logStatus} onChange={(e) => onLogStatusChange(e.target.value)}
                className="h-7 px-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500">
                <option value="">Stage</option>
                {RECIPE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input value={logInput} onChange={(e) => onLogInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddLog()}
                placeholder="Add note..." className="flex-1 h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <button onClick={onAddLog} disabled={logLoading}
                className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-50">
                <Send size={10} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function RecipePage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { categories } = useFoodCategories(rid);
  const { ingredients } = useIngredients(rid);
  const { items, loading, create, update, remove, refresh: refreshItems } = useFoodItems(rid);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [recipeOpen, setRecipeOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [form, setForm] = useState<RecipeForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Log state per card
  const [logsMap, setLogsMap] = useState<Record<string, RecipeLog[]>>({});
  const [logInputMap, setLogInputMap] = useState<Record<string, string>>({});
  const [logStatusMap, setLogStatusMap] = useState<Record<string, string>>({});
  const [logLoading, setLogLoading] = useState(false);

  const recipeItems = useMemo(() =>
    items.filter((i) =>
      i.is_recipe &&
      i.recipe_status !== "launch" &&
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      (filterCat ? i.food_category_id === filterCat : true) &&
      (filterStatus ? i.recipe_status === filterStatus : true)
    ), [items, search, filterCat, filterStatus]);

  // ── Log helpers ─────────────────────────────────────────
  const loadLogs = async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("recipe_logs").select("*").eq("food_item_id", id).order("logged_at", { ascending: false });
    if (data) setLogsMap((p) => ({ ...p, [id]: data }));
  };

  const handleAddLog = async (itemId: string) => {
    const comment = logInputMap[itemId]?.trim();
    if (!comment) return;
    setLogLoading(true);
    const supabase = createClient();
    const logStage = logStatusMap[itemId] || null;
    const { error } = await supabase.from("recipe_logs").insert({
      food_item_id: itemId, comment, status: logStage,
    });
    if (error) { toast.error(error.message); setLogLoading(false); return; }
    setLogInputMap((p) => ({ ...p, [itemId]: "" }));
    await loadLogs(itemId);
    // If logged as "launch", move item to menu
    if (logStage === "launch") {
      await supabase.from("food_items").update({ recipe_status: "launch", is_recipe: false }).eq("id", itemId);
      await refreshItems();
      toast.success("Launched to Menu!");
    } else {
      toast.success("Log added");
    }
    setLogLoading(false);
  };

  // ── Open add / edit ──────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, restaurant_ids: rid ? [rid] : [] });
    setRecipeOpen(true);
  };

  const openEdit = (item: FoodItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      food_category_id: item.food_category_id ?? "",
      restaurant_ids: item.food_item_restaurants?.map((r) => r.restaurant_id) ?? [],
      sell_price: String(item.sell_price),
      image_url: item.image_url ?? "",
      notes: item.notes ?? "",
      is_active: item.is_active,
      recipe_status: item.recipe_status ?? "research",
      ingredients: item.food_item_ingredients?.map((r) => ({
        ingredient_id: r.ingredient_id, quantity: String(r.quantity), unit: r.unit,
      })) ?? [],
      addons: item.food_item_addons?.map((a) => ({ name: a.name, price: String(a.price) })) ?? [],
    });
    setRecipeOpen(true);
    if (!logsMap[item.id]) loadLogs(item.id);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Recipe name required");
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);

    const isLaunching = form.recipe_status === "launch";
    const itemData = {
      name: form.name.trim(),
      food_category_id: form.food_category_id || null,
      sell_price: parseFloat(form.sell_price) || 0,
      image_url: form.image_url || null,
      is_active: form.is_active,
      is_recipe: !isLaunching,
      recipe_status: form.recipe_status || null,
      notes: form.notes || null,
      availability_type: "premade" as const,
      available_quantity: 0,
    };
    const restaurantIds = form.restaurant_ids.length ? form.restaurant_ids : [rid];
    const ings = form.ingredients.filter((r) => r.ingredient_id).map((r) => ({
      ingredient_id: r.ingredient_id, quantity: parseFloat(r.quantity) || 0, unit: r.unit,
    }));
    const addons = form.addons.filter((a) => a.name).map((a) => ({
      name: a.name, price: parseFloat(a.price) || 0,
    }));

    const { error } = editing
      ? await update(editing.id, itemData, restaurantIds, ings, addons, [])
      : await create(itemData, restaurantIds, ings, addons, []);

    if (error) toast.error((error as Error).message ?? "Save failed");
    else {
      toast.success(isLaunching ? "Launched to Menu!" : editing ? "Recipe updated!" : "Recipe saved!");
      setRecipeOpen(false);
    }
    setSaving(false);
  };

  // ── Ingredient row helpers ───────────────────────────────
  const addIngRow = () => setForm((p) => ({ ...p, ingredients: [...p.ingredients, { ingredient_id: "", quantity: "", unit: "" }] }));
  const removeIngRow = (idx: number) => setForm((p) => ({ ...p, ingredients: p.ingredients.filter((_, i) => i !== idx) }));
  const setIngRow = (idx: number, k: keyof IngRow, v: string) =>
    setForm((p) => {
      const rows = [...p.ingredients]; rows[idx] = { ...rows[idx], [k]: v };
      if (k === "ingredient_id") { const ing = ingredients.find((i) => i.id === v); if (ing) rows[idx].unit = ing.default_unit; }
      return { ...p, ingredients: rows };
    });

  const addAddon = () => setForm((p) => ({ ...p, addons: [...p.addons, { name: "", price: "" }] }));
  const removeAddon = (idx: number) => setForm((p) => ({ ...p, addons: p.addons.filter((_, i) => i !== idx) }));
  const setAddon = (idx: number, k: keyof AddonRow, v: string) =>
    setForm((p) => { const a = [...p.addons]; a[idx] = { ...a[idx], [k]: v }; return { ...p, addons: a }; });

  const toggleRestaurant = (id: string) =>
    setForm((p) => ({
      ...p,
      restaurant_ids: p.restaurant_ids.includes(id)
        ? p.restaurant_ids.filter((r) => r !== id)
        : [...p.restaurant_ids, id],
    }));

  // ── Ingredient cost preview ──────────────────────────────
  const ingredientCost = form.ingredients.reduce((sum, row) => {
    const ing = ingredients.find((i) => i.id === row.ingredient_id);
    return sum + (ing ? ing.unit_price * (parseFloat(row.quantity) || 0) : 0);
  }, 0);
  const sellPrice = parseFloat(form.sell_price) || 0;
  const profitAmt = sellPrice - ingredientCost;
  const profitPct = sellPrice > 0 ? (profitAmt / sellPrice) * 100 : 0;

  if (!rid) return (
    <div><Header title="Food Recipe" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border p-12 text-center">
        <ChefHat size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
        <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
      </div></div>
    </div>
  );

  return (
    <div>
      <Header title="Food Recipe" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipes..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Stages</option>
              {RECIPE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Recipe</Button>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {RECIPE_STATUSES.map((s) => {
            const count = items.filter((i) => i.is_recipe && i.recipe_status === s.value).length;
            return count > 0 ? (
              <span key={s.value}
                onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
                className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                  filterStatus === s.value ? `${s.bg} ${s.text} border-current` : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label} <span className="font-bold">{count}</span>
              </span>
            ) : null;
          })}
          <span className="text-xs text-gray-400 ml-1">{recipeItems.length} recipe{recipeItems.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : recipeItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <BookOpen size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{search || filterCat || filterStatus ? "No recipes match filters" : "No recipes yet"}</p>
            <Button size="sm" className="mt-4" onClick={openAdd}><Plus size={14} /> Add First Recipe</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recipeItems.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                onEdit={openEdit}
                onDelete={async (i) => {
                  if (!confirm(`Delete "${i.name}"?`)) return;
                  await remove(i.id);
                  toast.success("Recipe deleted");
                }}
                logs={logsMap[item.id] ?? []}
                logInput={logInputMap[item.id] ?? ""}
                logStatus={logStatusMap[item.id] ?? ""}
                logLoading={logLoading}
                onLogInputChange={(v) => setLogInputMap((p) => ({ ...p, [item.id]: v }))}
                onLogStatusChange={(v) => setLogStatusMap((p) => ({ ...p, [item.id]: v }))}
                onAddLog={async () => {
                  if (!logsMap[item.id]) await loadLogs(item.id);
                  await handleAddLog(item.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}
        title={editing ? "Edit Recipe" : "Add Recipe"}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setRecipeOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? "Save Changes" : "Save Recipe"}</Button>
          </>
        }>
        <div className="space-y-5">
          {/* Photo */}
          <ImageUpload
            bucket="food-images"
            value={form.image_url}
            onChange={(url) => setForm((p) => ({ ...p, image_url: url }))}
            label="Recipe Photo"
          />

          {/* Basic */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Recipe Name *" placeholder="e.g. Smoked Beef Brisket" value={form.name}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipe Stage</label>
              <select value={form.recipe_status} onChange={(e) => setForm((p) => ({ ...p, recipe_status: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                {RECIPE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Sell Price */}
          <Input label="Sell / Target Price (৳)" type="number" min="0" step="0.01" placeholder="0.00"
            value={form.sell_price} onChange={(e) => setForm((p) => ({ ...p, sell_price: e.target.value }))}
            hint="Set target selling price to calculate profit margin" />

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
                      <button onClick={() => removeIngRow(idx)}
                        className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={12} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Cost preview */}
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
                    <button onClick={() => removeAddon(idx)}
                      className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <Textarea label="Notes / Preparation Tips" placeholder="Describe the recipe, prep instructions, tips..."
            value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
            label={`Status: ${form.is_active ? "Active" : "Inactive"}`} />
        </div>
      </Dialog>
    </div>
  );
}
