"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useOrders, type Order } from "@/hooks/use-orders";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronRight,
  ChevronDown,
  Calendar,
  Filter,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ReceiptText,
  Users,
  LayoutGrid,
  Utensils,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function today() { return localYmd(new Date()); }
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return localYmd(d);
}

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-blue-50 text-blue-700", icon: Clock },
  billed: { label: "Billed", color: "bg-yellow-50 text-yellow-700", icon: ReceiptText },
  completed: { label: "Completed", color: "bg-green-50 text-green-700", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-500", icon: XCircle },
};

// ─── Order Row ────────────────────────────────────────────────────────────────
type OrderAction = "complete" | "cancel";

interface OrderRowProps {
  order: Order;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

function OrderRow({ order, onComplete, onCancel, onDelete }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<OrderAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const cfg = STATUS_CONFIG[order.status];
  const StatusIcon = cfg.icon;
  const items = order.order_items ?? [];
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  async function handleAction(action: OrderAction) {
    setLoading(true);
    if (action === "complete") await onComplete(order.id);
    else await onCancel(order.id);
    setLoading(false);
    setConfirmAction(null);
  }

  return (
    <div className="border border-gray-100 rounded-xl">
      {/* Header row — div instead of button so we can nest the action-menu button inside */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left cursor-pointer ${expanded ? "rounded-t-xl" : "rounded-xl"}`}
      >
        {expanded ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{order.order_number}</span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
              <StatusIcon size={10} />
              {cfg.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              order.type === "dine_in" ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"
            }`}>
              {order.type === "dine_in" ? "Dine In" : "Takeaway"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {order.tables && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <LayoutGrid size={10} /> Table {(order.tables as any).table_number ?? ""}
              </span>
            )}
            {order.customers && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users size={10} /> {order.customers.name}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleString("en-GB", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{fmt(order.total || order.subtotal)}</p>
          <p className="text-xs text-gray-400">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
        </div>

        <div className="relative shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowActionMenu(v => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <MoreVertical size={14} />
          </button>
          {showActionMenu && (
            <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36">
              <button
                onClick={() => { setShowActionMenu(false); setConfirmAction("complete"); }}
                disabled={order.status === "completed" || order.status === "cancelled"}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 size={13} className="text-green-500" /> Complete
              </button>
              <button
                onClick={() => { setShowActionMenu(false); setConfirmAction("cancel"); }}
                disabled={order.status === "completed" || order.status === "cancelled"}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle size={13} className="text-red-400" /> Cancel
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { setShowActionMenu(false); onDelete(order.id); }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl">
          {/* Items table */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Order Items</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left pb-1">Item</th>
                  <th className="text-center pb-1">Qty</th>
                  <th className="text-right pb-1">Price</th>
                  <th className="text-right pb-1">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 text-gray-700">{item.food_items?.name ?? "Unknown"}</td>
                    <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-1.5 text-right text-gray-600">{fmt(item.unit_price)}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{fmt(item.unit_price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Billing breakdown */}
          {(order.vat_amount > 0 || order.service_charge > 0 || order.discount_amount > 0) && (
            <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span>-{fmt(order.discount_amount)}</span>
                </div>
              )}
              {order.vat_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>VAT</span><span>{fmt(order.vat_amount)}</span>
                </div>
              )}
              {order.service_charge > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Service Charge</span><span>{fmt(order.service_charge)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-200 pt-1">
                <span>Total</span><span>{fmt(order.total)}</span>
              </div>
            </div>
          )}

          {/* Payment info */}
          {order.payment_methods && (
            <div className="px-4 pb-3 text-xs text-gray-500">
              Payment: <span className="font-medium text-gray-700">{order.payment_methods.name}</span>
            </div>
          )}

          {/* Actions — only for completed/cancelled status (active & billed managed from New Order page) */}
          {order.status === "active" && (
            <div className="px-4 pb-3">
              <p className="text-xs text-blue-500 bg-blue-50 rounded-lg px-3 py-2">
                Manage this order from the <strong>New Order</strong> page.
              </p>
            </div>
          )}
          {order.status === "billed" && (
            <div className="px-4 pb-3">
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Complete this order from the <strong>New Order</strong> page.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={confirmAction === "complete" ? "Mark as Completed?" : "Cancel Order?"}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmAction === "complete"
              ? `Mark order ${order.order_number} as completed? This means the customer has paid and left.`
              : `Cancel order ${order.order_number}? This action cannot be undone.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction === "cancel" ? "danger" : "primary"}
              loading={loading}
              onClick={() => confirmAction && handleAction(confirmAction)}
            >
              {confirmAction === "complete" ? "Mark Completed" : "Cancel Order"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type DatePreset = "today" | "week" | "month" | "all_time" | "custom";

export default function OrderDetailsPage() {
  const { activeRestaurant } = useRestaurant();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(weekStart());
  const [dateTo, setDateTo] = useState(today());
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function applyPreset(p: DatePreset) {
    setDatePreset(p);
    if (p === "today") { setDateFrom(today()); setDateTo(today()); }
    else if (p === "week") { setDateFrom(weekStart()); setDateTo(today()); }
    else if (p === "month") {
      const d = new Date();
      setDateFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`);
      setDateTo(today());
    }
    else if (p === "all_time") { setDateFrom(""); setDateTo(""); }
    // custom: don't change dates, let user pick
  }

  const { orders, loading, completeOrder, cancelOrder, refresh } = useOrders(
    activeRestaurant?.id,
    statusFilter,
    dateFrom || undefined,
    dateTo || undefined
  );

  const handleDeleteOrder = async (id: string) => {
    const supabase = createClient();
    await supabase.from("order_items").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);
    refresh?.();
  };

  // Summary stats
  const stats = useMemo(() => ({
    active: orders.filter((o) => o.status === "active").length,
    billed: orders.filter((o) => o.status === "billed").length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    revenue: orders
      .filter((o) => o.status === "completed" || o.status === "billed")
      .reduce((s, o) => s + (o.total || o.subtotal), 0),
  }), [orders]);

  return (
    <>
      <Header title="Order Details" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Active", value: stats.active, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Billed", value: stats.billed, color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Completed", value: stats.completed, color: "text-green-600", bg: "bg-green-50" },
            { label: "Cancelled", value: stats.cancelled, color: "text-red-500", bg: "bg-red-50" },
            { label: "Revenue", value: fmt(stats.revenue), color: "text-orange-600", bg: "bg-orange-50", wide: true },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`bg-white rounded-xl border border-gray-100 p-3`}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
            {(["today", "week", "month", "all_time", "custom"] as DatePreset[]).map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  datePreset === p ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : p === "all_time" ? "All Time" : "Custom"}
              </button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-1.5">
              <Calendar size={13} className="text-gray-400" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm border-none outline-none bg-transparent" />
              <span className="text-gray-300">→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm border-none outline-none bg-transparent" />
            </div>
          )}

          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {(["all", "active", "billed", "completed", "cancelled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  statusFilter === s ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-400 ml-auto">{orders.length} orders</span>
        </div>

        {/* Order list */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Loading orders…</div>
        ) : !activeRestaurant ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
            Select a restaurant to view orders.
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Utensils size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No orders found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or status filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onComplete={completeOrder}
                onCancel={cancelOrder}
                onDelete={id => setDeleteConfirmId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg text-center">Delete Order?</h3>
            <p className="text-sm text-gray-500 text-center">This will permanently remove the order and all its items. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Keep</button>
              <button
                onClick={async () => { const id = deleteConfirmId; setDeleteConfirmId(null); await handleDeleteOrder(id); }}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
