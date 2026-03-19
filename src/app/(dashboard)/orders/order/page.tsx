"use client";

import { useState, useMemo, useCallback, useEffect, useRef, useId } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useFoodItems } from "@/hooks/use-food-items";
import { useFoodCategories } from "@/hooks/use-food-categories";
import { useTables } from "@/hooks/use-tables";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useBillingSettings, useDiscounts } from "@/hooks/use-billing-settings";
import { useOrders, type CreateOrderItemPayload } from "@/hooks/use-orders";
import { useCustomers, type Customer } from "@/hooks/use-customers";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { FoodItem } from "@/types";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Search,
  X,
  Printer,
  ReceiptText,
  CheckCircle,
  User,
  Phone,
  CreditCard,
  NotebookPen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem {
  foodItem: FoodItem;
  quantity: number;
}

type DraftStage = "building" | "billing" | "done";

interface BillingTotals {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  serviceCharge: number;
  total: number;
}

interface OrderDraft {
  draftId: string;
  label: string;
  orderType: "dine_in" | "takeaway";
  tableId: string;
  cart: CartItem[];
  printedCart: CartItem[];
  discountId: string;
  notes: string;
  stage: DraftStage;
  savedOrderId?: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerId?: string;
  paymentMethodId: string;
  savedTotals?: BillingTotals;
  customDiscountType: "none" | "amount" | "percent";
  customDiscountValue: number;
}

function newDraft(label = "New Order"): OrderDraft {
  return {
    draftId: crypto.randomUUID(),
    label,
    orderType: "dine_in",
    tableId: "",
    cart: [],
    printedCart: [],
    discountId: "",
    notes: "",
    stage: "building",
    customerName: "",
    customerPhone: "",
    customerId: undefined,
    paymentMethodId: "",
    customDiscountType: "none",
    customDiscountValue: 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function calcTotals(
  cart: CartItem[],
  discounts: { id: string; discount_type: string; discount_value: number; is_active: boolean; apply_on: string }[],
  discountId: string,
  billing: { vat_percentage: number; service_charge_percentage: number } | null,
  customDiscountType: "none" | "amount" | "percent" = "none",
  customDiscountValue: number = 0,
): BillingTotals {
  const subtotal = cart.reduce((s, c) => s + c.foodItem.sell_price * c.quantity, 0);
  const discountObj = discountId ? discounts.find((d) => d.id === discountId && d.is_active) : null;
  const discountAmount = discountObj
    ? discountObj.discount_type === "percentage"
      ? (subtotal * discountObj.discount_value) / 100
      : discountObj.discount_value
    : customDiscountType === "amount"
    ? Math.min(customDiscountValue, subtotal)
    : customDiscountType === "percent"
    ? (subtotal * Math.min(customDiscountValue, 100)) / 100
    : 0;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = (afterDiscount * (billing?.vat_percentage ?? 0)) / 100;
  const serviceCharge = (afterDiscount * (billing?.service_charge_percentage ?? 0)) / 100;
  const total = afterDiscount + vatAmount + serviceCharge;
  return { subtotal, discountAmount, vatAmount, serviceCharge, total };
}

// ─── Kitchen Print ────────────────────────────────────────────────────────────
function printKitchenTicket(restaurantName: string, draft: OrderDraft, tableName: string, prevPrintedCart: CartItem[] = []) {
  const now = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const isReprint = prevPrintedCart.length > 0;
  let rows = "";
  for (const c of draft.cart) {
    const prev = prevPrintedCart.find((p) => p.foodItem.id === c.foodItem.id);
    const prevQty = prev?.quantity ?? 0;
    const oldQty = Math.min(prevQty, c.quantity);
    const addedQty = c.quantity - oldQty;
    if (oldQty > 0) {
      rows += `<tr>
        <td style="font-size:14px;padding:3px 0;width:32px;color:#aaa">${oldQty}×</td>
        <td style="font-size:14px;text-decoration:underline;color:#aaa;padding:3px 0">${c.foodItem.name}</td>
      </tr>`;
    }
    if (addedQty > 0) {
      rows += `<tr>
        <td style="font-size:15px;padding:4px 0;width:32px;font-weight:700">+${addedQty}×</td>
        <td style="font-size:15px;font-weight:700;padding:4px 0">★ ${c.foodItem.name}</td>
      </tr>`;
    }
    // First print: all items are new
    if (!isReprint) {
      rows = ""; // clear; we'll redo
      break;
    }
  }
  if (!isReprint) {
    rows = draft.cart.map((c) =>
      `<tr><td style="font-size:15px;padding:5px 0;width:32px">${c.quantity}×</td><td style="font-size:15px;font-weight:600;padding:5px 0">${c.foodItem.name}</td></tr>`
    ).join("");
  }
  const notesHtml = draft.notes.trim()
    ? `<hr/><div style="font-size:12px;font-style:italic;color:#333;margin-top:4px">📝 ${draft.notes}</div>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Kitchen</title>
<style>body{font-family:monospace;max-width:320px;margin:0 auto;padding:16px}h2{font-size:18px;text-align:center;margin:0 0 2px}.sub{text-align:center;font-size:12px;color:#555;margin-bottom:12px}hr{border:none;border-top:1px dashed #000;margin:8px 0}table{width:100%}@media print{body{padding:0}}</style></head>
<body><h2>${restaurantName}</h2><div class="sub">KITCHEN ORDER</div><hr/>
<div style="font-size:12px;display:flex;justify-content:space-between"><span>${draft.orderNumber ?? draft.label}</span><span>${now}</span></div>
<div style="font-size:12px;margin-top:4px">${draft.orderType === "dine_in" ? `Table: <strong>${tableName || "—"}</strong>` : "<strong>TAKEAWAY</strong>"}</div>
<hr/><table>${rows}</table>${notesHtml}<hr/>
<div style="text-align:center;font-size:11px;color:#888">Total: ${draft.cart.reduce((s, c) => s + c.quantity, 0)} items</div>
</body></html>`;
  const win = window.open("", "_blank", "width=400,height=600");
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
}

// ─── Menu Item Card ───────────────────────────────────────────────────────────
function MenuCard({ item, onAdd, disabled, cartQty = 0 }: { item: FoodItem; onAdd: () => void; disabled?: boolean; cartQty?: number }) {
  const isQty = item.availability_type === "quantity";
  const available = item.available_quantity ?? 0;
  const outOfStock = isQty && available === 0;
  const maxReached = isQty && cartQty >= available;
  const remaining = isQty ? available - cartQty : null;

  return (
    <button
      onClick={onAdd}
      disabled={disabled || outOfStock || maxReached}
      className="bg-white rounded-xl border border-gray-100 p-3 text-left hover:border-orange-300 hover:shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed relative"
    >
      <div className="w-full h-20 rounded-lg bg-orange-50 flex items-center justify-center mb-2 overflow-hidden relative">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
          : <span className="text-2xl">🍽️</span>}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
            <span className="text-white text-[10px] font-bold bg-red-500 px-1.5 py-0.5 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{item.name}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-sm font-bold text-orange-500">{fmt(item.sell_price)}</p>
        {isQty && !outOfStock && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            remaining! <= 3 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
          }`}>
            {remaining} left
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  draft,
  isActive,
  restaurantName,
  tables,
  paymentMethods,
  discounts,
  billing,
  customers,
  onActivate,
  onClose,
  onUpdate,
  onKitchenPrint,
  onBill,
  onComplete,
  onAddFood,
  saving,
}: {
  draft: OrderDraft;
  isActive: boolean;
  restaurantName: string;
  tables: { id: string; table_number?: string; name?: string; is_active: boolean }[];
  paymentMethods: { id: string; name: string; is_active: boolean }[];
  discounts: { id: string; name: string; discount_type: string; discount_value: number; is_active: boolean; apply_on: string }[];
  billing: { vat_percentage: number; service_charge_percentage: number } | null;
  customers: Customer[];
  onActivate: () => void;
  onClose: () => void;
  onUpdate: (patch: Partial<OrderDraft>) => void;
  onKitchenPrint: () => void;
  onBill: () => void;
  onComplete: () => void;
  onAddFood?: () => void;
  saving: boolean;
}) {
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [customerTotalSpend, setCustomerTotalSpend] = useState<number | null>(null);
  const activeTables = tables.filter((t) => t.is_active);
  const activePayments = paymentMethods.filter((p) => p.is_active);
  const activeDiscounts = discounts.filter((d) => d.is_active && d.apply_on === "order");

  const handleCustomerSelect = async (c: Customer) => {
    onUpdate({ customerName: c.name, customerPhone: c.phone ?? "", customerId: c.id });
    setShowCustDropdown(false);
    setCustomerTotalSpend(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("total")
      .eq("customer_id", c.id)
      .eq("status", "completed");
    const total = (data ?? []).reduce((s: number, o: any) => s + (o.total ?? 0), 0);
    setCustomerTotalSpend(total);
  };

  // Use savedTotals when in billing stage (locked & accurate), else compute live
  const liveT = calcTotals(draft.cart, discounts, draft.discountId, billing, draft.customDiscountType, draft.customDiscountValue);
  const totals: BillingTotals = (draft.stage === "billing" && draft.savedTotals) ? draft.savedTotals : liveT;

  const tableName = (activeTables.find((t) => t.id === draft.tableId) as any)?.table_number
    ?? (activeTables.find((t) => t.id === draft.tableId) as any)?.name ?? "";
  const locked = draft.stage !== "building";
  const itemCount = draft.cart.reduce((s, c) => s + c.quantity, 0);
  const canComplete = draft.stage === "billing" && !!draft.paymentMethodId && draft.cart.length > 0;

  // Done state
  if (draft.stage === "done") {
    return (
      <div className="w-full md:flex-shrink-0 md:w-64 bg-green-50 border-2 border-green-300 rounded-2xl flex flex-col items-center justify-center gap-2 p-6 text-center min-h-[120px] md:min-h-[280px]">
        <CheckCircle size={36} className="text-green-500" />
        <p className="font-bold text-green-800">{draft.orderNumber ?? draft.label}</p>
        <p className="text-xl font-bold text-green-700">{fmt(totals.total)}</p>
        <p className="text-xs text-green-500">Completed ✓</p>
      </div>
    );
  }

  return (
    <div
      onClick={onActivate}
      className={`w-full md:flex-shrink-0 md:w-72 flex flex-col bg-white rounded-2xl border-2 transition-all overflow-hidden shadow-sm ${
        isActive ? "border-orange-400 shadow-orange-100 shadow-md" : "border-gray-200 hover:border-gray-300 cursor-pointer"
      }`}
      style={{ maxHeight: "calc(100vh - 140px)" }}
    >
      {/* Card header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isActive ? "bg-orange-50 border-orange-100" : "bg-gray-50 border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isActive ? "text-orange-700" : "text-gray-600"}`}>
            {draft.orderNumber ?? draft.label}
          </span>
          {itemCount > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${isActive ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-600"}`}>
              {itemCount}
            </span>
          )}
          {draft.stage === "billing" && (
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">Billing</span>
          )}
          {draft.stage === "building" && draft.savedOrderId && (
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">Active</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
        >
          <X size={13} />
        </button>
      </div>

      {/* Order type + table */}
      <div className="px-3 py-2 border-b border-gray-50 space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["dine_in", "takeaway"] as const).map((t) => (
            <button
              key={t}
              disabled={locked}
              onClick={() => onUpdate({ orderType: t, tableId: t === "takeaway" ? "" : draft.tableId })}
              className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                draft.orderType === t ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-50"
              } disabled:cursor-default`}
            >
              {t === "dine_in" ? "🍽 Dine In" : "🥡 Takeaway"}
            </button>
          ))}
        </div>
        {draft.orderType === "dine_in" && (
          <select
            disabled={locked}
            value={draft.tableId}
            onChange={(e) => onUpdate({ tableId: e.target.value })}
            className={`w-full h-7 px-2 rounded-lg border text-xs disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400 ${!draft.tableId && !locked ? "border-red-400 bg-red-50" : "border-gray-200"}`}
          >
            <option value="">Select table…</option>
            {activeTables.map((t) => (
              <option key={t.id} value={t.id}>{(t as any).table_number ?? (t as any).name ?? t.id}</option>
            ))}
          </select>
        )}
      </div>

      {/* Cart — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-[80px]" onClick={(e) => e.stopPropagation()}>
        {draft.cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center gap-3">
            {/* Mobile: prominent Add Food button when cart is empty */}
            {!locked && onAddFood && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddFood(); }}
                className="md:hidden w-full h-10 rounded-xl bg-orange-50 border-2 border-dashed border-orange-200 text-orange-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-orange-100"
              >
                <Plus size={15} /> Add Food
              </button>
            )}
            <div className="hidden md:flex flex-col items-center">
              <ShoppingCart size={24} className="text-gray-200 mb-1" />
              <p className="text-xs text-gray-300">Click menu items to add</p>
            </div>
            {/* Mobile subtle hint */}
            <p className="md:hidden text-xs text-gray-300">Tap above to browse menu</p>
          </div>
        ) : (
          draft.cart.map((c) => (
            <div key={c.foodItem.id} className="flex items-center gap-1.5 py-1.5 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{c.foodItem.name}</p>
                <p className="text-xs text-gray-400">{fmt(c.foodItem.sell_price)}</p>
              </div>
              {locked ? (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">×{c.quantity}</span>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdate({
                      cart: draft.cart
                        .map((i) => i.foodItem.id === c.foodItem.id ? { ...i, quantity: i.quantity - 1 } : i)
                        .filter((i) => i.quantity > 0),
                    })}
                    className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus size={9} />
                  </button>
                  <span className="w-5 text-center text-xs font-semibold">{c.quantity}</span>
                  <button
                    onClick={() => {
                      if (c.foodItem.availability_type === "quantity") {
                        const avail = c.foodItem.available_quantity ?? 0;
                        if (c.quantity >= avail) { toast.error(`Only ${avail} in stock`); return; }
                      }
                      onUpdate({ cart: draft.cart.map((i) => i.foodItem.id === c.foodItem.id ? { ...i, quantity: i.quantity + 1 } : i) });
                    }}
                    className="w-5 h-5 rounded bg-orange-100 flex items-center justify-center hover:bg-orange-200 transition-colors"
                  >
                    <Plus size={9} className="text-orange-600" />
                  </button>
                </div>
              )}
              <span className="text-xs font-semibold text-gray-700 w-12 text-right">{fmt(c.foodItem.sell_price * c.quantity)}</span>
              {!locked && (
                <button onClick={() => onUpdate({ cart: draft.cart.filter((i) => i.foodItem.id !== c.foodItem.id) })} className="text-gray-200 hover:text-red-400">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Notes — building stage only */}
      {draft.stage === "building" && (
        <div className="px-3 pb-2 border-b border-gray-50" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <NotebookPen size={11} className="absolute left-2 top-2 text-gray-300" />
            <textarea
              rows={2}
              placeholder="Kitchen notes (optional)…"
              value={draft.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 placeholder:text-gray-300"
            />
          </div>
        </div>
      )}

      {/* Totals — building stage (live) */}
      {draft.stage === "building" && draft.cart.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1 text-xs" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between font-bold text-sm text-gray-900">
            <span>Total</span><span className="text-orange-600">{fmt(liveT.total)}</span>
          </div>
        </div>
      )}

      {/* Discount controls — billing stage */}
      {draft.stage === "billing" && (
        <div className="border-t border-orange-100 px-3 py-2 space-y-1.5 bg-orange-50/30" onClick={(e) => e.stopPropagation()}>
          <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">Discount</p>
          {/* Campaign discounts */}
          {activeDiscounts.length > 0 && (
            <select
              value={draft.discountId}
              onChange={(e) => {
                const newId = e.target.value;
                const newTotals = calcTotals(draft.cart, discounts, newId, billing, newId ? "none" : draft.customDiscountType, draft.customDiscountValue);
                onUpdate({ discountId: newId, customDiscountType: newId ? "none" : draft.customDiscountType, savedTotals: newTotals });
              }}
              className="w-full h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none"
            >
              <option value="">— Campaign discount —</option>
              {activeDiscounts.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.discount_type === "percentage" ? `${d.discount_value}%` : fmt(d.discount_value)})</option>
              ))}
            </select>
          )}
          {/* Custom discount (shown when no campaign selected) */}
          {!draft.discountId && (
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                {(["none", "amount", "percent"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      const newTotals = calcTotals(draft.cart, discounts, "", billing, type, draft.customDiscountValue);
                      onUpdate({ discountId: "", customDiscountType: type, savedTotals: newTotals });
                    }}
                    className={`px-2 py-1 text-[10px] font-semibold transition-colors ${draft.customDiscountType === type ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    {type === "none" ? "None" : type === "amount" ? "৳" : "%"}
                  </button>
                ))}
              </div>
              {draft.customDiscountType !== "none" && (
                <input
                  type="number"
                  min="0"
                  max={draft.customDiscountType === "percent" ? 100 : undefined}
                  value={draft.customDiscountValue || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const newTotals = calcTotals(draft.cart, discounts, "", billing, draft.customDiscountType, val);
                    onUpdate({ customDiscountValue: val, savedTotals: newTotals });
                  }}
                  placeholder={draft.customDiscountType === "amount" ? "Amount" : "0-100"}
                  className="flex-1 h-7 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Billing summary — billing stage */}
      {draft.stage === "billing" && draft.cart.length > 0 && (
        <div className="border-t border-orange-100 px-3 py-2.5 space-y-1 text-xs bg-orange-50/40" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-1.5">Billing Summary</p>
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(totals.discountAmount)}</span></div>
          )}
          {(billing?.vat_percentage ?? 0) > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>VAT ({billing!.vat_percentage}%)</span>
              <span>{fmt(totals.vatAmount)}</span>
            </div>
          )}
          {(billing?.service_charge_percentage ?? 0) > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Service ({billing!.service_charge_percentage}%)</span>
              <span>{fmt(totals.serviceCharge)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm text-gray-900 border-t border-orange-200 pt-1.5 mt-0.5">
            <span>Total</span><span className="text-orange-600">{fmt(totals.total)}</span>
          </div>
        </div>
      )}

      {/* Billing form — customer info + payment */}
      {draft.stage === "billing" && (() => {
        const matchingCustomers = showCustDropdown && draft.customerName.trim().length >= 1
          ? customers.filter((c) =>
              c.name.toLowerCase().includes(draft.customerName.toLowerCase()) ||
              (c.phone ?? "").includes(draft.customerName)
            ).slice(0, 6)
          : [];
        return (
          <div className="border-t border-orange-100 bg-orange-50 px-3 py-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Customer (optional)</p>
            {/* Name with CRM autocomplete */}
            <div className="relative">
              <User size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Search or type customer name"
                value={draft.customerName}
                onChange={(e) => { onUpdate({ customerName: e.target.value, customerId: undefined }); setCustomerTotalSpend(null); }}
                onFocus={() => setShowCustDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustDropdown(false), 150)}
                className="w-full h-7 pl-6 pr-10 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
              />
              {draft.customerId && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] bg-green-100 text-green-600 font-bold px-1 py-0.5 rounded">CRM</span>
              )}
              {/* Dropdown */}
              {matchingCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-0.5 z-30 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {matchingCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCustomerSelect(c)}
                      className="w-full px-2.5 py-1.5 text-left hover:bg-orange-50 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-gray-800 truncate">{c.name}</span>
                      {c.phone && <span className="text-xs text-gray-400 shrink-0">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Phone size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" placeholder="Phone number" value={draft.customerPhone}
                onChange={(e) => onUpdate({ customerPhone: e.target.value })}
                className="w-full h-7 pl-6 pr-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
            </div>
            {draft.customerId && customerTotalSpend !== null && (
              <div className="flex items-center justify-between bg-orange-100 rounded-lg px-3 py-1.5">
                <span className="text-xs text-orange-700 font-medium">Total spend</span>
                <span className="text-xs font-bold text-orange-800">{fmt(customerTotalSpend)}</span>
              </div>
            )}
            <div className="relative">
              <CreditCard size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
              <select value={draft.paymentMethodId} onChange={(e) => onUpdate({ paymentMethodId: e.target.value })}
                className="w-full h-7 pl-6 pr-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white appearance-none">
                <option value="">Payment method *</option>
                {activePayments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        );
      })()}

      {/* Actions */}
      <div className="px-3 py-2.5 border-t border-gray-100 space-y-1.5" onClick={(e) => e.stopPropagation()}>
        {draft.stage === "building" && (
          <>
            {/* Mobile: Add Food button when cart has items */}
            {onAddFood && draft.cart.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddFood(); }}
                className="md:hidden w-full h-8 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-orange-100 transition-colors"
              >
                <Plus size={12} /> Add More Food
              </button>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onKitchenPrint}
                disabled={draft.cart.length === 0 || saving}
                className="h-8 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors"
              >
                <Printer size={12} /> {draft.savedOrderId ? "Reprint" : "Kitchen"}
              </button>
              <button
                onClick={onBill}
                disabled={draft.cart.length === 0 || saving}
                className="h-8 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors"
              >
                <ReceiptText size={12} /> {saving ? "…" : "Bill"}
              </button>
            </div>
          </>
        )}
        {draft.stage === "billing" && (
          <button
            onClick={onComplete}
            disabled={!canComplete || saving}
            className="w-full h-9 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
          >
            <CheckCircle size={14} />
            {saving ? "Processing…" : "Complete Order"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewOrderPage() {
  const { activeRestaurant } = useRestaurant();
  const { items: foodItems, loading: menuLoading } = useFoodItems(activeRestaurant?.id);
  const { categories } = useFoodCategories(activeRestaurant?.id);
  const { tables } = useTables(activeRestaurant?.id);
  const { methods: paymentMethods } = usePaymentMethods(activeRestaurant?.id);
  const { settings: billing } = useBillingSettings(activeRestaurant?.id);
  const { discounts } = useDiscounts(activeRestaurant?.id);
  const { billOrder, createKitchenOrder, billAndCreateOrder, completeOrderFull, cancelOrder } = useOrders(activeRestaurant?.id);
  const { customers } = useCustomers(activeRestaurant?.id);

  // Per-instance counter — avoids module-level shared state that causes SSR hydration mismatches
  const draftCounterRef = useRef(1);

  // useId() returns the same value on server and client — prevents crypto.randomUUID()
  // from causing a hydration mismatch on the initial draft
  const initDraftId = useId();
  const [init] = useState(() => {
    const d = newDraft(`Order ${draftCounterRef.current++}`);
    d.draftId = initDraftId; // stable SSR-safe ID for the first draft
    return { draft: d, id: initDraftId };
  });
  const [drafts, setDrafts] = useState<OrderDraft[]>([init.draft]);
  const [activeDraftId, setActiveDraftId] = useState<string>(init.id);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  // Track previous cart per draft to detect changes for DB sync
  const prevCartRef = useRef<Map<string, CartItem[]>>(new Map());

  // Load today's active/billed orders from DB
  useEffect(() => {
    if (!activeRestaurant) return;
    const supabase = createClient();

    const loadOrders = async () => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from("orders")
        .select(`*, tables(id, table_number), customers(id, name, phone), order_items(*, food_items(id, name, sell_price))`)
        .eq("restaurant_id", activeRestaurant.id)
        .in("status", ["active", "billed"])
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const restored: OrderDraft[] = data.map((order: any) => ({
          draftId: crypto.randomUUID(),
          label: order.order_number ?? `Order ${draftCounterRef.current++}`,
          orderType: order.type,
          tableId: order.table_id ?? "",
          cart: (order.order_items ?? []).map((item: any) => ({
            foodItem: {
              id: item.food_item_id,
              name: item.food_items?.name ?? "Unknown",
              sell_price: item.food_items?.sell_price ?? item.unit_price,
              is_active: true,
              is_recipe: false,
              created_at: new Date().toISOString(),
            } as FoodItem,
            quantity: item.quantity,
          })),
          discountId: "",
          notes: order.notes ?? "",
          stage: order.status === "billed" ? "billing" : "building",
          savedOrderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customers?.name ?? "",
          customerPhone: order.customers?.phone ?? "",
          customerId: order.customers?.id ?? undefined,
          paymentMethodId: order.payment_method_id ?? "",
          savedTotals: order.status === "billed" ? {
            subtotal: order.subtotal,
            discountAmount: order.discount_amount,
            vatAmount: order.vat_amount,
            serviceCharge: order.service_charge,
            total: order.total,
          } : undefined,
          printedCart: [],
          customDiscountType: "none",
          customDiscountValue: 0,
        }));
        setDrafts(restored);
        setActiveDraftId(restored[0].draftId);
      }
      setLoadingOrders(false);
    };

    loadOrders();
  }, [activeRestaurant?.id]);

  // ── Auto-sync cart changes to DB for orders already saved ──────────────────
  useEffect(() => {
    const supabase = createClient();
    drafts.forEach((draft) => {
      if (!draft.savedOrderId || draft.stage !== "building") return;
      const prevCart = prevCartRef.current.get(draft.draftId);
      if (prevCart === draft.cart) return; // reference unchanged — no sync needed
      const orderId = draft.savedOrderId;
      const cart = draft.cart;
      // Fire-and-forget: delete old items then reinsert full cart
      (async () => {
        await supabase.from("order_items").delete().eq("order_id", orderId);
        if (cart.length > 0) {
          await supabase.from("order_items").insert(
            cart.map((c) => ({
              order_id: orderId,
              food_item_id: c.foodItem.id,
              quantity: c.quantity,
              unit_price: c.foodItem.sell_price,
              addons: [],
              options: {},
            }))
          );
        }
      })();
      prevCartRef.current.set(draft.draftId, draft.cart);
    });
  }, [drafts]);

  const activeDraft = drafts.find((d) => d.draftId === activeDraftId) ?? drafts[0];

  const updateDraft = useCallback((draftId: string, patch: Partial<OrderDraft>) => {
    setDrafts((prev) => prev.map((d) => d.draftId === draftId ? { ...d, ...patch } : d));
  }, []);

  const addNewOrder = () => {
    const d = newDraft(`Order ${draftCounterRef.current++}`);
    setDrafts((prev) => [...prev, d]);
    setActiveDraftId(d.draftId);
  };

  // Remove draft from UI and reset counter if it was the last one
  const removeDraft = (draftId: string) => {
    setDrafts((prev) => {
      const remaining = prev.filter((d) => d.draftId !== draftId);
      if (remaining.length === 0) {
        // Reset counter so the next fresh tab starts at "Order 1" again
        draftCounterRef.current = 1;
        const fresh = newDraft(`Order ${draftCounterRef.current++}`);
        setActiveDraftId(fresh.draftId);
        return [fresh];
      }
      if (activeDraftId === draftId) setActiveDraftId(remaining[remaining.length - 1].draftId);
      return remaining;
    });
  };

  // X button clicked — decide whether to show confirmation or close immediately
  const handleCloseRequest = (draftId: string) => {
    const draft = drafts.find((d) => d.draftId === draftId);
    if (!draft) return;

    if (draft.stage === "billing" && draft.savedOrderId) {
      // Billed orders need confirmation before cancelling
      setCancelConfirmId(draftId);
    } else {
      // Building stage (or done) — cancel in DB silently if needed, then remove
      performClose(draftId);
    }
  };

  // Actually perform the close: cancel in DB if needed, then remove from UI
  const performClose = async (draftId: string) => {
    const draft = drafts.find((d) => d.draftId === draftId);
    if (draft?.savedOrderId && draft.stage !== "done") {
      await cancelOrder(draft.savedOrderId);
      if (draft.stage === "billing") toast.success("Order cancelled");
    }
    removeDraft(draftId);
  };

  const menuItems = useMemo(() => {
    let list = foodItems.filter((i) => i.is_active && !i.is_recipe);
    if (activeCategory !== "all") list = list.filter((i) => i.food_category_id === activeCategory);
    if (search) list = list.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [foodItems, activeCategory, search]);

  const addToCart = async (item: FoodItem) => {
    if (!activeDraft || activeDraft.stage !== "building") return;

    // Enforce stock limit for quantity-type items
    if (item.availability_type === "quantity") {
      const available = item.available_quantity ?? 0;
      const inCart = activeDraft.cart.find((c) => c.foodItem.id === item.id)?.quantity ?? 0;
      if (inCart >= available) {
        toast.error(`Only ${available} in stock`);
        return;
      }
    }

    const isFirstItem = activeDraft.cart.length === 0;
    const existing = activeDraft.cart.find((c) => c.foodItem.id === item.id);
    const newCart: CartItem[] = existing
      ? activeDraft.cart.map((c) => c.foodItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...activeDraft.cart, { foodItem: item, quantity: 1 }];

    // Optimistic local update immediately
    updateDraft(activeDraftId, { cart: newCart });

    // Auto-create order in DB on very first item (so cart persists across refresh)
    if (isFirstItem && !activeDraft.savedOrderId && activeRestaurant) {
      const { data: order, error } = await createKitchenOrder(
        { type: activeDraft.orderType, tableId: activeDraft.tableId || undefined, notes: activeDraft.notes },
        [{ food_item_id: item.id, quantity: 1, unit_price: item.sell_price }]
      );
      if (error || !order) {
        const msg = (error as any)?.message ?? String(error);
        console.error("[addToCart] auto-create failed:", msg);
        toast.error(`Order save failed: ${msg}`);
      } else {
        updateDraft(activeDraftId, { savedOrderId: order.id, orderNumber: order.order_number });
        // Seed prevCartRef so the sync useEffect won't double-write
        prevCartRef.current.set(activeDraftId, newCart);
      }
    }
  };

  const handleKitchenPrint = async (draftId: string) => {
    const draft = drafts.find((d) => d.draftId === draftId);
    if (!activeRestaurant || !draft || draft.cart.length === 0) return;
    if (draft.orderType === "dine_in" && !draft.tableId) {
      toast.error("Please select a table for dine-in orders");
      return;
    }

    const prevPrintedCart = draft.printedCart ?? [];

    // If not yet saved (no auto-create happened), save to DB as active first
    if (!draft.savedOrderId) {
      setSaving(true);
      const items: CreateOrderItemPayload[] = draft.cart.map((c) => ({
        food_item_id: c.foodItem.id, quantity: c.quantity, unit_price: c.foodItem.sell_price,
      }));
      const { data: order, error } = await createKitchenOrder(
        { type: draft.orderType, tableId: draft.tableId || undefined, notes: draft.notes },
        items
      );
      if (error || !order) {
        const msg = (error as any)?.message ?? String(error);
        console.error("[Kitchen] createKitchenOrder failed:", msg);
        toast.error(`Kitchen order failed: ${msg}`);
        setSaving(false);
        return;
      }
      updateDraft(draftId, { savedOrderId: order.id, orderNumber: order.order_number });
      prevCartRef.current.set(draftId, draft.cart); // prevent double-sync
      const tableName = (tables as any[]).find((t) => t.id === draft.tableId)?.table_number
        ?? (tables as any[]).find((t) => t.id === draft.tableId)?.name ?? "";
      printKitchenTicket(activeRestaurant.name, { ...draft, savedOrderId: order.id, orderNumber: order.order_number }, tableName, prevPrintedCart);
      updateDraft(draftId, { printedCart: [...draft.cart] });
      setSaving(false);
      return;
    }

    // Already in DB (auto-created or previously printed) — just reprint
    const tableName = (tables as any[]).find((t) => t.id === draft.tableId)?.table_number
      ?? (tables as any[]).find((t) => t.id === draft.tableId)?.name ?? "";
    printKitchenTicket(activeRestaurant.name, draft, tableName, prevPrintedCart);
    updateDraft(draftId, { printedCart: [...draft.cart] });
  };

  const handleBill = async (draftId: string) => {
    const draft = drafts.find((d) => d.draftId === draftId);
    if (!activeRestaurant || !draft || draft.cart.length === 0) return;
    if (draft.orderType === "dine_in" && !draft.tableId) {
      toast.error("Please select a table for dine-in orders");
      return;
    }
    setSaving(true);

    const t = calcTotals(draft.cart, discounts, draft.discountId, billing as any, draft.customDiscountType, draft.customDiscountValue);
    const dbTotals = { subtotal: t.subtotal, discount_amount: t.discountAmount, vat_amount: t.vatAmount, service_charge: t.serviceCharge, total: t.total };

    if (draft.savedOrderId) {
      // Order already in DB (auto-created or kitchen-printed) — update to billed
      const { error } = await billOrder(draft.savedOrderId, dbTotals);
      if (error) {
        const msg = (error as any)?.message ?? String(error);
        console.error("[Bill] billOrder failed:", msg);
        toast.error(`Bill failed: ${msg}`);
      } else {
        updateDraft(draftId, { stage: "billing", savedTotals: t });
      }
    } else {
      // Went straight to bill without adding items first (edge case)
      const items: CreateOrderItemPayload[] = draft.cart.map((c) => ({
        food_item_id: c.foodItem.id, quantity: c.quantity, unit_price: c.foodItem.sell_price,
      }));
      const { data: order, error } = await billAndCreateOrder(
        { type: draft.orderType, tableId: draft.tableId || undefined, notes: draft.notes },
        items,
        dbTotals
      );
      if (error || !order) {
        const msg = (error as any)?.message ?? String(error);
        console.error("[Bill] billAndCreateOrder failed:", msg);
        toast.error(`Bill failed: ${msg}`);
      } else {
        updateDraft(draftId, { stage: "billing", savedOrderId: order.id, orderNumber: order.order_number, savedTotals: t });
      }
    }
    setSaving(false);
  };

  const handleComplete = async (draftId: string) => {
    const draft = drafts.find((d) => d.draftId === draftId);
    if (!activeRestaurant || !draft?.savedOrderId || !draft.orderNumber) return;
    setSaving(true);

    const t = draft.savedTotals ?? calcTotals(draft.cart, discounts, draft.discountId, billing as any, draft.customDiscountType, draft.customDiscountValue);
    const { error } = await completeOrderFull(
      draft.savedOrderId, draft.orderNumber,
      { subtotal: t.subtotal, discount_amount: t.discountAmount, vat_amount: t.vatAmount, service_charge: t.serviceCharge, total: t.total },
      draft.paymentMethodId,
      draft.customerName.trim() ? { name: draft.customerName, phone: draft.customerPhone || undefined } : undefined,
      draft.customerId
    );
    if (error) {
      const msg = (error as any)?.message ?? String(error);
      console.error("[Complete] completeOrderFull failed:", msg);
      toast.error(`Complete failed: ${msg}`);
    } else {
      toast.success("Order completed!");
      updateDraft(draftId, { stage: "done" });
      setTimeout(() => {
        setDrafts((prev) => {
          const remaining = prev.filter((d) => d.draftId !== draftId);
          if (remaining.length === 0) {
            const fresh = newDraft();
            setActiveDraftId(fresh.draftId);
            return [fresh];
          }
          if (activeDraftId === draftId) setActiveDraftId(remaining[remaining.length - 1].draftId);
          return remaining;
        });
      }, 3000);
    }
    setSaving(false);
  };

  return (
    <>
      <Header title="New Order" />

      <div className="flex h-[calc(100vh-56px)] md:h-[calc(100vh-56px)] overflow-hidden">

        {/* ── LEFT: Menu ── */}
        <div className={`hidden md:flex w-full md:w-[340px] md:shrink-0 flex-col border-r border-gray-100 bg-white overflow-hidden`}>
          {/* Search + category */}
          <div className="p-3 space-y-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button onClick={() => setActiveCategory("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === "all" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                All
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === cat.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {menuLoading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading menu…</p>
            ) : !activeRestaurant ? (
              <p className="text-center text-sm text-gray-400 py-8">Select a restaurant first.</p>
            ) : menuItems.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No items found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
                {menuItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    onAdd={() => addToCart(item)}
                    disabled={!activeDraft || activeDraft.stage !== "building"}
                    cartQty={activeDraft?.cart.find((c) => c.foodItem.id === item.id)?.quantity ?? 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Order cards ── */}
        <div className={`flex flex-1 overflow-hidden flex-col bg-gray-50`}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Active Orders</span>
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {drafts.filter((d) => d.stage !== "done").length}
              </span>
              {loadingOrders && <span className="text-xs text-gray-400">Loading…</span>}
            </div>
            <button
              onClick={addNewOrder}
              className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} /> New Order
            </button>
          </div>

          {/* Cards area — vertical scroll on mobile, horizontal on desktop */}
          <div className="flex-1 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden">
            <div className="flex flex-col md:flex-row gap-4 p-4 md:p-5 md:h-full md:items-start">
              {drafts.map((draft) => (
                <OrderCard
                  key={draft.draftId}
                  draft={draft}
                  isActive={draft.draftId === activeDraftId}
                  restaurantName={activeRestaurant?.name ?? "Restaurant"}
                  tables={tables as any}
                  paymentMethods={paymentMethods as any}
                  discounts={discounts as any}
                  billing={billing as any}
                  customers={customers}
                  onActivate={() => setActiveDraftId(draft.draftId)}
                  onClose={() => handleCloseRequest(draft.draftId)}
                  onUpdate={(patch) => updateDraft(draft.draftId, patch)}
                  onKitchenPrint={() => handleKitchenPrint(draft.draftId)}
                  onBill={() => handleBill(draft.draftId)}
                  onComplete={() => handleComplete(draft.draftId)}
                  onAddFood={() => { setActiveDraftId(draft.draftId); setMobileMenuOpen(true); }}
                  saving={saving}
                />
              ))}

              {/* Add new order card */}
              <button
                onClick={addNewOrder}
                className="w-full md:flex-shrink-0 md:w-44 min-h-[80px] md:min-h-[200px] rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 flex flex-col items-center justify-center gap-2 text-gray-300 hover:text-orange-400 transition-all"
              >
                <Plus size={28} />
                <span className="text-sm font-medium">New Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cancel Confirmation Modal ───────────────────────────────────────── */}
      {cancelConfirmId && (() => {
        const draft = drafts.find((d) => d.draftId === cancelConfirmId);
        return (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setCancelConfirmId(null)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon + title */}
              <div className="px-6 pt-6 pb-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                  <Trash2 size={22} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Cancel Order?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-semibold text-gray-700">{draft?.orderNumber ?? draft?.label}</span>
                    {" "}is already billed. Cancelling will mark it as cancelled and cannot be undone.
                  </p>
                </div>
              </div>

              {/* Totals reminder */}
              {draft?.savedTotals && (
                <div className="mx-6 mb-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex justify-between items-center text-sm">
                  <span className="text-gray-500">Order total</span>
                  <span className="font-bold text-gray-800">{"৳" + draft.savedTotals.total.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setCancelConfirmId(null)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  onClick={async () => {
                    const id = cancelConfirmId;
                    setCancelConfirmId(null);
                    await performClose(id);
                  }}
                  className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mobile full-screen menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
            <p className="text-sm font-bold text-gray-800">Add Food</p>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search + categories */}
          <div className="px-3 py-2.5 space-y-2 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => setActiveCategory("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === "all" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === cat.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-3 pb-24">
            {menuLoading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading menu…</p>
            ) : menuItems.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No items found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {menuItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    onAdd={() => addToCart(item)}
                    disabled={!activeDraft || activeDraft.stage !== "building"}
                    cartQty={activeDraft?.cart.find((c) => c.foodItem.id === item.id)?.quantity ?? 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Done button — floating at bottom */}
          <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-gray-100">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle size={16} />
              Done · {activeDraft?.cart.reduce((s, c) => s + c.quantity, 0) ?? 0} item{(activeDraft?.cart.reduce((s, c) => s + c.quantity, 0) ?? 0) !== 1 ? "s" : ""} in order
            </button>
          </div>
        </div>
      )}
    </>
  );
}
