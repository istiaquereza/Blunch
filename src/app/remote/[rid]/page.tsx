"use client";

import { useState, useEffect, use, useMemo } from "react";
import {
  Search, Plus, Minus, Trash2, X,
  Printer, CheckCircle, User, Phone,
  ArrowLeft, UtensilsCrossed, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FoodItem { id: string; name: string; sell_price: number; description?: string; image_url?: string; category_id?: string; availability_type?: string; available_quantity?: number; }
interface Category { id: string; name: string; }
interface StaffMember { id: string; name: string; job_role?: string; photo_url?: string; staff_type?: string; }
interface TableItem { id: string; name: string; }
interface PayMethod { id: string; name: string; }
interface Discount { id: string; name: string; discount_type: "percentage" | "amount"; discount_value: number; }
interface BillingCfg { vat_percentage: number; service_charge_percentage: number; }
interface Restaurant { id: string; name: string; logo_url?: string; }
interface CrmCustomer { id: string; name: string; phone: string; }
interface CartItem extends FoodItem { quantity: number; }

interface OrderSession {
  localId: string;
  orderId: string | null;
  orderNumber: string | null;
  cart: CartItem[];
  printedCart: CartItem[];
  tableId: string;
  discountId: string;
  status: "active" | "billed";
  label: string;
}

type Screen = "staff" | "menu" | "billing" | "done";

const fmt = (n: number) => "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mkLocalId = () => Math.random().toString(36).slice(2, 9);

// Returns the lowest integer >= 1 not already used by active sessions
function nextOrderLabel(activeSessions: OrderSession[]): string {
  const used = new Set(
    activeSessions.map(s => {
      const m = s.label.match(/^Order (\d+)$/);
      return m ? parseInt(m[1]) : 0;
    })
  );
  let n = 1;
  while (used.has(n)) n++;
  return `Order ${n}`;
}

function newSession(label: string): OrderSession {
  return {
    localId: mkLocalId(),
    orderId: null,
    orderNumber: null,
    cart: [],
    printedCart: [],
    tableId: "",
    discountId: "",
    status: "active",
    label,
  };
}

// ─── Kitchen Print ──────────────────────────────────────────────────────────────
function printKitchen(
  restaurant: Restaurant,
  staff: StaffMember,
  cart: CartItem[],
  orderNumber?: string,
  tableId?: string,
  tables?: TableItem[]
) {
  const tableName = tableId ? tables?.find(t => t.id === tableId)?.name ?? "" : "";
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.write(`
    <html><head><title>Kitchen Slip</title>
    <style>
      body { font-family: monospace; font-size: 13px; padding: 12px; max-width: 300px; }
      h2 { font-size: 15px; text-align: center; margin: 0 0 4px; }
      .sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 8px; }
      hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
      .item { display: flex; justify-content: space-between; padding: 3px 0; }
      .qty { font-weight: bold; min-width: 28px; }
      .meta { font-size: 11px; color: #555; }
    </style></head><body>
    <h2>${restaurant.name}</h2>
    <div class="sub">KOT</div>
    <hr/>
    <div class="meta">Order: <b>${orderNumber ?? "—"}</b></div>
    ${tableName ? `<div class="meta">Table: <b>${tableName}</b></div>` : ""}
    <div class="meta">Staff: <b>${staff.name}</b></div>
    <div class="meta">Time: <b>${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</b></div>
    <hr/>
    ${cart.map(i => `<div class="item"><span class="qty">${i.quantity}x</span><span>${i.name}</span></div>`).join("")}
    <hr/>
    <div class="meta" style="text-align:center">— End of slip —</div>
    </body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function RemotePage({ params }: { params: Promise<{ rid: string }> }) {
  const { rid } = use(params);

  // Remote data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedTableIds, setOccupiedTableIds] = useState<string[]>([]);
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomer[]>([]);
  const [payMethods, setPayMethods] = useState<PayMethod[]>([]);
  const [billingCfg, setBillingCfg] = useState<BillingCfg>({ vat_percentage: 0, service_charge_percentage: 0 });
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [screen, setScreen] = useState<Screen>("staff");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null); // localId of session to cancel

  // Multi-order — restore from localStorage on mount so page refresh doesn't orphan orders
  const LS_SESSIONS = `remote_sessions_${rid}`;
  const freshSession = useMemo(() => newSession("Order 1"), []);
  const [sessions, setSessions] = useState<OrderSession[]>([freshSession]);
  const [activeLocalId, setActiveLocalId] = useState<string>(freshSession.localId);

  // Restore saved sessions from localStorage (runs once after mount, client-side only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_SESSIONS);
      if (saved) {
        const parsed: OrderSession[] = JSON.parse(saved);
        const active = parsed.filter(s => s.status === "active");
        if (active.length > 0) {
          setSessions(active);
          setActiveLocalId(active[0].localId);
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Billing form (for billing screen, reset per order)
  const [customerName, setCustomerName] = useState("");
  const [crmSuggestions, setCrmSuggestions] = useState<CrmCustomer[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [payMethodId, setPayMethodId] = useState("");

  const LS_STAFF = `remote_staff_${rid}`;

  // Persist sessions to localStorage whenever they change
  useEffect(() => {
    try {
      const active = sessions.filter(s => s.status === "active");
      if (active.length > 0) {
        localStorage.setItem(LS_SESSIONS, JSON.stringify(active));
      } else {
        localStorage.removeItem(LS_SESSIONS);
      }
    } catch { /* ignore */ }
  }, [sessions, LS_SESSIONS]);

  const activeSession = sessions.find(s => s.localId === activeLocalId) ?? sessions[0];
  const activeSessions = sessions.filter(s => s.status === "active");

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateSession = (localId: string, patch: Partial<OrderSession>) => {
    setSessions(prev => prev.map(s => s.localId === localId ? { ...s, ...patch } : s));
  };

  const addNewOrder = () => {
    setSessions(prev => {
      const active = prev.filter(s => s.status === "active");
      const s = newSession(nextOrderLabel(active));
      setActiveLocalId(s.localId);
      return [...prev, s];
    });
    setCartOpen(false);
  };

  const switchSession = (localId: string) => {
    setActiveLocalId(localId);
    setCartOpen(false);
  };

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/remote-order/${rid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error("Failed to load menu"); return; }
        setRestaurant(d.restaurant);
        setItems(d.items);
        setCategories(d.categories);
        setStaffList(d.staff);
        setTables(d.tables);
        setOccupiedTableIds(d.occupiedTableIds ?? []);
        setCrmCustomers(d.customers ?? []);
        setPayMethods(d.paymentMethods);
        setBillingCfg(d.billing);
        setDiscounts(d.discounts);
        try {
          const saved = localStorage.getItem(LS_STAFF);
          if (saved) {
            const parsed = JSON.parse(saved);
            const found = d.staff.find((s: StaffMember) => s.id === parsed.id);
            if (found) { setSelectedStaff(found); setScreen("menu"); }
          }
        } catch { /* ignore */ }
      })
      .catch(() => toast.error("Network error"))
      .finally(() => setLoading(false));
  }, [rid, LS_STAFF]);

  // ── Cart helpers (operate on activeSession) ──────────────────────────────────
  const addToCart = (item: FoodItem) => {
    const s = activeSession;
    updateSession(s.localId, {
      cart: s.cart.find(c => c.id === item.id)
        ? s.cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...s.cart, { ...item, quantity: 1 }],
    });
  };

  const updateQty = (id: string, delta: number) => {
    updateSession(activeSession.localId, {
      cart: activeSession.cart
        .map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c)
        .filter(c => c.quantity > 0),
    });
  };

  const removeFromCart = (id: string) => {
    updateSession(activeSession.localId, { cart: activeSession.cart.filter(c => c.id !== id) });
  };

  // ── Totals ───────────────────────────────────────────────────────────────────
  const discount = discounts.find(d => d.id === activeSession.discountId);
  const subtotal = activeSession.cart.reduce((s, c) => s + c.sell_price * c.quantity, 0);
  const discountAmt = discount
    ? discount.discount_type === "percentage"
      ? subtotal * discount.discount_value / 100
      : discount.discount_value
    : 0;
  const afterDiscount = subtotal - discountAmt;
  const serviceCharge = afterDiscount * billingCfg.service_charge_percentage / 100;
  const vatAmt = (afterDiscount + serviceCharge) * billingCfg.vat_percentage / 100;
  const total = afterDiscount + serviceCharge + vatAmt;
  const cartCount = activeSession.cart.reduce((s, c) => s + c.quantity, 0);

  // New items since last kitchen print
  const newItems = useMemo(() => {
    return activeSession.cart.map(ci => {
      const printed = activeSession.printedCart.find(p => p.id === ci.id);
      const newQty = ci.quantity - (printed?.quantity ?? 0);
      return newQty > 0 ? { ...ci, quantity: newQty } : null;
    }).filter(Boolean) as CartItem[];
  }, [activeSession.cart, activeSession.printedCart]);

  // ── Kitchen print ────────────────────────────────────────────────────────────
  const handleKitchen = async () => {
    if (!selectedStaff || activeSession.cart.length === 0) return;
    if (tables.length > 0 && !activeSession.tableId) { toast.error("Please select a table first"); return; }
    setSubmitting(true);
    try {
      const sess = activeSession;
      if (!sess.orderId) {
        const res = await fetch(`/api/remote-order/${rid}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staff_id: selectedStaff.id,
            table_id: sess.tableId || null,
            items: sess.cart.map(c => ({ food_item_id: c.id, quantity: c.quantity, unit_price: c.sell_price })),
          }),
        });
        const data = await res.json();
        if (data.orderId) {
          updateSession(sess.localId, { orderId: data.orderId, orderNumber: data.orderNumber, printedCart: [...sess.cart] });
          printKitchen(restaurant!, selectedStaff, sess.cart, data.orderNumber, sess.tableId, tables);
          toast.success("Order sent to kitchen!");
        }
      } else if (newItems.length > 0) {
        await fetch(`/api/remote-order/${rid}/orders/${sess.orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_items", items: newItems.map(c => ({ food_item_id: c.id, quantity: c.quantity, unit_price: c.sell_price })) }),
        });
        updateSession(sess.localId, { printedCart: [...sess.cart] });
        printKitchen(restaurant!, selectedStaff, newItems, sess.orderNumber ?? undefined, sess.tableId, tables);
        toast.success("Additional items sent!");
      } else {
        printKitchen(restaurant!, selectedStaff, sess.cart, sess.orderNumber ?? undefined, sess.tableId, tables);
        toast.success("Reprinted!");
      }
    } catch { toast.error("Failed to send to kitchen"); }
    finally { setSubmitting(false); }
  };

  // ── Bill ─────────────────────────────────────────────────────────────────────
  const handleBill = async () => {
    if (!payMethodId) { toast.error("Select a payment method"); return; }
    if (!selectedStaff) return;
    if (activeSession.cart.length === 0) { toast.error("Cart is empty"); return; }
    if (tables.length > 0 && !activeSession.tableId) { toast.error("Please select a table first"); return; }
    setSubmitting(true);
    try {
      const sess = activeSession;
      let oid = sess.orderId;
      let onum = sess.orderNumber;

      // If kitchen print was skipped, create the order now
      if (!oid) {
        const res = await fetch(`/api/remote-order/${rid}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staff_id: selectedStaff.id,
            table_id: sess.tableId || null,
            items: sess.cart.map(c => ({ food_item_id: c.id, quantity: c.quantity, unit_price: c.sell_price })),
          }),
        });
        const data = await res.json();
        if (!data.orderId) { toast.error("Failed to create order"); return; }
        oid = data.orderId;
        onum = data.orderNumber;
        updateSession(sess.localId, { orderId: oid, orderNumber: onum });
      }

      await fetch(`/api/remote-order/${rid}/orders/${oid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bill",
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method_id: payMethodId,
          subtotal,
          discount_amount: discountAmt,
          vat_amount: vatAmt,
          service_charge: serviceCharge,
          total,
        }),
      });

      updateSession(activeLocalId, { status: "billed" });
      setScreen("done");
    } catch { toast.error("Failed to complete order"); }
    finally { setSubmitting(false); }
  };

  // After billing: remove session and go back
  const afterDone = (startNew: boolean) => {
    const remaining = sessions.filter(s => s.localId !== activeLocalId);
    // Clear completed session from localStorage
    try {
      const stillActive = remaining.filter(s => s.status === "active");
      if (stillActive.length === 0) localStorage.removeItem(LS_SESSIONS);
    } catch { /* ignore */ }
    const remainingActive = remaining.filter(s => s.status === "active");
    if (startNew || remainingActive.length === 0) {
      const fresh = newSession(nextOrderLabel(remainingActive));
      setSessions(startNew ? [...remaining, fresh] : [fresh]);
      setActiveLocalId(fresh.localId);
    } else {
      const next = remainingActive[0];
      setSessions(remaining);
      setActiveLocalId(next.localId);
    }
    setCustomerName(""); setCustomerPhone(""); setPayMethodId("");
    setScreen("menu");
  };

  // ── Cancel order ─────────────────────────────────────────────────────────────
  const handleCancel = async (localId: string) => {
    const sess = sessions.find(s => s.localId === localId);
    if (!sess) return;
    setSubmitting(true);
    try {
      // If already sent to kitchen, cancel on backend
      if (sess.orderId) {
        await fetch(`/api/remote-order/${rid}/orders/${sess.orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        });
      }
      // Remove session locally
      const remaining = sessions.filter(s => s.localId !== localId);
      const remainingActive = remaining.filter(s => s.status === "active");
      if (remainingActive.length === 0) {
        const fresh = newSession(nextOrderLabel([]));
        setSessions([...remaining, fresh]);
        setActiveLocalId(fresh.localId);
      } else {
        setSessions(remaining);
        if (activeLocalId === localId) {
          setActiveLocalId(remainingActive[0].localId);
        }
      }
      setCartOpen(false);
      setCancelTarget(null);
      toast.success(sess.orderId ? "Order cancelled" : "Order cleared");
    } catch {
      toast.error("Failed to cancel order");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeCategory !== "all") list = list.filter(i => i.category_id === activeCategory);
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [items, activeCategory, search]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading menu…</p>
      </div>
    </div>
  );

  // ── Staff Select ─────────────────────────────────────────────────────────────
  if (screen === "staff") return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
            {restaurant?.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
              : <span className="text-orange-500 font-bold text-sm">{restaurant?.name?.[0] ?? "B"}</span>}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{restaurant?.name}</p>
            <p className="text-xs text-gray-400">Who is taking this order?</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {staffList.map(s => (
          <button
            key={s.id}
            onClick={() => {
              setSelectedStaff(s);
              try { localStorage.setItem(LS_STAFF, JSON.stringify(s)); } catch { /* ignore */ }
              setScreen("menu");
            }}
            className="w-full bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 text-left hover:border-orange-300 hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden">
              {s.photo_url
                ? <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                : <span className="text-orange-600 font-bold text-sm">{s.name[0]}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
              {s.job_role && <p className="text-xs text-gray-400">{s.job_role}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${s.staff_type === "kitchen" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
              {s.staff_type ?? "staff"}
            </span>
          </button>
        ))}
        {staffList.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">No staff found. Add staff in the Staff Information page.</p>
        )}
      </div>
    </div>
  );

  // ── Done Screen ──────────────────────────────────────────────────────────────
  if (screen === "done") return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle size={32} className="text-green-500" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">Order Complete!</p>
        <p className="text-sm text-gray-500 mt-1">#{sessions.find(s => s.localId === activeLocalId)?.orderNumber}</p>
        <p className="text-xs text-gray-400 mt-0.5">Total: {fmt(total)}</p>
      </div>
      {/* If there are other active orders, show them */}
      {activeSessions.filter(s => s.localId !== activeLocalId).length > 0 && (
        <div className="w-full max-w-xs space-y-2">
          <p className="text-xs text-gray-500 font-medium">Other active orders:</p>
          {activeSessions.filter(s => s.localId !== activeLocalId).map(s => (
            <button key={s.localId} onClick={() => { setActiveLocalId(s.localId); setScreen("menu"); setCustomerName(""); setCustomerPhone(""); setPayMethodId(""); }}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 flex items-center justify-between hover:border-orange-300 transition-colors">
              <span>{s.label}</span>
              <span className="text-xs text-gray-400">{s.cart.reduce((a, c) => a + c.quantity, 0)} items</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => afterDone(true)} className="bg-gray-900 text-white rounded-xl px-8 py-3 font-semibold text-sm w-full max-w-xs">
        New Order
      </button>
      <button onClick={() => {
        try { localStorage.removeItem(LS_STAFF); } catch { /* ignore */ }
        setSelectedStaff(null);
        afterDone(false);
        setScreen("staff");
      }} className="text-sm text-gray-400 underline">Change staff</button>
    </div>
  );

  // ── Billing Screen ───────────────────────────────────────────────────────────
  if (screen === "billing") return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => setScreen("menu")} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <p className="font-bold text-gray-900 text-sm">Bill — {activeSession.label}</p>
          {activeSession.orderNumber && <p className="text-xs text-gray-400">#{activeSession.orderNumber}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">
        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {activeSession.cart.map(c => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-700">{c.quantity}× {c.name}</span>
              <span className="text-sm font-medium text-gray-900">{fmt(c.sell_price * c.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Customer */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer (optional)</p>
          {/* Name with CRM autocomplete */}
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={customerName}
              onChange={e => {
                const v = e.target.value;
                setCustomerName(v);
                if (v.trim().length >= 1) {
                  const q = v.toLowerCase();
                  setCrmSuggestions(crmCustomers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6));
                } else {
                  setCrmSuggestions([]);
                }
              }}
              onBlur={() => setTimeout(() => setCrmSuggestions([]), 150)}
              placeholder="Customer name"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            {crmSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-11 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                {crmSuggestions.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={() => { setCustomerName(c.name); setCustomerPhone(c.phone); setCrmSuggestions([]); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left">
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone number" type="tel"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Method *</p>
          <div className="grid grid-cols-2 gap-2">
            {payMethods.map(m => (
              <button key={m.id} onClick={() => setPayMethodId(m.id)}
                className={`py-3 rounded-xl text-sm font-medium border transition-all ${payMethodId === m.id ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {discountAmt > 0 && <div className="flex justify-between text-red-600"><span>Discount ({discount?.name})</span><span>-{fmt(discountAmt)}</span></div>}
          {billingCfg.service_charge_percentage > 0 && (
            <div className="flex justify-between text-gray-500"><span>Service Charge ({billingCfg.service_charge_percentage}%)</span><span>{fmt(serviceCharge)}</span></div>
          )}
          {billingCfg.vat_percentage > 0 && (
            <div className="flex justify-between text-gray-500"><span>VAT ({billingCfg.vat_percentage}%)</span><span>{fmt(vatAmt)}</span></div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2 mt-1">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button onClick={handleBill} disabled={submitting || !payMethodId}
          className="w-full bg-gray-900 text-white rounded-xl py-4 font-bold text-base disabled:opacity-50">
          {submitting ? "Processing…" : `Complete — ${fmt(total)}`}
        </button>
      </div>
    </div>
  );

  // ── Menu Screen ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo + restaurant name */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
              {restaurant?.logo_url
                ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
                : <span className="text-orange-500 font-bold text-sm">{restaurant?.name?.[0] ?? "B"}</span>}
            </div>
            <p className="font-bold text-gray-900 text-sm leading-none">{restaurant?.name}</p>
          </div>
          {/* Staff name — right side */}
          <button
            onClick={() => { try { localStorage.removeItem(LS_STAFF); } catch { /* ignore */ } setSelectedStaff(null); setScreen("staff"); }}
            className="flex items-center gap-1.5"
          >
            <span className="text-sm font-semibold text-gray-800">{selectedStaff?.name}</span>
            <span className="text-[10px] text-orange-500 font-medium">· change</span>
          </button>
        </div>

        {/* Multi-order tabs */}
        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
          {activeSessions.map(s => (
            <div key={s.localId} className={`shrink-0 h-9 rounded-xl flex items-center gap-1.5 pl-4 pr-2 text-sm font-semibold transition-colors ${s.localId === activeLocalId ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              <button onClick={() => switchSession(s.localId)} className="flex items-center gap-2">
                {s.label}
                {s.cart.length > 0 && (
                  <span className={`min-w-[20px] h-5 px-1 rounded-full text-[11px] flex items-center justify-center font-bold ${s.localId === activeLocalId ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"}`}>
                    {s.cart.reduce((a, c) => a + c.quantity, 0)}
                  </span>
                )}
              </button>
              <button onClick={() => setCancelTarget(s.localId)}
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${s.localId === activeLocalId ? "hover:bg-white/20" : "hover:bg-gray-200"}`}>
                <X size={11} />
              </button>
            </div>
          ))}
          <button onClick={addNewOrder}
            className="shrink-0 h-9 w-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center text-xl font-light hover:bg-orange-100 hover:text-orange-600 transition-colors">
            +
          </button>
        </div>

        {/* Table selector — mandatory */}
        {tables.length > 0 && (
          <div className="px-4 pb-2">
            <select value={activeSession.tableId}
              onChange={e => updateSession(activeSession.localId, { tableId: e.target.value })}
              className={`h-8 px-3 rounded-lg border text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 w-full ${
                !activeSession.tableId ? "border-orange-300 bg-orange-50 text-orange-700" : "border-gray-200"
              }`}>
              <option value="">Select table *</option>
              {tables.map(t => {
                // Allow current session's own table; disable tables occupied by DB orders
                const sessionTableIds = sessions.filter(s => s.localId !== activeSession.localId).map(s => s.tableId);
                const isOccupied = (occupiedTableIds.includes(t.id) && t.id !== activeSession.tableId)
                  || sessionTableIds.includes(t.id);
                return (
                  <option key={t.id} value={t.id} disabled={isOccupied}>
                    {t.name}{isOccupied ? " (occupied)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pb-2 relative">
          <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50" />
        </div>

        {/* Category pills */}
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
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-3 pb-40 grid grid-cols-2 gap-3">
        {filteredItems.map(item => {
          const inCart = activeSession.cart.find(c => c.id === item.id);
          const isQty = item.availability_type === "quantity";
          const avail = item.available_quantity ?? 0;
          const unavailable = item.availability_type === "none" || (isQty && avail <= 0);
          return (
            <div key={item.id} className={`bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col ${unavailable ? "opacity-60" : ""}`}>
              <div className="relative">
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover" />
                  : <div className="w-full h-28 bg-orange-50 flex items-center justify-center"><UtensilsCrossed size={24} className="text-orange-200" /></div>
                }
                {unavailable && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <span className="text-[10px] font-bold text-red-500 bg-white px-2 py-0.5 rounded-full border border-red-200">Unavailable</span>
                  </div>
                )}
                {isQty && !unavailable && avail <= 5 && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">{avail} left</span>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
                <p className="text-orange-600 font-bold text-sm mt-1">{fmt(item.sell_price)}</p>
                <div className="mt-2">
                  {unavailable ? (
                    <div className="w-full bg-gray-100 text-gray-400 rounded-lg py-1.5 text-xs font-semibold text-center">Unavailable</div>
                  ) : inCart ? (
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                        <Minus size={12} className="text-gray-700" />
                      </button>
                      <span className="text-sm font-bold text-gray-900">{inCart.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        disabled={isQty && inCart.quantity >= avail}
                        className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center disabled:opacity-40">
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
        {filteredItems.length === 0 && (
          <div className="col-span-2 py-10 text-center text-sm text-gray-400">No items found</div>
        )}
      </div>

      {/* Bottom bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-100">
          <button onClick={() => setCartOpen(true)}
            className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-between px-4">
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-xs font-bold">{cartCount}</span>
            <span>View Cart — {activeSession.label}</span>
            <span>{fmt(subtotal)}</span>
          </button>
        </div>
      )}

      {/* Cancel confirm modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCancelTarget(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">
                {sessions.find(s => s.localId === cancelTarget)?.orderId
                  ? "Cancel this order?"
                  : "Discard this order?"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {sessions.find(s => s.localId === cancelTarget)?.orderId
                  ? "The kitchen order will be marked as cancelled in the system."
                  : "This will clear all items. No changes have been sent to the kitchen."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setCancelTarget(null)}
                className="py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
                Keep it
              </button>
              <button onClick={() => handleCancel(cancelTarget!)} disabled={submitting}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">
                {submitting ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[90vh] flex flex-col">
            {/* Cart header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900">{activeSession.label}</p>
                {activeSession.orderNumber && <p className="text-xs text-gray-400">#{activeSession.orderNumber}</p>}
              </div>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Cart items */}
              <div className="p-4 space-y-3">
                {activeSession.cart.map(c => (
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
                  <select value={activeSession.discountId}
                    onChange={e => updateSession(activeSession.localId, { discountId: e.target.value })}
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
                {discountAmt > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{fmt(discountAmt)}</span></div>}
                {billingCfg.service_charge_percentage > 0 && (
                  <div className="flex justify-between text-gray-500"><span>Service ({billingCfg.service_charge_percentage}%)</span><span>{fmt(serviceCharge)}</span></div>
                )}
                {billingCfg.vat_percentage > 0 && (
                  <div className="flex justify-between text-gray-500"><span>VAT ({billingCfg.vat_percentage}%)</span><span>{fmt(vatAmt)}</span></div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                  <span>Total</span><span>{fmt(total)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleKitchen} disabled={submitting}
                  className="flex items-center justify-center gap-2 bg-gray-100 text-gray-800 rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50">
                  <Printer size={16} />
                  KOT
                </button>
                <button
                  onClick={() => { setCartOpen(false); setScreen("billing"); }}
                  disabled={submitting || activeSession.cart.length === 0}
                  className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50">
                  Bill
                </button>
              </div>

              <button
                onClick={() => { setCancelTarget(activeSession.localId); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors">
                <AlertTriangle size={14} />
                {activeSession.orderId ? "Cancel & void this order" : "Discard this order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
