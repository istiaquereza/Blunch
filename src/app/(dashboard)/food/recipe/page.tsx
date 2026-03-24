"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  MessageSquare, ChevronDown, ChevronUp, Youtube, Link2,
  Rocket, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { FoodItem, RecipeLog } from "@/types";

// ─── Constants ────────────────────────────────────────────
// "launch" is intentionally excluded — launch is a dedicated action, not a stage
const RECIPE_STATUSES = [
  { value: "research", label: "Research", bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400" },
  { value: "trial",    label: "Trial",    bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  { value: "testing",  label: "Testing",  bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500" },
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
  recipe_links: string[];
}

const emptyForm: RecipeForm = {
  name: "", food_category_id: "", restaurant_ids: [],
  sell_price: "", image_url: "", notes: "",
  is_active: true, recipe_status: "research",
  ingredients: [], addons: [], recipe_links: [],
};

// ─── Recipe Card ──────────────────────────────────────────
function RecipeCard({
  item, onEdit, onDelete, onLaunch,
  logs, logInput, logStatus, logLoading, logQuantity,
  onLogInputChange, onLogStatusChange, onAddLog, onLogQuantityChange,
  computedLogCost,
}: {
  item: FoodItem;
  onEdit: (i: FoodItem) => void;
  onDelete: (i: FoodItem) => void;
  onLaunch: (i: FoodItem) => void;
  logs: RecipeLog[];
  logInput: string;
  logStatus: string;
  logLoading: boolean;
  logQuantity: string;
  onLogInputChange: (v: string) => void;
  onLogStatusChange: (v: string) => void;
  onAddLog: () => void;
  onLogQuantityChange: (v: string) => void;
  computedLogCost: number;
}) {
  const [showLog, setShowLog] = useState(false);

  const costPerUnit = item.food_item_ingredients?.reduce(
    (s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0
  ) ?? 0;
  const profit = item.sell_price - costPerUnit;
  const pct = item.sell_price > 0 ? (profit / item.sell_price) * 100 : 0;
  const statusInfo = RECIPE_STATUSES.find((s) => s.value === item.recipe_status);

  // lifecycle totals from logs
  const totalLogCost = logs.reduce((s, l) => s + (l.trial_cost ?? 0), 0);
  const totalLogQty  = logs.reduce((s, l) => s + (l.quantity ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-sm transition-shadow flex flex-col">
      {/* Photo */}
      <div className="relative h-40 bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={32} className="text-purple-300" />
        )}
        {statusInfo && (
          <div className={`absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.label}
          </div>
        )}
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

        {/* Recipe Links */}
        {(item.recipe_links?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
              <Link2 size={10} /> Links
            </p>
            <div className="flex flex-col gap-1">
              {item.recipe_links?.map((link, i) => (
                <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline truncate flex items-center gap-1">
                  {link.includes("youtube") || link.includes("youtu.be")
                    ? <Youtube size={10} className="text-red-500 shrink-0" />
                    : <Link2 size={10} className="text-gray-400 shrink-0" />}
                  <span className="truncate">{link}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
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
            <p className="text-xs text-gray-400">Cost/unit</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">৳{costPerUnit.toFixed(2)}</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-xs text-gray-400">Target Price</p>
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

        {/* Progress Log toggle */}
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
            {/* Lifecycle summary */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No logs yet</p>
              ) : (
                <>
                  {/* Lifecycle cost summary banner */}
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2">
                    <span className="text-xs text-amber-700 font-medium">Research Cost</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-amber-600">{totalLogQty} made</span>
                      <span className="font-bold text-amber-800">৳{totalLogCost.toFixed(2)}</span>
                    </div>
                  </div>
                  {logs.map((log) => {
                    const stageDef = RECIPE_STATUSES.find((s) => s.value === log.status);
                    return (
                      <div key={log.id} className="text-xs flex gap-2">
                        <span className="text-gray-300 whitespace-nowrap shrink-0 pt-0.5">
                          {formatDate(log.logged_at)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1 mb-0.5">
                            {stageDef && (
                              <span className={`inline-block text-xs font-medium px-1.5 py-0 rounded ${stageDef.bg} ${stageDef.text}`}>
                                {stageDef.label}
                              </span>
                            )}
                            {(log.quantity ?? 0) > 0 && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0 rounded font-medium">×{log.quantity}</span>
                            )}
                            {(log.trial_cost ?? 0) > 0 && (
                              <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0 rounded font-medium">৳{Number(log.trial_cost).toFixed(0)}</span>
                            )}
                          </div>
                          <span className="text-gray-600">{log.comment}</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Add log form — stage + qty + note only; cost is auto-computed */}
            <div className="space-y-1.5 border-t border-gray-100 pt-2">
              <div className="flex gap-1.5">
                <select value={logStatus} onChange={(e) => onLogStatusChange(e.target.value)}
                  className="flex-1 h-7 px-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500">
                  <option value="">Stage *</option>
                  {RECIPE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input type="number" min="1" placeholder="Qty *" value={logQuantity}
                  onChange={(e) => onLogQuantityChange(e.target.value)}
                  className="w-16 h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  title="How many units made this trial" />
              </div>
              {/* Auto-computed cost preview */}
              {computedLogCost > 0 && logQuantity && Number(logQuantity) > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 rounded px-2 py-1">
                  <AlertCircle size={9} /> Auto cost: ৳{computedLogCost.toFixed(2)} (ingredients deducted from stock)
                </div>
              )}
              <div className="flex gap-1.5">
                <input value={logInput} onChange={(e) => onLogInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAddLog()}
                  placeholder="Add note..." className="flex-1 h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                <button onClick={onAddLog} disabled={logLoading}
                  className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-50">
                  <Send size={10} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Launch to Menu button ── */}
        <button
          onClick={() => onLaunch(item)}
          className="mt-auto flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors">
          <Rocket size={12} /> Launch to Food Menu
        </button>
      </div>
    </div>
  );
}

// ─── Helper: get or create "Recipe Testing" expense category ─────────────────
async function getOrCreateRecipeCategoryId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("expense_categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", "Recipe Testing")
    .eq("type", "expense")
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("expense_categories")
    .insert({ name: "Recipe Testing", type: "expense", user_id: user.id })
    .select("id")
    .single();

  return created?.id ?? null;
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

  // Per-card log state
  const [logsMap, setLogsMap] = useState<Record<string, RecipeLog[]>>({});
  const [logInputMap, setLogInputMap] = useState<Record<string, string>>({});
  const [logStatusMap, setLogStatusMap] = useState<Record<string, string>>({});
  const [logQuantityMap, setLogQuantityMap] = useState<Record<string, string>>({});
  const [logLoading, setLogLoading] = useState(false);

  // Launch confirm modal
  const [launchItem, setLaunchItem] = useState<FoodItem | null>(null);
  const [launching, setLaunching] = useState(false);

  const recipeItems = useMemo(() =>
    items.filter((i) =>
      i.is_recipe &&
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      (filterCat ? i.food_category_id === filterCat : true) &&
      (filterStatus ? i.recipe_status === filterStatus : true)
    ), [items, search, filterCat, filterStatus]);

  // ── Load all logs whenever recipe items change ───────────
  const loadLogs = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("recipe_logs")
      .select("*")
      .eq("food_item_id", id)
      .order("logged_at", { ascending: false });
    if (data) setLogsMap((p) => ({ ...p, [id]: data }));
  }, []);

  useEffect(() => {
    if (recipeItems.length === 0) return;
    recipeItems.forEach((item) => loadLogs(item.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeItems.map((i) => i.id).join(",")]);

  // ── Add log ──────────────────────────────────────────────
  const handleAddLog = async (item: FoodItem) => {
    const comment = logInputMap[item.id]?.trim();
    const stage = logStatusMap[item.id];
    const qty = parseInt(logQuantityMap[item.id] || "0");

    if (!stage) { toast.error("Select a stage"); return; }
    if (!qty || qty <= 0) { toast.error("Enter quantity"); return; }
    if (!comment) { toast.error("Add a note"); return; }

    setLogLoading(true);
    const supabase = createClient();

    // Auto-compute cost from ingredient prices × quantity
    const costPerUnit = item.food_item_ingredients?.reduce(
      (s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0
    ) ?? 0;
    const totalCost = costPerUnit * qty;

    // 1. Insert recipe log
    const { error } = await supabase.from("recipe_logs").insert({
      food_item_id: item.id,
      comment,
      status: stage,
      quantity: qty,
      trial_cost: totalCost > 0 ? totalCost : null,
    });
    if (error) { toast.error(error.message); setLogLoading(false); return; }

    // 2. Deduct ingredients from food_stock
    if (rid && (item.food_item_ingredients?.length ?? 0) > 0) {
      for (const ing of item.food_item_ingredients ?? []) {
        const deductQty = ing.quantity * qty;
        const { data: stockRow } = await supabase
          .from("food_stock")
          .select("quantity")
          .eq("ingredient_id", ing.ingredient_id)
          .eq("restaurant_id", rid)
          .maybeSingle();

        const newQty = Math.max(0, (stockRow?.quantity ?? 0) - deductQty);
        await supabase.from("food_stock").upsert(
          { ingredient_id: ing.ingredient_id, restaurant_id: rid, quantity: newQty, updated_at: new Date().toISOString() },
          { onConflict: "ingredient_id,restaurant_id" }
        );
      }
    }

    // 3. Record expense in transactions
    if (rid && totalCost > 0) {
      const categoryId = await getOrCreateRecipeCategoryId(supabase);
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      await supabase.from("transactions").insert({
        restaurant_id: rid,
        type: "expense",
        amount: totalCost,
        description: `Recipe trial: ${item.name} ×${qty} [${stage}]`,
        category_id: categoryId ?? null,
        status: "paid",
        transaction_date: todayStr,
      });
    }

    // Reset inputs
    setLogInputMap((p) => ({ ...p, [item.id]: "" }));
    setLogQuantityMap((p) => ({ ...p, [item.id]: "" }));
    setLogStatusMap((p) => ({ ...p, [item.id]: "" }));
    await loadLogs(item.id);
    toast.success(`Log added${totalCost > 0 ? ` · ৳${totalCost.toFixed(0)} expense recorded` : ""}`);
    setLogLoading(false);
  };

  // ── Launch to food menu ──────────────────────────────────
  const handleLaunch = async () => {
    if (!launchItem) return;
    setLaunching(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("food_items")
      .update({ is_recipe: false, recipe_status: "launch" })
      .eq("id", launchItem.id);

    if (error) { toast.error("Launch failed: " + error.message); setLaunching(false); return; }
    await refreshItems();
    toast.success(`"${launchItem.name}" is now live in the Food Menu!`);
    setLaunchItem(null);
    setLaunching(false);
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
      recipe_links: item.recipe_links ?? [],
    });
    setRecipeOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Recipe name is required");
    if (!form.sell_price || parseFloat(form.sell_price) <= 0)
      return toast.error("Target sell price is required");
    if (!rid) return toast.error("Select a restaurant first");

    setSaving(true);
    const itemData = {
      name: form.name.trim(),
      food_category_id: form.food_category_id || undefined,
      sell_price: parseFloat(form.sell_price),
      image_url: form.image_url || undefined,
      is_active: form.is_active,
      is_recipe: true,
      recipe_status: (form.recipe_status || "research") as FoodItem["recipe_status"],
      notes: form.notes || undefined,
      recipe_links: form.recipe_links.filter((l) => l.trim()),
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
      toast.success(editing ? "Recipe updated!" : "Recipe saved!");
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

  // ── Cost preview in form ─────────────────────────────────
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
        <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Stages</option>
              {RECIPE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Recipe</Button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipes..."
              className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {RECIPE_STATUSES.map((s) => {
            const count = recipeItems.filter((i) => i.recipe_status === s.value).length;
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
            {recipeItems.map((item) => {
              const costPerUnit = item.food_item_ingredients?.reduce(
                (s, r) => s + (r.ingredients?.unit_price ?? 0) * r.quantity, 0
              ) ?? 0;
              const qty = parseInt(logQuantityMap[item.id] || "0");
              return (
                <RecipeCard
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onDelete={async (i) => {
                    if (!confirm(`Delete "${i.name}"?`)) return;
                    await remove(i.id);
                    toast.success("Recipe deleted");
                  }}
                  onLaunch={(i) => setLaunchItem(i)}
                  logs={logsMap[item.id] ?? []}
                  logInput={logInputMap[item.id] ?? ""}
                  logStatus={logStatusMap[item.id] ?? ""}
                  logLoading={logLoading}
                  logQuantity={logQuantityMap[item.id] ?? ""}
                  computedLogCost={costPerUnit * (qty > 0 ? qty : 0)}
                  onLogInputChange={(v) => setLogInputMap((p) => ({ ...p, [item.id]: v }))}
                  onLogStatusChange={(v) => setLogStatusMap((p) => ({ ...p, [item.id]: v }))}
                  onLogQuantityChange={(v) => setLogQuantityMap((p) => ({ ...p, [item.id]: v }))}
                  onAddLog={() => handleAddLog(item)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Launch Confirm Modal ── */}
      {launchItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !launching && setLaunchItem(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <Rocket size={22} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Launch to Food Menu</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Move <strong>&ldquo;{launchItem.name}&rdquo;</strong> from recipe R&D to the live Food Menu?
                </p>
              </div>
            </div>
            {/* Research expense summary */}
            {(() => {
              const logs = logsMap[launchItem.id] ?? [];
              const totalCost = logs.reduce((s, l) => s + (l.trial_cost ?? 0), 0);
              const totalQty = logs.reduce((s, l) => s + (l.quantity ?? 0), 0);
              return logs.length > 0 ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Research Summary</p>
                  <div className="flex justify-between text-xs text-amber-700">
                    <span>{logs.length} log entries · {totalQty} units tested</span>
                    <span className="font-bold">৳{totalCost.toFixed(2)} spent</span>
                  </div>
                  <p className="text-[10px] text-amber-500 mt-1">This history will be accessible from the Food Menu page.</p>
                </div>
              ) : null;
            })()}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLaunchItem(null)}
                disabled={launching}
                className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="h-9 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
                {launching ? "Launching…" : <><Rocket size={14} /> Launch</>}
              </button>
            </div>
          </div>
        </div>
      )}

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

          {/* Sell Price — required */}
          <div>
            <Input label="Target Sell Price (৳) *" type="number" min="0" step="0.01" placeholder="0.00"
              value={form.sell_price} onChange={(e) => setForm((p) => ({ ...p, sell_price: e.target.value }))}
              hint="Required — used to calculate profit margin and track research ROI" />
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
                <div><p className="text-xs text-gray-400">Cost/unit</p><p className="font-semibold text-sm text-gray-700 mt-0.5">৳{ingredientCost.toFixed(2)}</p></div>
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

          {/* Recipe Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Link2 size={14} className="text-gray-400" /> Recipe Links
                <span className="text-xs text-gray-400 font-normal">(YouTube, references)</span>
              </label>
              <Button variant="ghost" size="sm" onClick={() => setForm((p) => ({ ...p, recipe_links: [...p.recipe_links, ""] }))}><Plus size={12} /> Add</Button>
            </div>
            {form.recipe_links.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">No links added yet</div>
            ) : (
              <div className="space-y-2">
                {form.recipe_links.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      {link.includes("youtube") || link.includes("youtu.be") ? (
                        <Youtube size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-500" />
                      ) : (
                        <Link2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      )}
                      <input type="url" placeholder="https://youtube.com/watch?v=..." value={link}
                        onChange={(e) => {
                          const links = [...form.recipe_links];
                          links[idx] = e.target.value;
                          setForm((p) => ({ ...p, recipe_links: links }));
                        }}
                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <button onClick={() => setForm((p) => ({ ...p, recipe_links: p.recipe_links.filter((_, i) => i !== idx) }))}
                      className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
            label={`Status: ${form.is_active ? "Active" : "Inactive"}`} />
        </div>
      </Dialog>
    </div>
  );
}
