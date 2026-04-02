"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { Plus, Trash2, Pencil, FileDown, Check, X, ChevronDown, Loader2, ShoppingBasket } from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  default_unit: string;
  unit_price: number;
  unit_type: string | null;
}

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
  notes: string | null;
  submitter_name?: string | null;
  created_at: string;
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
    submitted: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export default function DailyBazarPage({ params }: { params: Promise<{ rid: string }> }) {
  const { rid } = use(params);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [submitterName, setSubmitterName] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedIngId, setSelectedIngId] = useState("");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editCart, setEditCart] = useState<CartItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);

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
      setRequisitions(reqData.requisitions ?? []);
    } catch {
      setError("Failed to load data");
    }
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedIng = ingredients.find((i) => i.id === selectedIngId);

  useEffect(() => {
    if (selectedIng) {
      setUnitPrice(String(selectedIng.unit_price ?? ""));
    }
  }, [selectedIngId]);

  const addToCart = () => {
    if (!selectedIngId || !qty) return;
    const ing = ingredients.find((i) => i.id === selectedIngId);
    if (!ing) return;
    const existing = cart.findIndex((c) => c.ingredient_id === selectedIngId);
    const item: CartItem = {
      ingredient_id: selectedIngId,
      name: ing.name,
      quantity: parseFloat(qty),
      unit_price: parseFloat(unitPrice) || ing.unit_price,
      unit: ing.default_unit,
    };
    if (existing >= 0) {
      const updated = [...cart];
      updated[existing] = item;
      setCart(updated);
    } else {
      setCart([...cart, item]);
    }
    setSelectedIngId("");
    setQty("");
    setUnitPrice("");
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
          notes,
          items: cart.map((c) => ({ ingredient_id: c.ingredient_id, quantity: c.quantity, unit_price: c.unit_price, unit: c.unit })),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); }
      else {
        setSuccess("Requisition submitted!");
        setSubmitterName("");
        setNotes("");
        setCart([]);
        setTimeout(() => setSuccess(null), 3000);
        fetchData();
      }
    } catch { setError("Network error"); }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this requisition?")) return;
    const res = await fetch(`/api/daily-bazar/${rid}/requisitions/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
    else { const d = await res.json(); setError(d.error ?? "Failed to delete"); }
  };

  const openEdit = (req: Requisition) => {
    setEditId(req.id);
    setEditNotes(req.notes ?? "");
    setEditCart(
      (req.product_requisition_items ?? []).map((item) => ({
        ingredient_id: item.ingredient_id,
        name: item.ingredients?.name ?? item.ingredient_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit: item.unit ?? item.ingredients?.default_unit ?? "",
      }))
    );
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    setEditSaving(true);
    const res = await fetch(`/api/daily-bazar/${rid}/requisitions/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: editNotes,
        items: editCart.map((c) => ({ ingredient_id: c.ingredient_id, quantity: c.quantity, unit_price: c.unit_price, unit: c.unit })),
      }),
    });
    setEditSaving(false);
    if (res.ok) { setEditId(null); fetchData(); }
    else { const d = await res.json(); setError(d.error ?? "Failed to save"); }
  };

  const handlePDF = (req: Requisition) => {
    const lines = (req.product_requisition_items ?? []).map((item) => {
      const name = item.ingredients?.name ?? item.ingredient_id;
      const unit = item.unit ?? item.ingredients?.default_unit ?? "";
      return `${name}: ${item.quantity} ${unit} × ৳${item.unit_price} = ৳${(item.quantity * item.unit_price).toFixed(2)}`;
    });
    const total = (req.product_requisition_items ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const content = [
      `Daily Bazar Requisition`,
      `${restaurant?.name ?? ""}`,
      ``,
      `ID: ${shortId(req.id)}`,
      `Date: ${req.requisition_date}`,
      `Status: ${req.status}`,
      req.submitter_name ? `Submitted by: ${req.submitter_name}` : "",
      req.notes ? `Notes: ${req.notes}` : "",
      ``,
      `Items:`,
      ...lines,
      ``,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
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

  const total = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingBasket size={20} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Daily Bazar</h1>
            <p className="text-xs text-gray-400">{restaurant?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* Success / Error banners */}
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

        {/* New Requisition Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">New Requisition</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Submitter name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Your Name *</label>
              <input
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
              />
            </div>

            {/* Add item */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Add Item</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedIngId}
                    onChange={(e) => setSelectedIngId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 appearance-none bg-white"
                  >
                    <option value="">Select ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="Qty"
                  min="0"
                  step="0.01"
                  className="w-20 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  className="w-24 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
                <button
                  onClick={addToCart}
                  disabled={!selectedIngId || !qty}
                  className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-orange-600 transition-colors shrink-0"
                >
                  <Plus size={18} />
                </button>
              </div>
              {selectedIng && <p className="text-[11px] text-gray-400 mt-1">Unit: {selectedIng.default_unit} · Default price: ৳{selectedIng.unit_price}</p>}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="space-y-2">
                {cart.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.quantity} {item.unit} × ৳{item.unit_price} = ৳{(item.quantity * item.unit_price).toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeFromCart(i)} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-400">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-semibold text-gray-900">Total: ৳{total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions..."
                rows={2}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !cart.length || !submitterName.trim()}
              className="w-full py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : "Submit Requisition"}
            </button>
          </div>
        </div>

        {/* Requisitions list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Requisitions</h2>
            <span className="text-xs text-gray-400">{requisitions.length} total</span>
          </div>

          {requisitions.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingBasket size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No requisitions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {requisitions.map((req) => {
                const isEditing = editId === req.id;
                const reqTotal = (req.product_requisition_items ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
                return (
                  <div key={req.id} className="p-5 space-y-3">
                    {/* Header row */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-gray-700">{shortId(req.id)}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadge(req.status)}`}>
                        {req.status}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{req.requisition_date}</span>
                    </div>
                    {req.submitter_name && (
                      <p className="text-xs text-gray-500">By: {req.submitter_name}</p>
                    )}

                    {isEditing ? (
                      /* Edit mode */
                      <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-600">Editing items</p>
                        {editCart.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-sm flex-1 text-gray-700 truncate">{item.name}</span>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...editCart];
                                updated[i] = { ...item, quantity: parseFloat(e.target.value) || 0 };
                                setEditCart(updated);
                              }}
                              className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                            />
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => {
                                const updated = [...editCart];
                                updated[i] = { ...item, unit_price: parseFloat(e.target.value) || 0 };
                                setEditCart(updated);
                              }}
                              className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                            />
                            <button onClick={() => setEditCart(editCart.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notes"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={editSaving}
                            className="flex-1 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                          >
                            {editSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <>
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
                          <span className="text-sm font-semibold text-gray-800">৳{reqTotal.toFixed(2)}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePDF(req)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              <FileDown size={13} /> PDF
                            </button>
                            {req.status === "submitted" && (
                              <>
                                <button
                                  onClick={() => openEdit(req)}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(req.id)}
                                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
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
