"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import {
  ShoppingCart, Plus, Minus, Trash2, ArrowLeft,
  CheckCircle, Clock, ChefHat, Loader2, UtensilsCrossed, Tag, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface FoodItem {
  id: string; name: string; sell_price: number;
  description?: string; image_url?: string; category_id?: string;
}
interface FoodCategory { id: string; name: string; }
interface TableItem    { id: string; name: string; }
interface DiscountItem { id: string; name: string; discount_type: "percentage" | "amount"; discount_value: number; }
interface BillingCfg   { vat_percentage: number; service_charge_percentage: number; }
interface CartItem extends FoodItem { quantity: number; }
interface Restaurant   { id: string; name: string; logo_url?: string; }
type Step = "menu" | "checkout" | "confirmed";

const PREP_MINUTES = 35;

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(startedAt: number | null, totalMins: number = PREP_MINUTES) {
  const [secsLeft, setSecsLeft] = useState(totalMins * 60);
  useEffect(() => {
    if (!startedAt) return;
    const totalSecs = totalMins * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSecsLeft(Math.max(0, totalSecs - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, totalMins]);
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const ss = String(secsLeft % 60).padStart(2, "0");
  return { mm, ss, secsLeft, done: secsLeft === 0 };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CustomerOrderPage({ params }: { params: Promise<{ rid: string }> }) {
  const { rid } = use(params);

  const [step, setStep]                 = useState<Step>("menu");
  const [restaurant, setRestaurant]     = useState<Restaurant | null>(null);
  const [items, setItems]               = useState<FoodItem[]>([]);
  const [categories, setCategories]     = useState<FoodCategory[]>([]);
  const [tables, setTables]             = useState<TableItem[]>([]);
  const [billing, setBilling]           = useState<BillingCfg>({ vat_percentage: 0, service_charge_percentage: 0 });
  const [discounts, setDiscounts]       = useState<DiscountItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  // Order confirmation state
  const [orderId, setOrderId]           = useState<string | null>(null);
  const [orderNumber, setOrderNumber]   = useState<string | null>(null);
  const [orderStatus, setOrderStatus]   = useState("active");
  const [serverConfirmedAt, setServerConfirmedAt] = useState<string | null>(null);  // ISO from DB
  const [serverPrepMins, setServerPrepMins]       = useState<number | null>(null);  // admin-set mins
  const localPlacedAt                   = useRef<number | null>(null);
  const [confirmedTs, setConfirmedTs]   = useState<number | null>(null);

  // Form
  const [name, setName]                 = useState("");
  const [phone, setPhone]               = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedDiscountId, setSelectedDiscountId] = useState("");
  const [savedTableName, setSavedTableName] = useState(""); // persisted for refresh

  // ── sessionStorage key (persists on refresh, cleared when tab closes) ──────
  const STORAGE_KEY = `co_order_${rid}`;

  // ── Restore from sessionStorage on mount ──────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.orderId && d.step === "confirmed") {
        setCart(d.cart ?? []);
        setName(d.name ?? "");
        setPhone(d.phone ?? "");
        setSelectedTableId(d.selectedTableId ?? "");
        setSavedTableName(d.tableName ?? "");
        setSelectedDiscountId(d.selectedDiscountId ?? "");
        setConfirmedTs(d.confirmedTs ?? null);
        setOrderId(d.orderId);
        setOrderNumber(d.orderNumber ?? null);
        setOrderStatus(d.orderStatus ?? "active");
        if (d.serverConfirmedAt) {
          setServerConfirmedAt(d.serverConfirmedAt);
          setServerPrepMins(d.serverPrepMins ?? null);
        }
        setStep("confirmed");
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save to sessionStorage whenever confirmed state changes ────────────────
  useEffect(() => {
    if (step !== "confirmed" || !orderId) return;
    try {
      const tName = tables.find((t) => t.id === selectedTableId)?.name ?? savedTableName;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: "confirmed",
        orderId, orderNumber, cart, name, phone,
        selectedTableId, tableName: tName,
        selectedDiscountId, confirmedTs,
        serverConfirmedAt, serverPrepMins, orderStatus,
      }));
    } catch { /* ignore */ }
  }, [step, orderId, orderNumber, cart, name, phone, selectedTableId, savedTableName,
      selectedDiscountId, confirmedTs, serverConfirmedAt, serverPrepMins, orderStatus,
      tables, STORAGE_KEY]);

  // ── Fetch menu ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/menu/${rid}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error("Menu not found"); return; }
        setRestaurant(d.restaurant);
        setItems(d.items);
        setCategories(d.categories);
        setTables(d.tables ?? []);
        setBilling(d.billing ?? { vat_percentage: 0, service_charge_percentage: 0 });
        setDiscounts(d.discounts ?? []);
      })
      .catch(() => toast.error("Failed to load menu"))
      .finally(() => setLoading(false));
  }, [rid]);

  // ── Poll order status ──────────────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/customer-order/${orderId}/status`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.status) setOrderStatus(d.status);
      // When admin confirms, switch countdown to server-based
      if (d.confirmed_at && !serverConfirmedAt) {
        const prepMins = d.prep_time_minutes ?? PREP_MINUTES;
        setServerConfirmedAt(d.confirmed_at);
        setServerPrepMins(prepMins);
        // Set confirmedTs to the server's confirmed_at so countdown is accurate
        setConfirmedTs(new Date(d.confirmed_at).getTime());
      }
    } catch { /* silent — network error, will retry on next poll */ }
  }, [orderId, serverConfirmedAt]);

  useEffect(() => {
    if (step !== "confirmed" || !orderId) return;
    // Immediate poll + every 5 seconds
    pollStatus();
    const id = setInterval(pollStatus, 5000);
    return () => clearInterval(id);
  }, [step, orderId, pollStatus]);

  // ── Countdown — use server-confirmed time when available ──────────────────
  // If admin set a prep time: use that duration from server's confirmed_at
  // Otherwise: use local 35-min fallback from when order was placed
  const countdownStartTs = serverConfirmedAt
    ? new Date(serverConfirmedAt).getTime()
    : confirmedTs;
  const countdownMins = serverPrepMins ?? PREP_MINUTES;
  const { mm, ss, secsLeft } = useCountdown(countdownStartTs, countdownMins);
  const isConfirmedByAdmin = !!serverConfirmedAt;
  const progress = countdownStartTs ? Math.max(0, secsLeft / (countdownMins * 60)) : 1;

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addToCart = (item: FoodItem) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added`);
  };

  const updateQty = (id: string, delta: number) =>
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0));

  // ── Start a fresh new order (clears session storage) ──────────────────────
  const startNewOrder = () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setCart([]); setOrderId(null); setOrderNumber(null);
    setName(""); setPhone(""); setSelectedTableId(""); setSavedTableName(""); setSelectedDiscountId("");
    setConfirmedTs(null); setServerConfirmedAt(null); setServerPrepMins(null);
    setOrderStatus("active"); setCartOpen(false); setStep("menu");
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, c) => s + c.sell_price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const selectedDiscount = discounts.find((d) => d.id === selectedDiscountId) ?? null;
  const discountAmt = selectedDiscount
    ? selectedDiscount.discount_type === "percentage"
      ? subtotal * (selectedDiscount.discount_value / 100)
      : Math.min(selectedDiscount.discount_value, subtotal)
    : 0;
  const afterDiscount = subtotal - discountAmt;
  const serviceChargeAmt = afterDiscount * (billing.service_charge_percentage / 100);
  const vatAmt = afterDiscount * (billing.vat_percentage / 100);
  const grandTotal = afterDiscount + serviceChargeAmt + vatAmt;

  // ── Filter items ───────────────────────────────────────────────────────────
  const visibleItems = activeCategory === "all" ? items : items.filter((i) => i.category_id === activeCategory);

  // ── Submit order ───────────────────────────────────────────────────────────
  const submitOrder = async () => {
    if (!name.trim())           { toast.error("Please enter your name"); return; }
    if (!phone.trim())          { toast.error("Please enter your phone number"); return; }
    if (!selectedTableId)       { toast.error("Please select your table"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/customer-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: rid,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          table_id: selectedTableId,
          subtotal,
          discount_amount: Math.round(discountAmt * 100) / 100,
          service_charge: Math.round(serviceChargeAmt * 100) / 100,
          vat_amount: Math.round(vatAmt * 100) / 100,
          total: Math.round(grandTotal * 100) / 100,
          items: cart.map((c) => ({
            food_item_id: c.id,
            name: c.name,
            quantity: c.quantity,
            unit_price: c.sell_price,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to place order"); return; }
      setOrderId(data.orderId);
      setOrderNumber(data.orderNumber);
      const now = Date.now();
      localPlacedAt.current = now;
      setConfirmedTs(now);
      setStep("confirmed");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-[#FD2400]" size={32} />
    </div>
  );

  if (!restaurant) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <UtensilsCrossed size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Restaurant not found</p>
      </div>
    </div>
  );

  // ── CONFIRMED ─────────────────────────────────────────────────────────────
  if (step === "confirmed") {
    const tableName = tables.find((t) => t.id === selectedTableId)?.name ?? savedTableName;
    const isReady    = (secsLeft === 0 && isConfirmedByAdmin) || orderStatus === "billed" || orderStatus === "completed";
    const isPreparing = isConfirmedByAdmin && !isReady;
    const isWaiting   = !isConfirmedByAdmin && !isReady;
    const phase = isReady ? "ready" : isPreparing ? "preparing" : "waiting";
    const stepIndex = phase === "waiting" ? 0 : phase === "preparing" ? 1 : 2;

    const timelineSteps = [
      { label: "Received", sublabel: "Order placed" },
      { label: "Preparing", sublabel: isConfirmedByAdmin ? `${countdownMins} min` : "Kitchen" },
      { label: "Ready",     sublabel: "Enjoy!" },
    ];

    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-700 ${isReady ? "bg-green-50" : "bg-gray-50"}`}>

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <div className="w-8 h-8 bg-[#FD2400] rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{restaurant.name[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{restaurant.name}</p>
            <p className="text-xs text-gray-400">#{orderNumber}{tableName ? ` · Table ${tableName}` : ""}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-4 gap-4">

          {/* ── HERO: state-driven big visual ─────────────────────────────── */}
          <div className={`rounded-3xl flex flex-col items-center justify-center py-10 px-6 text-center transition-all duration-700
            ${isReady ? "bg-green-500" : isConfirmedByAdmin ? "bg-[#FD2400]" : "bg-white border border-gray-100 shadow-sm"}`}>

            {/* WAITING */}
            {isWaiting && (
              <>
                <div className="relative w-24 h-24 mb-5">
                  <div className="absolute inset-0 rounded-full bg-[#FD2400]/10 animate-ping" />
                  <div className="absolute inset-3 rounded-full bg-[#FD2400]/10 animate-ping [animation-delay:0.4s]" />
                  <div className="relative w-full h-full rounded-full bg-orange-50 border-2 border-[#FD2400]/20 flex items-center justify-center">
                    <span className="text-4xl">🧾</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Order Placed!</h2>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">Waiting for the kitchen<br/>to confirm your order</p>
                <div className="flex gap-1.5 mt-5">
                  <span className="w-2 h-2 rounded-full bg-[#FD2400] animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#FD2400] animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-[#FD2400] animate-bounce [animation-delay:300ms]" />
                </div>
              </>
            )}

            {/* PREPARING — big countdown ring on red bg */}
            {isPreparing && (
              <>
                <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Kitchen confirmed</p>
                <div className="relative w-44 h-44">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="white" strokeWidth="7"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress)}`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white tabular-nums leading-none">{mm}:{ss}</span>
                    <span className="text-white/70 text-xs mt-1">minutes left</span>
                  </div>
                </div>
                <h2 className="text-white text-xl font-bold mt-5">Preparing your food 👨‍🍳</h2>
                <p className="text-white/70 text-sm mt-1">Est. {countdownMins} min</p>
              </>
            )}

            {/* READY — celebration */}
            {isReady && (
              <>
                <div className="text-6xl mb-3 animate-bounce">🎉</div>
                <h2 className="text-3xl font-bold text-white mb-2">Food is Ready!</h2>
                <p className="text-white/90 text-base">Thank you, {name}! 😊</p>
                <p className="text-white/70 text-sm mt-1">Enjoy your meal!</p>
                <div className="mt-4 flex gap-2">
                  <span className="text-2xl animate-bounce [animation-delay:0ms]">✨</span>
                  <span className="text-2xl animate-bounce [animation-delay:200ms]">🍽️</span>
                  <span className="text-2xl animate-bounce [animation-delay:400ms]">✨</span>
                </div>
              </>
            )}
          </div>

          {/* ── TIMELINE ─────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="relative flex items-start justify-between">
              {/* connecting line track */}
              <div className="absolute top-[14px] left-[calc(50%/3)] right-[calc(50%/3)] h-0.5 bg-gray-100" />
              {/* animated fill */}
              <div
                className="absolute top-[14px] left-[calc(50%/3)] h-0.5 bg-[#FD2400] transition-all duration-700"
                style={{ width: stepIndex === 0 ? "0%" : stepIndex === 1 ? "50%" : "100%",
                         right: "calc(50%/3)" }}
              />

              {timelineSteps.map((s, i) => {
                const done   = i <= stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.label} className="relative flex flex-col items-center gap-1.5 z-10 flex-1">
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-500
                      ${active ? "bg-[#FD2400] border-[#FD2400] scale-125 shadow-lg shadow-red-100"
                               : done ? "bg-[#FD2400] border-[#FD2400]"
                               : "bg-white border-gray-200"}`}>
                      {active && !isReady
                        ? <Loader2 size={12} className="text-white animate-spin" />
                        : done
                          ? <CheckCircle size={12} className="text-white" />
                          : <span className="text-gray-300 text-[10px]">○</span>}
                    </div>
                    <span className={`text-[11px] font-bold text-center transition-colors
                      ${active ? "text-[#FD2400]" : done ? "text-gray-700" : "text-gray-300"}`}>
                      {s.label}
                    </span>
                    <span className={`text-[10px] text-center transition-colors
                      ${active ? "text-orange-400" : done ? "text-gray-400" : "text-gray-200"}`}>
                      {s.sublabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── ORDER SUMMARY (collapsible) ───────────────────────────────── */}
          <details className="bg-white rounded-2xl border border-gray-100 shadow-sm group" open>
            <summary className="flex items-center justify-between p-4 cursor-pointer select-none list-none">
              <div>
                <p className="text-sm font-semibold text-gray-900">Order Summary</p>
                <p className="text-xs text-gray-400 mt-0.5">{cartCount} item{cartCount !== 1 ? "s" : ""} · ৳{grandTotal.toFixed(0)}</p>
              </div>
              <ChevronDown size={15} className="text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-gray-50 px-4 pb-4">
              <div className="pt-3 space-y-1.5">
                {cart.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{c.quantity}× {c.name}</span>
                    <span className="text-gray-800 font-medium">৳{(c.sell_price * c.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>৳{subtotal.toFixed(0)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-৳{discountAmt.toFixed(0)}</span></div>}
                {serviceChargeAmt > 0 && <div className="flex justify-between text-gray-500"><span>Service Charge ({billing.service_charge_percentage}%)</span><span>৳{serviceChargeAmt.toFixed(0)}</span></div>}
                {vatAmt > 0 && <div className="flex justify-between text-gray-500"><span>VAT ({billing.vat_percentage}%)</span><span>৳{vatAmt.toFixed(0)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                  <span>Total</span><span className="text-[#FD2400]">৳{grandTotal.toFixed(0)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-400">
                <span>💵 Cash</span><span>·</span><span>{name}</span>
                {tableName && <><span>·</span><span>Table {tableName}</span></>}
              </div>
            </div>
          </details>

          {/* ── NEW ORDER BUTTON ──────────────────────────────────────────── */}
          <button
            onClick={startNewOrder}
            className="w-full py-3.5 bg-white border-2 border-gray-200 hover:border-[#FD2400] hover:text-[#FD2400] text-gray-500 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Start a New Order
          </button>

          <p className="text-center text-[11px] text-gray-300 pb-2">Auto-updates every 8 seconds</p>
        </div>
      </div>
    );
  }

  // ── CHECKOUT ──────────────────────────────────────────────────────────────
  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setStep("menu")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">Checkout</p>
            <p className="text-xs text-gray-500">{cartCount} item{cartCount !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 pb-8">
          {/* Order items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Order</p>
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(c.id, -1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    {c.quantity === 1 ? <Trash2 size={10} className="text-red-400" /> : <Minus size={10} className="text-gray-600" />}
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-gray-800">{c.quantity}</span>
                  <button onClick={() => updateQty(c.id, 1)} className="w-6 h-6 rounded-full bg-[#FD2400] flex items-center justify-center">
                    <Plus size={10} className="text-white" />
                  </button>
                  <span className="text-sm text-gray-700 ml-1">{c.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">৳{(c.sell_price * c.quantity).toFixed(0)}</span>
              </div>
            ))}

            {/* Price breakdown */}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>৳{subtotal.toFixed(0)}</span></div>
              {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-৳{discountAmt.toFixed(0)}</span></div>}
              {billing.service_charge_percentage > 0 && <div className="flex justify-between text-gray-500"><span>Service Charge ({billing.service_charge_percentage}%)</span><span>৳{serviceChargeAmt.toFixed(0)}</span></div>}
              {billing.vat_percentage > 0 && <div className="flex justify-between text-gray-500"><span>VAT ({billing.vat_percentage}%)</span><span>৳{vatAmt.toFixed(0)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span><span className="text-[#FD2400]">৳{grandTotal.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Discount */}
          {discounts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Tag size={12} />Discount</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedDiscountId("")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${!selectedDiscountId ? "border-[#FD2400] bg-red-50 text-[#FD2400]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >
                  No Discount
                </button>
                {discounts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDiscountId(d.id === selectedDiscountId ? "" : d.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${selectedDiscountId === d.id ? "border-[#FD2400] bg-red-50 text-[#FD2400]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >
                    {d.name} ({d.discount_type === "percentage" ? `${d.discount_value}%` : `৳${d.discount_value}`})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Details</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FD2400] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-400">*</span></label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="01XXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FD2400] focus:border-transparent" />
            </div>
            {tables.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Table <span className="text-red-400">*</span>
                </label>
                <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#FD2400] focus:border-transparent bg-gray-50 ${!selectedTableId ? "border-red-200" : "border-gray-200"}`}>
                  <option value="">Select your table</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {!selectedTableId && <p className="text-xs text-red-500 mt-1">Table selection is required</p>}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Method</p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <div className="w-8 h-8 bg-[#FD2400] rounded-lg flex items-center justify-center text-sm">💵</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Cash</p>
                <p className="text-xs text-gray-500">Pay at the counter or to the waiter</p>
              </div>
              <div className="ml-auto w-4 h-4 rounded-full bg-[#FD2400] flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Place order */}
          <button onClick={submitOrder} disabled={submitting || !cart.length}
            className="w-full py-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting
              ? <><Loader2 size={18} className="animate-spin" /> Placing Order…</>
              : <>Place Order · ৳{grandTotal.toFixed(0)}</>}
          </button>
        </div>
      </div>
    );
  }

  // ── MENU ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-[#FD2400] rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-bold">{restaurant.name[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 leading-none truncate">{restaurant.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Tap items to add to your order</p>
          </div>
          <button onClick={() => setCartOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-[#FD2400] flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <ShoppingCart size={18} className="text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveCategory("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategory === "all" ? "bg-[#FD2400] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategory === cat.id ? "bg-[#FD2400] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu grid */}
      <div className="flex-1 p-4 pb-28">
        {visibleItems.length === 0 ? (
          <div className="text-center py-16">
            <UtensilsCrossed size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No items available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
            {visibleItems.map((item) => {
              const inCart = cart.find((c) => c.id === item.id);
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="w-full h-28 bg-red-50 flex items-center justify-center overflow-hidden">
                    {item.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      : <UtensilsCrossed size={28} className="text-red-200" />}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="text-sm font-bold text-[#FD2400]">৳{item.sell_price}</span>
                      {inCart ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center active:scale-95">
                            <Minus size={10} className="text-gray-600" />
                          </button>
                          <span className="text-xs font-bold text-gray-800 w-4 text-center">{inCart.quantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-full bg-[#FD2400] flex items-center justify-center active:scale-95">
                            <Plus size={10} className="text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-full bg-[#FD2400] flex items-center justify-center shadow-sm active:scale-95">
                          <Plus size={14} className="text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <button onClick={() => setStep("checkout")}
            className="w-full max-w-lg mx-auto flex items-center justify-between py-3.5 px-5 bg-gray-900 hover:bg-black text-white rounded-2xl transition-colors active:scale-[0.99] font-semibold">
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-xs font-bold">{cartCount}</span>
            <span className="text-sm">View Order</span>
            <span className="text-sm">৳{grandTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Cart ({cartCount})</p>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {cart.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">৳{c.sell_price} each</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => updateQty(c.id, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      {c.quantity === 1 ? <Trash2 size={11} className="text-red-400" /> : <Minus size={11} className="text-gray-600" />}
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-gray-800">{c.quantity}</span>
                    <button onClick={() => updateQty(c.id, 1)} className="w-7 h-7 rounded-full bg-[#FD2400] flex items-center justify-center">
                      <Plus size={11} className="text-white" />
                    </button>
                  </div>
                  <p className="w-16 text-right text-sm font-semibold text-gray-900">৳{(c.sell_price * c.quantity).toFixed(0)}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span>Total</span><span className="text-[#FD2400]">৳{grandTotal.toFixed(0)}</span>
              </div>
              <button onClick={() => { setCartOpen(false); setStep("checkout"); }}
                className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-2xl transition-colors">
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
