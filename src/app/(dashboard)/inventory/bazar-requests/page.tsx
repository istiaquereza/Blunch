"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useProductRequisitions, shortReqId } from "@/hooks/use-product-requisitions";
import { useIngredients } from "@/hooks/use-ingredients";
import { useInventoryGroups } from "@/hooks/use-inventory-groups";
import {
  ShoppingCart, Plus, Trash2, ChevronDown, ChevronUp,
  Check, X, Eye, Search, AlertCircle, Edit2, Printer,
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

export default function BazarRequestsPage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const rid = activeRestaurant?.id;

  // Use active restaurant for fetching, but allow override in create
  const { requisitions, loading, create, updateRequisition, approve, reject, remove } = useProductRequisitions(rid);
  const { ingredients } = useIngredients(rid);
  const { groups } = useInventoryGroups(rid);

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
  const [reqPaymentStatus, setReqPaymentStatus] = useState<"paid" | "due">("paid");
  const [reqItems, setReqItems] = useState<ReqItemRow[]>([{ ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]);
  const [saving, setSaving] = useState(false);

  // View dialog
  const [viewReq, setViewReq] = useState<ProductRequisition | null>(null);

  // Approve/Reject confirm
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [actioning, setActioning] = useState(false);

  const filtered = useMemo(() => {
    const range = getDateRange(datePreset, customFrom, customTo);
    return requisitions.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          format(new Date(r.requisition_date), "dd MMM yyyy").toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q) ||
          shortReqId(r.id).toLowerCase().includes(q);
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

  // ── Open dialogs ─────────────────────────────────────────
  const openCreate = () => {
    setEditingReq(null);
    setReqRestaurantId(rid ?? "");
    setReqDate(format(new Date(), "yyyy-MM-dd"));
    setReqNotes("");
    setReqPaymentStatus("paid");
    setReqItems([{ ingredient_id: "", quantity: "1", unit: "", unit_price: "0" }]);
    setFormOpen(true);
  };

  const openEdit = (req: ProductRequisition) => {
    setEditingReq(req);
    setReqRestaurantId(req.restaurant_id);
    setReqDate(req.requisition_date);
    setReqNotes(req.notes ?? "");
    setReqPaymentStatus(req.payment_status ?? "paid");
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
    setSaving(true);

    const itemPayload = validItems.map((i) => ({
      ingredient_id: i.ingredient_id,
      quantity: parseFloat(i.quantity),
      unit: i.unit,
      unit_price: parseFloat(i.unit_price) || 0,
      total_price: itemTotal(i),
    }));

    if (editingReq) {
      const { error } = await updateRequisition(editingReq.id, reqDate, reqNotes, itemPayload, reqPaymentStatus);
      if (error) toast.error((error as Error).message);
      else { toast.success("Requisition updated!"); setFormOpen(false); }
    } else {
      const { error } = await create(reqDate, reqNotes, itemPayload, reqRestaurantId || undefined, reqPaymentStatus);
      if (error) toast.error((error as Error).message);
      else { toast.success("Requisition submitted!"); setFormOpen(false); }
    }
    setSaving(false);
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    setActioning(true);
    const fn = confirmAction.action === "approve" ? approve : reject;
    const { error } = await fn(confirmAction.id);
    if (error) toast.error((error as Error).message);
    else toast.success(confirmAction.action === "approve" ? "Approved! Stock updated." : "Requisition rejected.");
    setConfirmAction(null);
    setActioning(false);
  };

  if (!rid) return (
    <div><Header title="Bazar Requests" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border p-12 text-center">
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
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {/* Status */}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Status</option>
              <option value="submitted">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Date preset */}
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Custom date pickers — only shown when preset = custom */}
            {datePreset === "custom" && (
              <>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </>
            )}

            <div className="flex-1" />
            <Button size="sm" onClick={openCreate}><Plus size={14} /> New Requisition</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Requests", value: requisitions.length, sub: "all time" },
            { label: "Pending Review", value: pendingCount, sub: pendingCount > 0 ? "needs action" : "all clear", highlight: pendingCount > 0 },
            { label: "Approved This Month", value: requisitions.filter((r) => r.status === "approved" && new Date(r.requisition_date).getMonth() === new Date().getMonth()).length, sub: "this month" },
            { label: "Total Approved Value", value: `৳${totalApprovedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "all time" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.highlight ? "text-amber-600" : "text-gray-900"}`}>{c.value}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Requisition List */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-gray-900 text-sm">Requisitions <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
          </div>
          {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{filterStatus || search ? "No results found" : "No requisitions yet"}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((req) => {
                  const reqTotal = req.product_requisition_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
                  const itemCount = req.product_requisition_items?.length ?? 0;
                  const isExpanded = expandedId === req.id;
                  const restName = restaurants.find((r) => r.id === req.restaurant_id)?.name;

                  return (
                    <div key={req.id}>
                      <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                        <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {shortReqId(req.id)}
                            </span>
                            <span className="font-medium text-gray-900 text-sm">
                              {format(new Date(req.requisition_date), "dd MMM yyyy")}
                            </span>
                            <Badge variant={statusBadge(req.status)}>{statusLabel[req.status]}</Badge>
                            {req.payment_status === "due" && (
                              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Due</span>
                            )}
                            {req.payment_status === "paid" && req.status === "approved" && (
                              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Paid</span>
                            )}
                            {restName && (
                              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full">{restName}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {itemCount} item{itemCount !== 1 ? "s" : ""} · Total: <strong className="text-gray-700">৳{reqTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                            {req.notes && ` · ${req.notes}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* PDF print */}
                          <button onClick={() => printRequisition(req, restName)} title="Print / Download PDF"
                            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 flex items-center justify-center transition-colors">
                            <Printer size={12} />
                          </button>
                          {/* View details */}
                          <button onClick={() => setViewReq(req)} title="View details"
                            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors">
                            <Eye size={12} />
                          </button>
                          {/* Edit (submitted only) */}
                          {req.status === "submitted" && (
                            <button onClick={() => openEdit(req)} title="Edit requisition"
                              className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 flex items-center justify-center transition-colors">
                              <Edit2 size={12} />
                            </button>
                          )}
                          {/* Approve / Reject */}
                          {req.status === "submitted" && (
                            <>
                              <Button size="sm" onClick={() => setConfirmAction({ id: req.id, action: "approve" })}
                                className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs h-7 px-3">
                                <Check size={12} /> Approve
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => setConfirmAction({ id: req.id, action: "reject" })}
                                className="text-xs h-7 px-3">
                                <X size={12} /> Reject
                              </Button>
                            </>
                          )}
                          {/* Delete (submitted only) */}
                          {req.status === "submitted" && (
                            <button onClick={() => { if (confirm("Delete this requisition?")) remove(req.id); }}
                              className="w-7 h-7 rounded-lg border border-gray-200 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Items */}
                      {isExpanded && req.product_requisition_items && (
                        <div className="px-14 pb-4 bg-gray-50/50">
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
            <Button onClick={handleSave} loading={saving}>
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
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Select restaurant</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <Input label="Requisition Date" type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} />
          </div>
          <Input label="Notes (optional)" placeholder="e.g. Weekly market run" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} />

          {/* Payment Status Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Status</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
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
            {reqPaymentStatus === "due" && (
              <p className="text-xs text-amber-600 mt-1.5">This will appear as an outstanding expense in Income &amp; Expenses.</p>
            )}
          </div>

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
                          className="w-full h-8 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500">
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
            <div className="grid grid-cols-4 gap-3 text-sm">
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
        </Dialog>
      )}

      {/* ── Approve/Reject Confirm Dialog ── */}
      {confirmAction && (
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}
          title={confirmAction.action === "approve" ? "Approve Requisition?" : "Reject Requisition?"}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
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
        </Dialog>
      )}
    </div>
  );
}
