"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import {
  Plus, Trash2, FileDown, Check, X, ChevronDown,
  Loader2, ShoppingBasket, Search, Calendar,
} from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  default_unit: string;
  unit_price: number;
  unit_type: string | null;
}

interface VendorOption  { id: string; name: string }
interface PaymentMethod { id: string; name: string }
interface Category      { id: string; name: string }

interface ReqItem {
  ingredient_id: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  ingredients?: { id: string; name: string; default_unit: string; unit_price: number };
}

interface Requisition {
  id: string;
  status: "submitted" | "approved" | "rejected";
  requisition_date: string;
  payment_status: "paid" | "due";
  notes: string | null;
  submitter_name?: string | null;
  created_at: string;
  vendors?: { id: string; name: string } | null;
  payment_methods?: { id: string; name: string } | null;
  bazar_categories?: { id: string; name: string } | null;
  product_requisition_items: ReqItem[];
}

interface CartItem {
  ingredient_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

function shortId(id: string) {
  return "REQ-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

const TODAY = new Date().toISOString().split("T")[0];

// ─── Item Picker BottomSheet ─────────────────────────────────────────────────

function ItemPickerSheet({
  open, onClose, ingredients, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  onAdd: (item: CartItem) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  const filtered = q.trim()
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    : ingredients;

  const handleAdd = () => {
    if (!selected || !qty) return;
    onAdd({
      ingredient_id: selected.id,
      name: selected.name,
      quantity: parseFloat(qty),
      unit_price: parseFloat(price) || selected.unit_price,
      unit: selected.default_unit,
    });
    setSelected(null);
    setQ("");
    setQty("");
    setPrice("");
    onClose();
  };

  useEffect(() => {
    if (!open) { setQ(""); setSelected(null); setQty(""); setPrice(""); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <p className="font-semibold text-gray-900 text-sm">Add Item</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {selected ? (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-sm text-gray-900">{selected.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Unit: {selected.default_unit} · Default: ৳{selected.unit_price}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-orange-500 font-medium">Change</button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] text-gray-500 mb-1">Quantity *</label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g. 2"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] text-gray-500 mb-1">Unit Price</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={`৳${selected.unit_price}`}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                />
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={!qty}
              className="mt-3 w-full py-2.5 bg-[#111827] text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              Add to Requisition
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ingredients…"
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
              />
            </div>
          </div>
        )}

        {!selected && (
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No ingredients found</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((ing) => (
                  <button
                    key={ing.id}
                    onClick={() => { setSelected(ing); setPrice(String(ing.unit_price ?? "")); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{ing.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ing.default_unit}</p>
                    </div>
                    <span className="text-xs text-gray-500">৳{ing.unit_price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DailyBazarPage({ params }: { params: Promise<{ rid: string }> }) {
  const { rid } = use(params);

  const [restaurant, setRestaurant] = useState<{ id: string; name: string; logo_url?: string | null } | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"new" | "list">("new");

  // New requisition form
  const [submitterName, setSubmitterName]     = useState("");
  const [reqDate, setReqDate]                 = useState(TODAY);
  const [vendorId, setVendorId]               = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [categoryId, setCategoryId]           = useState("");
  const [notes, setNotes]                     = useState("");
  const [paymentStatus, setPaymentStatus]     = useState<"paid" | "due">("due");
  const [cart, setCart]                       = useState<CartItem[]>([]);
  const [itemPickerOpen, setItemPickerOpen]   = useState(false);

  // List tab — defaults to today so staff see today's requisitions immediately
  const [filterDate, setFilterDate] = useState(TODAY);

  const fetchData = useCallback(async () => {
    try {
      const [infoRes, reqRes] = await Promise.all([
        fetch(`/api/daily-bazar/${rid}`),
        fetch(`/api/daily-bazar/${rid}/requisitions`),
      ]);
      if (!infoRes.ok) { setError("Restaurant not found"); setLoading(false); return; }
      const info = await infoRes.json();
      const reqData = await reqRes.json();
      setRestaurant(info.restaurant);
      setIngredients(info.ingredients ?? []);
      setVendors(info.vendors ?? []);
      setPaymentMethods(info.paymentMethods ?? []);
      setCategories(info.categories ?? []);
      setRequisitions(reqData.requisitions ?? []);
    } catch {
      setError("Failed to load data");
    }
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.ingredient_id === item.ingredient_id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = item;
        return updated;
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!submitterName.trim()) { setError("Please enter your name"); return; }
    if (!cart.length) { setError("Add at least one item"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-bazar/${rid}/requisitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitter_name: submitterName,
          notes: notes || null,
          requisition_date: reqDate,
          vendor_id: vendorId || null,
          payment_method_id: paymentMethodId || null,
          bazar_category_id: categoryId || null,
          payment_status: paymentStatus,
          items: cart.map((c) => ({
            ingredient_id: c.ingredient_id,
            quantity: c.quantity,
            unit_price: c.unit_price,
            unit: c.unit,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to submit");
      } else {
        setSuccess("Requisition submitted!");
        setSubmitterName("");
        setReqDate(TODAY);
        setVendorId("");
        setPaymentMethodId("");
        setCategoryId("");
        setNotes("");
        setPaymentStatus("due");
        setCart([]);
        setTimeout(() => setSuccess(null), 3000);
        setActiveTab("list");
        fetchData();
      }
    } catch {
      setError("Network error");
    }
    setSubmitting(false);
  };

  const handlePDF = (req: Requisition) => {
    const lines = (req.product_requisition_items ?? []).map((item) => {
      const name = item.ingredients?.name ?? item.ingredient_id;
      const unit = item.unit ?? item.ingredients?.default_unit ?? "";
      return `${name}: ${item.quantity} ${unit} × ৳${item.unit_price} = ৳${(item.quantity * item.unit_price).toFixed(2)}`;
    });
    const total = (req.product_requisition_items ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const content = [
      "Daily Bazar Requisition",
      restaurant?.name ?? "",
      "",
      `ID: ${shortId(req.id)}`,
      `Date: ${req.requisition_date}`,
      `Status: ${req.status}`,
      req.vendors ? `Vendor: ${req.vendors.name}` : "",
      req.bazar_categories ? `Category: ${req.bazar_categories.name}` : "",
      `Payment: ${req.payment_status === "paid" ? "Paid" : "Due"}`,
      req.submitter_name ? `Submitted by: ${req.submitter_name}` : "",
      req.notes ? `Notes: ${req.notes}` : "",
      "",
      "Items:",
      ...lines,
      "",
      `Total: ৳${total.toFixed(2)}`,
    ].filter(Boolean).join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shortId(req.id)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedRequisitions = filterDate
    ? requisitions.filter((r) => r.requisition_date === filterDate)
    : requisitions;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="animate-spin text-gray-800" size={32} />
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {restaurant?.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-gray-100"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingBasket size={20} className="text-gray-500" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-gray-900">{restaurant?.name ?? "Daily Bazar"}</h1>
            <p className="text-xs text-gray-400">Requisition Portal</p>
          </div>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 sticky top-[61px] z-10">
        <div className="max-w-xl mx-auto flex">
          {([
            { value: "new",  label: "New Requisition" },
            { value: "list", label: "Requisition List" },
          ] as { value: "new" | "list"; label: string }[]).map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === t.value
                  ? "border-[#111827] text-[#111827]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4">

        {success && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-100 rounded-xl px-4 py-3 text-sm">
            <Check size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-xl px-4 py-3 text-sm">
            <X size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* ─── New Requisition ─────────────────────────────────────────────── */}
        {activeTab === "new" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name *</label>
                <input
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                  />
                </div>
              </div>

              {vendors.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor</label>
                  <div className="relative">
                    <select
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 appearance-none bg-white"
                    >
                      <option value="">Select vendor (optional)</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Method</label>
                    <div className="relative">
                      <select
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 appearance-none bg-white"
                      >
                        <option value="">Optional</option>
                        {paymentMethods.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
                {categories.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                    <div className="relative">
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 appearance-none bg-white"
                      >
                        <option value="">Optional</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Status</label>
                <div className="flex gap-2">
                  {([
                    { value: "due",  label: "Due" },
                    { value: "paid", label: "Paid" },
                  ] as { value: "paid" | "due"; label: string }[]).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setPaymentStatus(s.value)}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                        paymentStatus === s.value
                          ? "bg-[#111827] border-[#111827] text-white"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions…"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Items *</label>
                  <button
                    onClick={() => setItemPickerOpen(true)}
                    className="flex items-center gap-1.5 px-3 h-8 bg-[#111827] text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    <Plus size={13} /> Add Item
                  </button>
                </div>

                {cart.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl px-4 py-5 text-center">
                    <p className="text-sm text-gray-400">No items added yet</p>
                    <p className="text-xs text-gray-300 mt-1">Tap "Add Item" to begin</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.quantity} {item.unit} × ৳{item.unit_price} = ৳{(item.quantity * item.unit_price).toFixed(2)}
                          </p>
                        </div>
                        <button onClick={() => removeFromCart(i)} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                      <span className="text-xs text-gray-400">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
                      <span className="text-sm font-bold text-gray-900">৳{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !cart.length || !submitterName.trim()}
                className="w-full py-3.5 bg-[#111827] text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : "Submit Requisition"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Requisition List ────────────────────────────────────────────── */}
        {activeTab === "list" && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <Calendar size={14} className="text-gray-400 shrink-0" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate("")}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  All
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Requisitions</h2>
                <span className="text-xs text-gray-400">
                  {filterDate ? `${displayedRequisitions.length} on ${filterDate}` : `${requisitions.length} total`}
                </span>
              </div>

              {displayedRequisitions.length === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingBasket size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    {filterDate ? "No requisitions on this date" : "No requisitions yet"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {displayedRequisitions.map((req) => {
                    const reqTotal = (req.product_requisition_items ?? []).reduce(
                      (s, i) => s + i.quantity * i.unit_price, 0
                    );
                    return (
                      <div key={req.id} className="p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-gray-700">{shortId(req.id)}</span>
                          {req.status !== "submitted" && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadge(req.status)}`}>
                              {req.status}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            req.payment_status === "paid" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {req.payment_status === "paid" ? "Paid" : "Due"}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">{req.requisition_date}</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
                          {req.submitter_name && <span>By: {req.submitter_name}</span>}
                          {req.vendors?.name && (
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">{req.vendors.name}</span>
                          )}
                          {req.bazar_categories?.name && (
                            <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full">{req.bazar_categories.name}</span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {(req.product_requisition_items ?? []).map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-600">
                              <span className="truncate">{item.ingredients?.name ?? item.ingredient_id}</span>
                              <span className="shrink-0 ml-2 text-gray-400">
                                {item.quantity} {item.unit ?? item.ingredients?.default_unit ?? ""} × ৳{item.unit_price}
                              </span>
                            </div>
                          ))}
                        </div>

                        {req.notes && <p className="text-xs text-gray-400 italic">{req.notes}</p>}

                        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                          <span className="text-sm font-bold text-gray-900">৳{reqTotal.toFixed(2)}</span>
                          <button
                            onClick={() => handlePDF(req)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <FileDown size={13} /> PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ItemPickerSheet
        open={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        ingredients={ingredients}
        onAdd={addToCart}
      />
    </div>
  );
}
