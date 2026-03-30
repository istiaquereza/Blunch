"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useCustomers, type Customer } from "@/hooks/use-customers";
import {
  Users, Search, Plus, Phone, Pencil, Trash2,
  UserCircle, ChevronDown, ShoppingBag, TrendingUp, Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderHistoryEntry {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  paymentMethod: string;
  itemCount: number;
  items: { name: string; quantity: number }[];
}
interface CustomerOrderStat {
  count: number;
  totalSpent: number;
  lastVisit: string;
  orders: OrderHistoryEntry[];
}
type CustomerTab = "all" | "today" | "unique" | "repeat" | "top";

// ─── Add/Edit Dialog ──────────────────────────────────────────────────────────
interface CustomerFormProps {
  initial?: Customer;
  onSave: (name: string, phone?: string) => Promise<{ error: unknown }>;
  onClose: () => void;
}
function CustomerForm({ initial, onSave, onClose }: CustomerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    const { error: err } = await onSave(name.trim(), phone.trim() || undefined);
    setSaving(false);
    if (err) { setError(String(err)); return; }
    onClose();
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Full Name *" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Rahim Uddin" autoFocus />
      <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 01712345678" type="tel" />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>{initial ? "Save Changes" : "Add Customer"}</Button>
      </div>
    </form>
  );
}

function DeleteConfirm({ customer, onConfirm, onClose }: { customer: Customer; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Remove <span className="font-semibold text-gray-900">{customer.name}</span> from your customer list? This action cannot be undone.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); onClose(); }}>Remove Customer</Button>
      </div>
    </div>
  );
}

const fmt = (n: number) => "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS: { value: CustomerTab; label: string }[] = [
  { value: "all",    label: "All" },
  { value: "today",  label: "Today" },
  { value: "unique", label: "Unique Customer" },
  { value: "repeat", label: "Repeat Customer" },
  { value: "top",    label: "Top Customer" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const { activeRestaurant, isSuperAdmin, getUserRole } = useRestaurant();
  const { customers, loading, create, update, remove } = useCustomers(activeRestaurant?.id);
  const canDelete = isSuperAdmin || ["owner", "super_admin"].includes(getUserRole(activeRestaurant?.id ?? "") ?? "");

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CustomerTab>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<Record<string, CustomerOrderStat>>({});

  useEffect(() => {
    if (!activeRestaurant) { setOrderStats({}); return; }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total, created_at, payment_methods(name), order_items(id, quantity, food_items(name))")
        .eq("restaurant_id", activeRestaurant.id)
        .eq("status", "completed")
        .not("customer_id", "is", null)
        .order("created_at", { ascending: false });
      if (!data) return;
      const map: Record<string, CustomerOrderStat> = {};
      (data as any[]).forEach((order) => {
        const cid = order.customer_id as string;
        if (!map[cid]) map[cid] = { count: 0, totalSpent: 0, lastVisit: order.created_at, orders: [] };
        map[cid].count++;
        map[cid].totalSpent += order.total ?? 0;
        if (map[cid].orders.length === 0) map[cid].lastVisit = order.created_at;
        map[cid].orders.push({
          id: order.id,
          orderNumber: order.order_number ?? "—",
          date: order.created_at,
          total: order.total ?? 0,
          paymentMethod: order.payment_methods?.name ?? "—",
          itemCount: Array.isArray(order.order_items) ? order.order_items.length : 0,
          items: Array.isArray(order.order_items)
            ? order.order_items.map((oi: any) => ({ name: oi.food_items?.name ?? "Unknown", quantity: oi.quantity ?? 1 }))
            : [],
        });
      });
      setOrderStats(map);
    })();
  }, [activeRestaurant?.id]);

  const totalVisits  = Object.values(orderStats).reduce((s, v) => s + v.count, 0);
  const totalRevenue = Object.values(orderStats).reduce((s, v) => s + v.totalSpent, 0);
  const repeatCount  = Object.values(orderStats).filter(v => v.count > 1).length;
  const uniqueCount  = Object.values(orderStats).filter(v => v.count === 1).length;

  // Search filter
  const searched = useMemo(() => customers.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  }), [customers, search]);

  // Tab filter
  const tabFiltered = useMemo(() => {
    const todayStr = new Date().toDateString();
    let result = searched;
    if (tab === "today") {
      result = result.filter(c => orderStats[c.id]?.orders.some(o => new Date(o.date).toDateString() === todayStr));
    } else if (tab === "unique") {
      result = result.filter(c => orderStats[c.id]?.count === 1);
    } else if (tab === "repeat") {
      result = result.filter(c => (orderStats[c.id]?.count ?? 0) > 1);
    } else if (tab === "top") {
      result = [...result].sort((a, b) => (orderStats[b.id]?.totalSpent ?? 0) - (orderStats[a.id]?.totalSpent ?? 0));
    }
    return result;
  }, [searched, tab, orderStats]);

  return (
    <>
      <Header title="CRM" />

      <div className="p-6 space-y-4">

        {/* ── Tabs + toolbar ── */}
        <div className="shrink-0 h-[62px] flex items-center px-[14px] gap-4 overflow-x-auto bg-white rounded-xl border border-border shadow-sm justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${tab === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {t.value === "top" && <Star size={11} />}
                {t.label}
                {t.value === "unique" && <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${tab === t.value ? "bg-gray-100 text-gray-700" : "bg-white text-gray-500"}`}>{uniqueCount}</span>}
                {t.value === "repeat" && <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${tab === t.value ? "bg-gray-100 text-gray-700" : "bg-white text-gray-500"}`}>{repeatCount}</span>}
              </button>
            ))}
          </div>
          {/* Add + Search */}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)} disabled={!activeRestaurant}>
              <Plus size={13} /> Add Customer
            </Button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
                className="w-52 h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-[18px]">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0"><Users size={18} className="text-orange-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><UserCircle size={18} className="text-blue-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Repeat Customers</p>
              <p className="text-xl font-bold text-gray-900">{repeatCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><ShoppingBag size={18} className="text-green-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Visits</p>
              <p className="text-xl font-bold text-gray-900">{totalVisits}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><TrendingUp size={18} className="text-purple-500" /></div>
            <div>
              <p className="text-xs text-gray-500">CRM Revenue</p>
              <p className="text-lg font-bold text-gray-900">{fmt(totalRevenue)}</p>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading customers…</div>
            ) : !activeRestaurant ? (
              <div className="p-8 text-center text-sm text-gray-400">Select a restaurant to view customers.</div>
            ) : tabFiltered.length === 0 ? (
              <div className="p-12 text-center">
                <Users size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  {search ? "No customers match your search" : tab !== "all" ? `No ${TABS.find(t => t.value === tab)?.label.toLowerCase()} found` : "No customers yet"}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Visits</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Total Spent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Last Visit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tabFiltered.map((c, idx) => {
                    const stats = orderStats[c.id];
                    const isExpanded = expandedId === c.id;
                    const isTop = tab === "top" && idx < 3;
                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? "bg-orange-50/40" : ""}`}
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {tab === "top" && idx === 0 ? <span className="text-yellow-500 font-bold">🥇</span>
                              : tab === "top" && idx === 1 ? <span className="text-gray-400 font-bold">🥈</span>
                              : tab === "top" && idx === 2 ? <span className="text-orange-400 font-bold">🥉</span>
                              : <span className={isTop ? "font-bold" : ""}>{idx + 1}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-orange-600">{c.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{c.name}</span>
                              {stats && stats.count > 1 && (
                                <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 rounded-full px-1.5 py-0.5 font-semibold">Repeat</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                <Phone size={12} />{c.phone}
                              </a>
                            ) : <span className="text-sm text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {stats ? (
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                                <ShoppingBag size={12} className="text-orange-400" />{stats.count}
                              </span>
                            ) : <span className="text-sm text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {stats ? <span className="text-sm font-semibold text-green-600">{fmt(stats.totalSpent)}</span>
                              : <span className="text-sm text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {stats
                              ? new Date(stats.lastVisit).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                              : new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={e => { e.stopPropagation(); setEditTarget(c); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Edit">
                                <Pencil size={14} />
                              </button>
                              {canDelete && (
                                <button onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <ChevronDown size={14} className={`text-gray-400 ml-1 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-orange-50/20 border-b border-orange-100/60">
                            <td colSpan={7} className="px-6 py-4">
                              {!stats || stats.orders.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">No completed orders linked to this customer yet.</p>
                              ) : (
                                <div>
                                  <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-3">
                                    Order History · {stats.count} visit{stats.count !== 1 ? "s" : ""} · {fmt(stats.totalSpent)} total
                                  </p>
                                  <div className="rounded-lg overflow-hidden border border-orange-100">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-orange-100/50">
                                          <th className="px-3 py-2 text-left font-semibold text-orange-700">Order #</th>
                                          <th className="px-3 py-2 text-left font-semibold text-orange-700">Date</th>
                                          <th className="px-3 py-2 text-left font-semibold text-orange-700">Food Items</th>
                                          <th className="px-3 py-2 text-left font-semibold text-orange-700">Total</th>
                                          <th className="px-3 py-2 text-left font-semibold text-orange-700">Payment</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-orange-50">
                                        {stats.orders.map(o => (
                                          <tr key={o.id} className="bg-white hover:bg-orange-50/30 transition-colors">
                                            <td className="px-3 py-2 font-medium text-gray-700">{o.orderNumber}</td>
                                            <td className="px-3 py-2 text-gray-500">{new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                                            <td className="px-3 py-2">
                                              <div className="flex flex-wrap gap-1">
                                                {o.items.length > 0 ? o.items.map((item, i) => (
                                                  <span key={i} className="bg-orange-50 text-orange-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                    {item.name} ×{item.quantity}
                                                  </span>
                                                )) : <span className="text-gray-400">{o.itemCount} item{o.itemCount !== 1 ? "s" : ""}</span>}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-green-600">{fmt(o.total)}</td>
                                            <td className="px-3 py-2 text-gray-500">{o.paymentMethod}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add Customer">
        <CustomerForm onSave={create} onClose={() => setAddOpen(false)} />
      </Dialog>
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) setEditTarget(null); }} title="Edit Customer">
        {editTarget && <CustomerForm initial={editTarget} onSave={(name, phone) => update(editTarget.id, name, phone)} onClose={() => setEditTarget(null)} />}
      </Dialog>
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} title="Remove Customer">
        {deleteTarget && <DeleteConfirm customer={deleteTarget} onConfirm={async () => { await remove(deleteTarget.id); }} onClose={() => setDeleteTarget(null)} />}
      </Dialog>
    </>
  );
}
