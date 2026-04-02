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
  Search,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ReceiptText,
  Users,
  LayoutGrid,
  User,
  Utensils,
  MoreVertical,
  Trash2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function today() { return localYmd(new Date()); }
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return localYmd(d);
}

// ─── localStorage soft-delete helpers ─────────────────────────────────────────
function lsKey(restaurantId: string) { return `deleted_orders_${restaurantId}`; }

function getDeletedIds(restaurantId: string): Set<string> {
  try {
    const raw = localStorage.getItem(lsKey(restaurantId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function addDeletedId(restaurantId: string, id: string): Set<string> {
  const ids = getDeletedIds(restaurantId);
  ids.add(id);
  localStorage.setItem(lsKey(restaurantId), JSON.stringify([...ids]));
  return ids;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: "Active",    color: "bg-blue-50 text-blue-700",    icon: Clock },
  billed:    { label: "Billed",    color: "bg-yellow-50 text-yellow-700", icon: ReceiptText },
  completed: { label: "Completed", color: "bg-green-50 text-green-700",   icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-500",       icon: XCircle },
  deleted:   { label: "Deleted",   color: "bg-gray-100 text-gray-400",    icon: Trash2 },
};

// ─── Order Row ────────────────────────────────────────────────────────────────
type OrderAction = "complete" | "cancel";

interface OrderRowProps {
  order: Order;
  isDeleted: boolean;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

function OrderRow({ order, isDeleted, onComplete, onCancel, onDelete }: OrderRowProps) {
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

  const displayStatus = isDeleted ? "deleted" : order.status;
  const cfg = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.active;
  const StatusIcon = cfg.icon;
  // Deduplicate: keep first row per food_item_id (duplicates come from sync race conditions, not intentional qty)
  const rawItems = order.order_items ?? [];
  const seenIds = new Set<string>();
  const items = rawItems.filter((item) => {
    if (seenIds.has(item.food_item_id)) return false;
    seenIds.add(item.food_item_id);
    return true;
  });
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const isCancelled = order.status === "cancelled";
  const canDelete = !isCancelled && !isDeleted;
  const isRemote = (order as any).source === "remote_staff";

  // For active orders the stored total may be 0 until billing — calculate from items instead
  const itemsTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const displayTotal = order.total > 0 ? order.total : order.subtotal > 0 ? order.subtotal : itemsTotal;

  // Staff name stored in notes as "Staff: Name\n..." (for both remote and PC orders)
  const notesStaffName = order.notes?.startsWith("Staff: ")
    ? order.notes.slice(7).split("\n")[0]
    : null;
  const staffName = notesStaffName;

  // Elapsed time for active orders
  const elapsedMins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const elapsedLabel = elapsedMins < 60
    ? `${elapsedMins}m`
    : `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`;

  async function handleAction(action: OrderAction) {
    setLoading(true);
    if (action === "complete") await onComplete(order.id);
    else await onCancel(order.id);
    setLoading(false);
    setConfirmAction(null);
  }

  return (
    <div className={`border rounded-xl ${isDeleted ? "border-gray-100 opacity-60" : "border-gray-100"}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left cursor-pointer ${expanded ? "rounded-t-xl" : "rounded-xl"}`}
      >
        {expanded
          ? <ChevronDown size={15} className="text-gray-400 shrink-0" />
          : <ChevronRight size={15} className="text-gray-400 shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
            {((order as any).source === "customer" || (() => { try { return JSON.parse(localStorage.getItem("qr_order_ids") ?? "[]").includes(order.id); } catch { return false; } })()) && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                📱 QR
              </span>
            )}
            {isRemote && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                📲 Remote
              </span>
            )}
            {order.status === "active" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                <Clock size={9} /> {elapsedLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {order.tables && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <LayoutGrid size={10} /> Table {(order.tables as any).table_number ?? ""}
              </span>
            )}
            {order.customers && (
              <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                <Users size={10} /> {order.customers.name}
              </span>
            )}
            {staffName && (
              <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                <User size={10} /> {staffName}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleString("en-GB", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{fmt(displayTotal)}</p>
          <p className="text-xs text-gray-400">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
        </div>

        {!isDeleted && (
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
                  disabled={order.status === "completed" || isCancelled}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle2 size={13} className="text-green-500" /> Complete
                </button>
                <button
                  onClick={() => { setShowActionMenu(false); setConfirmAction("cancel"); }}
                  disabled={order.status === "completed" || isCancelled}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle size={13} className="text-red-400" /> Cancel
                </button>
                {canDelete && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => { setShowActionMenu(false); onDelete(order.id); }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl">
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

          {(order.vat_amount > 0 || order.service_charge > 0 || order.discount_amount > 0) && (
            <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-red-600">
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

          {order.payment_methods && (
            <div className="px-4 pb-3 text-xs text-gray-500">
              Payment: <span className="font-medium text-gray-700">{order.payment_methods.name}</span>
            </div>
          )}

          {order.status === "active" && !isDeleted && !isRemote && (
            <div className="px-4 pb-3">
              <p className="text-xs text-blue-500 bg-blue-50 rounded-lg px-3 py-2">
                Manage this order from the <strong>New Order</strong> page.
              </p>
            </div>
          )}
          {order.status === "billed" && !isDeleted && !isRemote && (
            <div className="px-4 pb-3">
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Complete this order from the <strong>New Order</strong> page.
              </p>
            </div>
          )}
          {isRemote && !isDeleted && (order.status === "active" || order.status === "billed") && (
            <div className="px-4 pb-3">
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                📲 This order was taken via <strong>Remote Order</strong> on mobile.
                {staffName && <> Staff: <strong>{staffName}</strong>.</>}
              </p>
            </div>
          )}
        </div>
      )}

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

const STATUS_OPTIONS = [
  { value: "all",       label: "All Orders" },
  { value: "active",    label: "Active" },
  { value: "billed",    label: "Billed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "deleted",   label: "Deleted" },
];

type PageView = "orders" | "time-logs";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function diffMins(a: string, b: string): number | null {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (ms <= 0) return null;
  return Math.max(1, Math.round(ms / 60000));
}

function fmtDur(mins: number) {
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-blue-50 text-blue-600" },
  billed:    { label: "Billed",    cls: "bg-yellow-50 text-yellow-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-500" },
  completed: { label: "Completed", cls: "bg-green-50 text-green-700" },
};

function TimeLogCard({ order, fallbackStaffName }: { order: Order; fallbackStaffName?: string }) {
  const started = order.created_at;
  const isCompleted = order.status === "completed";
  const isBilled = order.status === "billed";
  const closed = isCompleted ? order.updated_at : null;
  const durationMins = closed ? diffMins(started, closed) : null;

  const isQrOrder =
    (order as any).source === "customer" ||
    (() => { try { return JSON.parse(localStorage.getItem("qr_order_ids") ?? "[]").includes(order.id); } catch { return false; } })();
  const isRemoteOrder = (order as any).source === "remote_staff";

  // Kitchen start time:
  // - Remote orders: created_at (kitchen is sent the moment the order is created on mobile)
  // - PC/QR orders: first entry from localStorage kitchen_prints, then confirmed_at DB field
  const kitchenPrints: string[] = (() => {
    try {
      const raw = localStorage.getItem(`kitchen_prints_${order.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  })();
  const kitchenAt = isRemoteOrder
    ? order.created_at
    : (kitchenPrints[0] ?? (order as any).confirmed_at ?? null);

  // Billed time from localStorage (PC orders only — remote orders skip billed state)
  const billedAtStored: string | null = isRemoteOrder ? null : (() => {
    try { return localStorage.getItem(`billed_${order.id}`) ?? null; } catch { return null; }
  })();

  // Kitchen duration vs prep time target
  const closeOrBillTime = closed ?? billedAtStored;
  const actualKitchenMins = kitchenAt && closeOrBillTime ? diffMins(kitchenAt, closeOrBillTime) : null;
  const targetPrepMins: number | null = (order as any).prep_time_minutes ?? null;

  // Format kitchen duration display: "18m" if early, "20/25m" if over target
  function kitchenDurationLabel() {
    if (actualKitchenMins == null) return null;
    if (targetPrepMins && actualKitchenMins > targetPrepMins) {
      return `${targetPrepMins}/${actualKitchenMins}m`;
    }
    return `${actualKitchenMins}m`;
  }
  const kitchenLabel = kitchenDurationLabel();
  const guestName = order.customers?.name;
  const statusChip = STATUS_CHIP[order.status] ?? STATUS_CHIP.active;
  const fmt = (n: number) => "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Staff name: stored in notes as "Staff: Name\n..." for both remote and PC orders.
  // Fallback to current logged-in user only for PC orders — never for remote/QR orders.
  const staffName = order.notes?.startsWith("Staff: ")
    ? order.notes.slice(7).split("\n")[0]
    : (!isRemoteOrder && !isQrOrder) ? (fallbackStaffName ?? null) : null;

  // Display total: for active orders total may be 0, fall back to items sum
  const itemsSum = (order.order_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const displayTotal = order.total > 0 ? order.total : order.subtotal > 0 ? order.subtotal : itemsSum;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-gray-900">{order.order_number}</p>
            {isQrOrder ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                📱 QR Order
              </span>
            ) : isRemoteOrder ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                📲 {staffName ?? "Remote"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
                🧑‍🍳 {staffName ?? "Staff"}
              </span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${statusChip.cls}`}>
              {statusChip.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-400">{fmtDate(order.created_at)}</p>
            {order.tables && (
              <p className="text-xs text-gray-400">· Table {(order.tables as any).table_number}</p>
            )}
            {guestName && (
              <p className="text-xs text-gray-500 font-medium">· 👤 {guestName}</p>
            )}
          </div>
        </div>
        <p className="text-sm font-bold text-gray-900 shrink-0">{fmt(displayTotal)}</p>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-0">
        {isRemoteOrder ? (
          <>
            {/* Step 1: Order Started = created_at */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex flex-col items-center shrink-0">
                <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm">🕐</span>
                <div className="w-px h-4 bg-gray-200 mt-0.5" />
              </div>
              <div className="pb-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Order Started</p>
                <p className="text-gray-800 font-semibold">{fmtTime(started)}</p>
              </div>
            </div>

            {/* Step 2: Kitchen Start = created_at (same moment — remote orders are created on kitchen press) */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex flex-col items-center shrink-0">
                <span className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-sm">🍳</span>
                <div className="w-px h-4 bg-gray-200 mt-0.5" />
              </div>
              <div className="pb-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Kitchen Start</p>
                <p className="text-gray-800 font-semibold">{fmtTime(started)}</p>
              </div>
              {kitchenLabel != null && closed && (
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  targetPrepMins && actualKitchenMins && actualKitchenMins > targetPrepMins
                    ? "bg-red-50 text-red-600"
                    : "bg-orange-50 text-orange-700"
                }`}>
                  {kitchenLabel} in kitchen
                </span>
              )}
            </div>

            {/* Step 3: Order Completed = updated_at */}
            <div className="flex items-center gap-3 text-xs">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                isCompleted ? "bg-green-100" : order.status === "cancelled" ? "bg-red-50" : "bg-blue-50"
              }`}>
                {isCompleted ? "✅" : order.status === "cancelled" ? "❌" : "⏳"}
              </span>
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                  {isCompleted ? "Order Completed" : order.status === "cancelled" ? "Cancelled" : "In Progress"}
                </p>
                {closed ? (
                  <p className="text-gray-800 font-semibold">{fmtTime(closed)}</p>
                ) : (
                  <p className="text-gray-400 italic text-[11px]">Not yet closed</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* PC / QR orders: separate Order Started → Kitchen → Billed → Completed steps */}
            {/* Step 1: Order Started */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex flex-col items-center shrink-0">
                <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm">🕐</span>
                <div className="w-px h-4 bg-gray-200 mt-0.5" />
              </div>
              <div className="pb-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Order Started</p>
                <p className="text-gray-800 font-semibold">{fmtTime(started)}</p>
              </div>
            </div>

            {/* Step 2: Kitchen Start */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex flex-col items-center shrink-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${kitchenAt ? "bg-orange-100" : "bg-gray-50 border border-dashed border-gray-200"}`}>
                  🍳
                </span>
                <div className="w-px h-4 bg-gray-200 mt-0.5" />
              </div>
              <div className="pb-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Kitchen Start</p>
                {kitchenAt ? (
                  <p className="text-gray-800 font-semibold">{fmtTime(kitchenAt)}</p>
                ) : (
                  <p className="text-gray-300 font-medium">—</p>
                )}
              </div>
              {kitchenAt && kitchenLabel != null && (
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  targetPrepMins && actualKitchenMins && actualKitchenMins > targetPrepMins
                    ? "bg-red-50 text-red-600"
                    : "bg-orange-50 text-orange-700"
                }`}>
                  {kitchenLabel} in kitchen
                </span>
              )}
            </div>

            {/* Step 3: Bill Printed (localStorage, PC only) */}
            {billedAtStored && !isCompleted && (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">🧾</span>
                  <div className="w-px h-4 bg-gray-200 mt-0.5" />
                </div>
                <div className="pb-2">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Bill Printed</p>
                  <p className="text-gray-800 font-semibold">{fmtTime(billedAtStored)}</p>
                </div>
              </div>
            )}

            {/* Step 4: Completed / Status */}
            <div className="flex items-center gap-3 text-xs">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                isCompleted ? "bg-green-100" : order.status === "billed" ? "bg-amber-50" : "bg-blue-50"
              }`}>
                {isCompleted ? "✅" : order.status === "billed" ? "🧾" : order.status === "cancelled" ? "❌" : "⏳"}
              </span>
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                  {isCompleted ? "Order Completed" : order.status === "billed" ? "Awaiting Payment" : order.status === "cancelled" ? "Cancelled" : "In Progress"}
                </p>
                {closed ? (
                  <p className="text-gray-800 font-semibold">{fmtTime(closed)}</p>
                ) : (
                  <p className="text-gray-400 italic text-[11px]">Not yet closed</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Duration footer */}
      {durationMins != null ? (
        <div className="bg-green-50 rounded-xl px-3 py-2 flex justify-between text-xs border border-green-100">
          <span className="text-green-700 font-medium">Total duration</span>
          <span className="text-green-800 font-bold">{fmtDur(durationMins)}</span>
        </div>
      ) : (
        <div className="bg-blue-50 rounded-xl px-3 py-2 flex justify-between text-xs border border-blue-100">
          <span className="text-blue-600 font-medium">Elapsed since open</span>
          <span className="text-blue-700 font-bold">
            {(() => {
              const m = Math.round((Date.now() - new Date(started).getTime()) / 60000);
              return fmtDur(Math.max(1, m));
            })()}
          </span>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailsPage() {
  const { activeRestaurant } = useRestaurant();
  const [view, setView] = useState<PageView>("orders");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [search, setSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [fallbackStaffName, setFallbackStaffName] = useState<string>("");

  // Load deleted IDs from localStorage when restaurant changes
  useEffect(() => {
    if (activeRestaurant?.id) {
      setDeletedIds(getDeletedIds(activeRestaurant.id));
    }
  }, [activeRestaurant?.id]);

  // Detect current auth user name for staff badge fallback
  useEffect(() => {
    const supabase = createClient();
    // Check localStorage first (set by the New Order page staff selector)
    const lsKey = activeRestaurant?.id ? `staff_name_${activeRestaurant.id}` : null;
    if (lsKey) {
      const saved = localStorage.getItem(lsKey);
      if (saved) { setFallbackStaffName(saved); return; }
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "";
      if (name) setFallbackStaffName(name);
    });
  }, [activeRestaurant?.id]);

  function applyPreset(p: DatePreset) {
    setDatePreset(p);
    if (p === "today") { setDateFrom(today()); setDateTo(today()); }
    else if (p === "week") { setDateFrom(weekStart()); setDateTo(today()); }
    else if (p === "month") {
      const d = new Date();
      setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
      setDateTo(today());
    } else if (p === "all_time") { setDateFrom(""); setDateTo(""); }
  }

  // When showing "deleted", fetch all statuses so we can filter client-side
  const hookStatusFilter = statusFilter === "deleted" ? "all" : statusFilter;

  // Only apply date filter when viewing "all" or "deleted" — specific status views
  // (cancelled, completed, etc.) should show all matching orders regardless of date
  const applyDateFilter = statusFilter === "all" || statusFilter === "deleted";

  const { orders, loading, completeOrder, cancelOrder } = useOrders(
    activeRestaurant?.id,
    hookStatusFilter,
    applyDateFilter ? (dateFrom || undefined) : undefined,
    applyDateFilter ? (dateTo || undefined) : undefined
  );

  // Client-side filtering: deleted view shows only deleted IDs; others exclude them
  const filteredOrders = useMemo(() => {
    let result = orders;

    if (statusFilter === "deleted") {
      result = result.filter((o) => deletedIds.has(o.id));
    } else {
      result = result.filter((o) => !deletedIds.has(o.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customers?.name.toLowerCase().includes(q) ||
          (o.tables as any)?.table_number?.toString().includes(q)
      );
    }

    return result;
  }, [orders, statusFilter, deletedIds, search]);

  // Summary stats — exclude deleted orders
  const stats = useMemo(() => {
    const nonDeleted = orders.filter((o) => !deletedIds.has(o.id));
    return {
      active:    nonDeleted.filter((o) => o.status === "active").length,
      billed:    nonDeleted.filter((o) => o.status === "billed").length,
      completed: nonDeleted.filter((o) => o.status === "completed").length,
      cancelled: nonDeleted.filter((o) => o.status === "cancelled").length,
      revenue:   nonDeleted
        .filter((o) => o.status === "completed" || o.status === "billed")
        .reduce((s, o) => s + (o.total || o.subtotal), 0),
      deleted:   deletedIds.size,
    };
  }, [orders, deletedIds]);

  function handleDelete(id: string) {
    if (!activeRestaurant?.id) return;
    const updated = addDeletedId(activeRestaurant.id, id);
    setDeletedIds(new Set(updated));
  }

  return (
    <>
      <Header title="Order Details" />

      <div className="p-4 md:p-6 space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["orders", "time-logs"] as PageView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all ${
                view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v === "orders" ? "Orders" : "Time Logs"}
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="shrink-0 flex flex-wrap items-center px-4 md:px-6 gap-3 md:gap-4 py-2.5 md:h-[62px] md:py-0 bg-white border border-border rounded-xl">
          {/* Date preset pills */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(["today", "week", "month", "all_time", "custom"] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  datePreset === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : p === "all_time" ? "All Time" : "Custom"}
              </button>
            ))}
          </div>

          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          {/* Status dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 pl-3 pr-8 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, customer…"
              className="w-52 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-[18px]">
          {[
            { label: "Active",    value: stats.active,       color: "text-blue-600" },
            { label: "Billed",    value: stats.billed,       color: "text-yellow-600" },
            { label: "Completed", value: stats.completed,    color: "text-green-600" },
            { label: "Cancelled", value: stats.cancelled,    color: "text-red-500" },
            { label: "Revenue",   value: fmt(stats.revenue), color: "text-orange-600" },
            { label: "Deleted",   value: stats.deleted,      color: "text-gray-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Time Logs view ── */}
        {view === "time-logs" && (
          loading ? (
            <div className="text-center text-sm text-gray-400 py-10">Loading…</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-10">No orders found for the selected filters.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredOrders.map((order) => (
                <TimeLogCard key={order.id} order={order} fallbackStaffName={fallbackStaffName || undefined} />
              ))}
            </div>
          )
        )}

        {/* ── Orders table ── */}
        {view === "orders" && (loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Loading orders…</div>
        ) : !activeRestaurant ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
            Select a restaurant to view orders.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <p className="text-sm text-gray-700">Orders</p>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-medium">
                {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Utensils size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">No orders found</p>
                <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or status filter.</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filteredOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    isDeleted={deletedIds.has(order.id)}
                    onComplete={completeOrder}
                    onCancel={cancelOrder}
                    onDelete={(id) => setDeleteConfirmId(id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-lg text-center">Delete Order?</h3>
            <p className="text-sm text-gray-500 text-center">
              The order will be hidden from regular views. You can still find it by filtering by "Deleted".
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Keep
              </button>
              <button
                onClick={() => {
                  const id = deleteConfirmId!;
                  setDeleteConfirmId(null);
                  handleDelete(id);
                }}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
