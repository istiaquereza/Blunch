"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import {
  ShoppingCart, Plus, Minus, ArrowLeft, Search,
  CheckCircle, Loader2, UtensilsCrossed, ChevronDown, X,
  Trash2, User, Phone,
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
const fmt = (n: number) => "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [search, setSearch]             = useState("");
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  // Order confirmation state
  const [orderId, setOrderId]           = useState<string | null>(null);
  const [orderNumber, setOrderNumber]   = useState<string | null>(null);
  const [orderStatus, setOrderStatus]   = useState("active");
  const [serverConfirmedAt, setServerConfirmedAt] = useState<string | null>(null);
  const [serverPrepMins, setServerPrepMins]       = useState<number | null>(null);
  const localPlacedAt                   = useRef<number | null>(null);
  const [confirmedTs, setConfirmedTs]   = useState<number | null>(null);

  // Form
  const [name, setName]                 = useState("");
  const [phone, setPhone]               = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedDiscountId, setSelectedDiscountId] = useState("");
  const [savedTableName, setSavedTableName] = useState("");

  // ── sessionStorage key ────────────────────────────────────────────────────
  const STORAGE_KEY = `co_order_${rid}`;

  // ── Restore from sessionStorage on mount ────────────────────────────────
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

  // ── Save to sessionStorage whenever confirmed state changes ──────────────
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

  // ── Fetch menu ───────────────────────────────────────────────────────────
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

  // ── Poll order status ────────────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/customer-order/${orderId}/status`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.status) setOrderStatus(d.status);
      if (d.confirmed_at && !serverConfirmedAt) {
        const prepMins = d.prep_time_minutes ?? PREP_MINUTES;
        setServerConfirmedAt(d.confirmed_at);
        setServerPrepMins(prepMins);
        setConfirmedTs(new Date(d.confirmed_at).getTime());
      }
    } catch { /* silent */ }
  }, [orderId, serverConfirmedAt]);

  useEffect(() => {
    if (step !== "confirmed" || !orderId) return;
    pollStatus();
    const id = setInterval(pollStatus, 5000);
    return () => clearInterval(id);
  }, [step, orderId, pollStatus]);

  // ── Countdown ────────────────────────────────────────────────────────────
  const countdownStartTs = serverConfirmedAt ? new Date(serverConfirmedAt).getTime() : confirmedTs;
  const countdownMins    = serverPrepMins ?? PREP_MINUTES;
  const { mm, ss, secsLeft } = useCountdown(countdownStartTs, countdownMins);
  const isConfirmedByAdmin   = !!serverConfirmedAt;
  const progress = countdownStartTs ? Math.max(0, secsLeft / (countdownMins * 60)) : 1;

  // ── Cart helpers ─────────────────────────────────────────────────────────
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

  const removeFromCart = (id: string) =>
    setCart((prev) => prev.filter((c) => c.id !== id));

  // ── Start a fresh new order ──────────────────────────────────────────────
  const startNewOrder = () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setCart([]); setOrderId(null); setOrderNumber(null);
    setName(""); setPhone(""); setSelectedTableId(""); setSavedTableName(""); setSelectedDiscountId("");
    setConfirmedTs(null); setServerConfirmedAt(null); setServerPrepMins(null);
    setOrderStatus("active"); setCartOpen(false); setStep("menu");
  };

  // ── Totals ───────────────────────────────────────────────────────────────
  const subtotal    = cart.reduce((s, c) => s + c.sell_price * c.quantity, 0);
  const cartCount   = cart.reduce((s, c) => s + c.quantity, 0);

  const selectedDiscount = discounts.find((d) => d.id === selectedDiscountId) ?? null;
  const discountAmt = selectedDiscount
    ? selectedDiscount.discount_type === "percentage"
      ? subtotal * (selectedDiscount.discount_value / 100)
      : Math.min(selectedDiscount.discount_value, subtotal)
    : 0;
  const afterDiscount    = subtotal - discountAmt;
  const serviceChargeAmt = afterDiscount * (billing.service_charge_percentage / 100);
  const vatAmt           = afterDiscount * (billing.vat_percentage / 100);
  const grandTotal       = afterDiscount + serviceChargeAmt + vatAmt;

  // ── Filter items ─────────────────────────────────────────────────────────
  const visibleItems = items
    .filter((i) => activeCategory === "all" || i.category_id === activeCategory)
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  // ── Submit order ─────────────────────────────────────────────────────────
  const submitOrder = async () => {
    if (!name.trim())       { toast.error("Please enter your name"); return; }
    if (!phone.trim())      { toast.error("Please enter your phone number"); return; }
    if (!selectedTableId)   { toast.error("Please select your table"); return; }
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading menu…</p>
      </div>
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
    const tableName  = tables.find((t) => t.id === selectedTableId)?.name ?? savedTableName;
    const isReady    = (secsLeft === 0 && isConfirmedByAdmin) || orderStatus === "billed" || orderStatus === "completed";
    const isPreparing = isConfirmedByAdmin && !isReady;
    const isWaiting   = !isConfirmedByAdmin && !isReady;
    const phase = isReady ? "ready" : isPreparing ? "preparing" : "waiting";
    const stepIndex = phase === "waiting" ? 0 : phase === "preparing" ? 1 : 2;

    const timelineSteps = [
      { label: "Received",  sublabel: "Order placed" },
      { label: "Preparing", sublabel: isConfirmedByAdmin ? `${countdownMins} min` : "Kitchen" },
      { label: "Ready",     sublabel: "Enjoy!" },
    ];

    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-700 ${isReady ? "bg-green-50" : "bg-gray-50"}`}>

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
              : <span className="text-orange-500 font-bold text-sm">{restaurant.name[0]}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{restaurant.name}</p>
            <p className="text-xs text-gray-400">#{orderNumber}{tableName ? ` · Table ${tableName}` : ""}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-4 gap-4">

          {/* Hero */}
          <div className={`rounded-3xl flex flex-col items-center justify-center py-10 px-6 text-center transition-all duration-700
            ${isReady ? "bg-green-500" : isConfirmedByAdmin ? "bg-orange-500" : "bg-white border border-gray-100 shadow-sm"}`}>

            {isWaiting && (
              <>
                <div className="relative w-24 h-24 mb-5">
                  <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping" />
                  <div className="absolute inset-3 rounded-full bg-orange-500/10 animate-ping [animation-delay:0.4s]" />
                  <div className="relative w-full h-full rounded-full bg-orange-50 border-2 border-orange-500/20 flex items-center justify-center">
                    <span className="text-4xl">🧾</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Order Placed!</h2>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">Waiting for the kitchen<br/>to confirm your order</p>
                <div className="flex gap-1.5 mt-5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </>
            )}

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

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="relative flex items-start justify-between">
              <div className="absolute top-[13px] left-[16.67%] right-[16.67%] h-0.5 bg-gray-100" />
              <div
                className="absolute top-[13px] left-[16.67%] h-0.5 bg-orange-500 transition-all duration-700"
                style={{ width: stepIndex === 0 ? "0%" : stepIndex === 1 ? "33.33%" : "66.66%" }}
              />
              {timelineSteps.map((s, i) => {
                const done   = i <= stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.label} className="relative flex flex-col items-center gap-1.5 z-10 w-[33.33%]">
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-500
                      ${active ? "bg-orange-500 border-orange-500 scale-125 shadow-lg shadow-orange-100"
                               : done ? "bg-orange-500 border-orange-500"
                               : "bg-white border-gray-200"}`}>
                      {active && !isReady
                        ? <Loader2 size={12} className="text-white animate-spin" />
                        : done
                          ? <CheckCircle size={12} className="text-white" />
                          : <span className="text-gray-300 text-[10px]">○</span>}
                    </div>
                    <span className={`text-[11px] font-bold text-center leading-tight transition-colors
                      ${active ? "text-orange-500" : done ? "text-gray-700" : "text-gray-300"}`}>
                      {s.label}
                    </span>
                    <span className={`text-[10px] text-center leading-tight transition-colors
                      ${active ? "text-orange-400" : done ? "text-gray-400" : "text-gray-200"}`}>
                      {s.sublabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary */}
          <details className="bg-white rounded-2xl border border-gray-100 shadow-sm group" open>
            <summary className="flex items-center justify-between p-4 cursor-pointer select-none list-none">
              <div>
                <p className="text-sm font-semibold text-gray-900">Order Summary</p>
                <p className="text-xs text-gray-400 mt-0.5">{cartCount} item{cartCount !== 1 ? "s" : ""} · {fmt(grandTotal)}</p>
              </div>
              <ChevronDown size={15} className="text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-gray-50 px-4 pb-4">
              <div className="pt-3 space-y-1.5">
                {cart.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{c.quantity}× {c.name}</span>
                    <span className="text-gray-800 font-medium">{fmt(c.sell_price * c.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(discountAmt)}</span></div>}
                {serviceChargeAmt > 0 && <div className="flex justify-between text-gray-500"><span>Service Charge ({billing.service_charge_percentage}%)</span><span>{fmt(serviceChargeAmt)}</span></div>}
                {vatAmt > 0 && <div className="flex justify-between text-gray-500"><span>VAT ({billing.vat_percentage}%)</span><span>{fmt(vatAmt)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                  <span>Total</span><span className="text-orange-500">{fmt(grandTotal)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-400">
                <span>💵 Cash</span><span>·</span><span>{name}</span>
                {tableName && <><span>·</span><span>Table {tableName}</span></>}
              </div>
            </div>
          </details>

          <button onClick={startNewOrder} className="bg-gray-900 text-white rounded-xl py-3 font-semibold text-sm w-full">
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
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => setStep("menu")} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <p className="font-bold text-gray-900 text-sm">Checkout</p>
            <p className="text-xs text-gray-400">{cartCount} item{cartCount !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">

          {/* Order items */}
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-700">{c.quantity}× {c.name}</span>
                <span className="text-sm font-medium text-gray-900">{fmt(c.sell_price * c.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Customer details */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Details</p>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone number *"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            {tables.length > 0 && (
              <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}
                className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${!selectedTableId ? "border-orange-300 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-700"}`}>
                <option value="">Select your table *</option>
                {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {/* Discount */}
          {discounts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</p>
              <select value={selectedDiscountId} onChange={(e) => setSelectedDiscountId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700">
                <option value="">No discount</option>
                {discounts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.discount_type === "percentage" ? `${d.discount_value}%` : fmt(d.discount_value)})</option>
                ))}
              </select>
            </div>
          )}

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount ({selectedDiscount?.name})</span><span>-{fmt(discountAmt)}</span></div>}
            {billing.service_charge_percentage > 0 && (
              <div className="flex justify-between text-gray-500"><span>Service Charge ({billing.service_charge_percentage}%)</span><span>{fmt(serviceChargeAmt)}</span></div>
            )}
            {billing.vat_percentage > 0 && (
              <div className="flex justify-between text-gray-500"><span>VAT ({billing.vat_percentage}%)</span><span>{fmt(vatAmt)}</span></div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2 mt-1">
              <span>Total</span><span>{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="py-3 rounded-xl text-sm font-medium border bg-gray-900 text-white border-gray-900">
                Cash
              </button>
            </div>
          </div>
        </div>

        {/* Fixed bottom button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <button onClick={submitOrder} disabled={submitting || !cart.length}
            className="w-full bg-gray-900 text-white font-bold text-base rounded-xl py-4 flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting
              ? <><Loader2 size={18} className="animate-spin" /> Placing Order…</>
              : <>Place Order — {fmt(grandTotal)}</>}
          </button>
        </div>
      </div>
    );
  }

  // ── MENU ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
              {restaurant.logo_url
                ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
                : <span className="text-orange-500 font-bold text-sm">{restaurant.name[0]}</span>}
            </div>
            <p className="font-bold text-gray-900 text-sm leading-none">{restaurant.name}</p>
          </div>
          {/* Cart icon */}
          <button onClick={() => cartCount > 0 && setCartOpen(true)} className="relative w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ShoppingCart size={16} className="text-gray-700" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2 relative">
          <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50" />
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
            <button onClick={() => setActiveCategory("all")}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium ${activeCategory === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              All
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium ${activeCategory === c.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto p-3 pb-40 grid grid-cols-2 gap-3">
        {visibleItems.map((item) => {
          const inCart = cart.find((c) => c.id === item.id);
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
              {item.image_url
                ? <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover" />
                : <div className="w-full h-28 bg-orange-50 flex items-center justify-center"><UtensilsCrossed size={24} className="text-orange-200" /></div>
              }
              <div className="p-3 flex-1 flex flex-col">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
                <p className="text-orange-600 font-bold text-sm mt-1">{fmt(item.sell_price)}</p>
                <div className="mt-2">
                  {inCart ? (
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                        <Minus size={12} className="text-gray-700" />
                      </button>
                      <span className="text-sm font-bold text-gray-900">{inCart.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                        <Plus size={12} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)} className="w-full bg-gray-900 text-white rounded-lg py-1.5 text-xs font-semibold">
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {visibleItems.length === 0 && (
          <div className="col-span-2 py-10 text-center">
            <UtensilsCrossed size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No items found</p>
          </div>
        )}
      </div>

      {/* Bottom bar — opens cart drawer, same as remote */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-100">
          <button onClick={() => setCartOpen(true)}
            className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-between px-4">
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-xs font-bold">{cartCount}</span>
            <span>View Cart</span>
            <span>{fmt(grandTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer — matches remote page style */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[90vh] flex flex-col">

            {/* Cart header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">Your Cart</p>
                <p className="text-xs text-gray-400">{cartCount} item{cartCount !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Cart items */}
              <div className="p-4 space-y-3">
                {cart.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{fmt(c.sell_price)} each</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateQty(c.id, -1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Minus size={12} className="text-gray-700" />
                      </button>
                      <span className="text-sm font-bold text-gray-900 w-5 text-center">{c.quantity}</span>
                      <button onClick={() => updateQty(c.id, 1)} className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                        <Plus size={12} className="text-white" />
                      </button>
                      <button onClick={() => removeFromCart(c.id)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center ml-1">
                        <Trash2 size={12} className="text-red-500" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-20 text-right">{fmt(c.sell_price * c.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Discount selector in cart */}
              {discounts.length > 0 && (
                <div className="px-4 pb-3">
                  <select value={selectedDiscountId} onChange={(e) => setSelectedDiscountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700">
                    <option value="">No discount</option>
                    {discounts.map(d => (
                      <option key={d.id} value={d.id}>{d.name} — {d.discount_type === "percentage" ? `${d.discount_value}%` : fmt(d.discount_value)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Totals in cart */}
              <div className="px-4 pb-4 space-y-1.5 text-sm border-t border-gray-50 pt-3">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(discountAmt)}</span></div>}
                {billing.service_charge_percentage > 0 && (
                  <div className="flex justify-between text-gray-500"><span>Service ({billing.service_charge_percentage}%)</span><span>{fmt(serviceChargeAmt)}</span></div>
                )}
                {billing.vat_percentage > 0 && (
                  <div className="flex justify-between text-gray-500"><span>VAT ({billing.vat_percentage}%)</span><span>{fmt(vatAmt)}</span></div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                  <span>Total</span><span>{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => { setCartOpen(false); setStep("checkout"); }}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3.5 font-semibold text-sm">
                Checkout — {fmt(grandTotal)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
