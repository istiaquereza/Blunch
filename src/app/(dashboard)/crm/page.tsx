"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useCustomers, type Customer } from "@/hooks/use-customers";
import {
  Users,
  Search,
  Plus,
  Phone,
  Pencil,
  Trash2,
  UserCircle,
  ChevronDown,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderHistoryEntry {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  paymentMethod: string;
  itemCount: number;
}

interface CustomerOrderStat {
  count: number;
  totalSpent: number;
  lastVisit: string;
  orders: OrderHistoryEntry[];
}

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
      <Input
        label="Full Name *"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        placeholder="e.g. Rahim Uddin"
        autoFocus
      />
      <Input
        label="Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="e.g. 01712345678"
        type="tel"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>
          {initial ? "Save Changes" : "Add Customer"}
        </Button>
      </div>
    </form>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
interface DeleteConfirmProps {
  customer: Customer;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}
function DeleteConfirm({ customer, onConfirm, onClose }: DeleteConfirmProps) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Remove <span className="font-semibold text-gray-900">{customer.name}</span> from your customer list?
        This action cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          loading={loading}
          onClick={async () => {
            setLoading(true);
            await onConfirm();
            setLoading(false);
            onClose();
          }}
        >
          Remove Customer
        </Button>
      </div>
    </div>
  );
}

const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const { activeRestaurant } = useRestaurant();
  const { customers, loading, create, update, remove } = useCustomers(activeRestaurant?.id);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<Record<string, CustomerOrderStat>>({});

  // Fetch completed orders linked to customers
  useEffect(() => {
    if (!activeRestaurant) { setOrderStats({}); return; }
    const supabase = createClient();

    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total, created_at, payment_methods(name), order_items(id)")
        .eq("restaurant_id", activeRestaurant.id)
        .eq("status", "completed")
        .not("customer_id", "is", null)
        .order("created_at", { ascending: false });

      if (!data) return;

      const map: Record<string, CustomerOrderStat> = {};
      (data as any[]).forEach((order) => {
        const cid = order.customer_id as string;
        if (!map[cid]) {
          map[cid] = { count: 0, totalSpent: 0, lastVisit: order.created_at, orders: [] };
        }
        map[cid].count++;
        map[cid].totalSpent += order.total ?? 0;
        // orders are descending by date; first one = most recent
        if (map[cid].orders.length === 0) map[cid].lastVisit = order.created_at;
        map[cid].orders.push({
          id: order.id,
          orderNumber: order.order_number ?? "—",
          date: order.created_at,
          total: order.total ?? 0,
          paymentMethod: order.payment_methods?.name ?? "—",
          itemCount: Array.isArray(order.order_items) ? order.order_items.length : 0,
        });
      });

      setOrderStats(map);
    })();
  }, [activeRestaurant?.id]);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  const totalVisits = Object.values(orderStats).reduce((s, v) => s + v.count, 0);
  const totalRevenue = Object.values(orderStats).reduce((s, v) => s + v.totalSpent, 0);
  const repeatCustomers = Object.values(orderStats).filter((v) => v.count > 1).length;

  return (
    <>
      <Header title="CRM" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Users size={18} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Customers</p>
              <p className="text-xl font-bold text-gray-900">{customers.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <UserCircle size={18} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Repeat Visitors</p>
              <p className="text-xl font-bold text-gray-900">{repeatCustomers}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <ShoppingBag size={18} className="text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Visits</p>
              <p className="text-xl font-bold text-gray-900">{totalVisits}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">CRM Revenue</p>
              <p className="text-lg font-bold text-gray-900">{fmt(totalRevenue)}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <Button onClick={() => setAddOpen(true)} disabled={!activeRestaurant}>
            <Plus size={15} />
            Add Customer
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading customers…</div>
          ) : !activeRestaurant ? (
            <div className="p-8 text-center text-sm text-gray-400">Select a restaurant to view customers.</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {search ? "No customers match your search" : "No customers yet"}
              </p>
              {!search && (
                <p className="text-xs text-gray-400 mt-1">Add your first customer to get started.</p>
              )}
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
                {filtered.map((c, idx) => {
                  const stats = orderStats[c.id];
                  const isExpanded = expandedId === c.id;
                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? "bg-orange-50/40" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-orange-600">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Phone size={12} />{c.phone}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {stats ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                              <ShoppingBag size={12} className="text-orange-400" />
                              {stats.count}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {stats ? (
                            <span className="text-sm font-semibold text-green-600">{fmt(stats.totalSpent)}</span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {stats
                            ? new Date(stats.lastVisit).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                            : new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditTarget(c); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                            <ChevronDown
                              size={14}
                              className={`text-gray-400 ml-1 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Expanded: order history */}
                      {isExpanded && (
                        <tr className="bg-orange-50/20 border-b border-orange-100/60">
                          <td colSpan={7} className="px-6 py-4">
                            {!stats || stats.orders.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-2">
                                No completed orders linked to this customer yet.
                              </p>
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
                                        <th className="px-3 py-2 text-left font-semibold text-orange-700">Items</th>
                                        <th className="px-3 py-2 text-left font-semibold text-orange-700">Total</th>
                                        <th className="px-3 py-2 text-left font-semibold text-orange-700">Payment</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-orange-50">
                                      {stats.orders.map((o) => (
                                        <tr key={o.id} className="bg-white hover:bg-orange-50/30 transition-colors">
                                          <td className="px-3 py-2 font-medium text-gray-700">{o.orderNumber}</td>
                                          <td className="px-3 py-2 text-gray-500">
                                            {new Date(o.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500">{o.itemCount}</td>
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

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add Customer">
        <CustomerForm
          onSave={create}
          onClose={() => setAddOpen(false)}
        />
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }} title="Edit Customer">
        {editTarget && (
          <CustomerForm
            initial={editTarget}
            onSave={(name, phone) => update(editTarget.id, name, phone)}
            onClose={() => setEditTarget(null)}
          />
        )}
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Remove Customer">
        {deleteTarget && (
          <DeleteConfirm
            customer={deleteTarget}
            onConfirm={async () => { await remove(deleteTarget.id); }}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </Dialog>
    </>
  );
}
