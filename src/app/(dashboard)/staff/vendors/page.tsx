"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useVendors, useVendorRequisitions } from "@/hooks/use-vendors";
import {
  Plus, Edit2, Trash2, Search, Truck, Phone, MapPin,
  ChevronDown, ChevronUp, Package, CheckCircle, XCircle, Clock, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from "date-fns";
import type { Vendor } from "@/types";
import type { VendorRequisition } from "@/hooks/use-vendors";

// ─── Helpers ────────────────────────────────────────────────────────────────

type Tab = "vendors" | "requests";
type DatePreset = "today" | "last_week" | "this_month" | "all_time" | "custom";

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (preset) {
    case "today":      return { from: startOfDay(now), to: endOfDay(now) };
    case "last_week":  return { from: startOfWeek(subWeeks(now, 1)), to: endOfWeek(subWeeks(now, 1)) };
    case "this_month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "all_time":   return { from: null, to: null };
    case "custom":     return {
      from: customFrom ? startOfDay(new Date(customFrom)) : null,
      to:   customTo   ? endOfDay(new Date(customTo))   : null,
    };
  }
}

function shortReqId(id: string) {
  return "REQ-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) => {
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
};

const statusConfig = {
  submitted: { label: "Under Review", icon: Clock,         bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400"  },
  approved:  { label: "Approved",     icon: CheckCircle,   bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  },
  rejected:  { label: "Rejected",     icon: XCircle,       bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-400"    },
};

const payConfig = {
  paid: { label: "Paid", bg: "bg-blue-50",  text: "text-blue-700"  },
  due:  { label: "Due",  bg: "bg-rose-50",  text: "text-rose-700"  },
};

// ─── Requisition card under each vendor ─────────────────────────────────────

function ReqCard({ req }: { req: VendorRequisition }) {
  const [expanded, setExpanded] = useState(false);
  const total = req.product_requisition_items?.reduce((s, i) => s + i.total_price, 0) ?? 0;
  const st = statusConfig[req.status] ?? statusConfig.submitted;
  const pay = payConfig[req.payment_status] ?? payConfig.due;
  const restaurantName = (req as any).restaurants?.name ?? null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Row header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors text-left"
      >
        {/* REQ ID + date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-800 font-mono">{shortReqId(req.id)}</span>
            <span className="text-xs text-gray-400">{fmtDate(req.requisition_date)}</span>
            {restaurantName && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {restaurantName}
              </span>
            )}
          </div>
          {req.notes && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{req.notes}</p>
          )}
        </div>

        {/* Badges + total */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pay.bg} ${pay.text}`}>
            {pay.label}
          </span>
          <span className="text-xs font-bold text-gray-800 w-24 text-right">{fmt(total)}</span>
          {expanded
            ? <ChevronUp size={13} className="text-gray-400 shrink-0" />
            : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3">
          {(!req.product_requisition_items || req.product_requisition_items.length === 0) ? (
            <p className="text-xs text-gray-400 text-center py-2">No items</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                  <th className="text-left pb-2 font-semibold">Item</th>
                  <th className="text-right pb-2 font-semibold">Qty</th>
                  <th className="text-right pb-2 font-semibold">Unit</th>
                  <th className="text-right pb-2 font-semibold">Unit Price</th>
                  <th className="text-right pb-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {req.product_requisition_items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 text-gray-700 font-medium">
                      {item.ingredients?.name ?? "—"}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-1.5 text-right text-gray-500">{item.unit ?? item.ingredients?.default_unit ?? "—"}</td>
                    <td className="py-1.5 text-right text-gray-600">{fmt(item.unit_price)}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-800">{fmt(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={4} className="pt-2 text-right text-xs font-bold text-gray-600">Grand Total</td>
                  <td className="pt-2 text-right text-xs font-bold text-orange-600">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vendor form types ───────────────────────────────────────────────────────

interface VendorForm {
  name: string;
  phone: string;
  address: string;
}

const emptyForm: VendorForm = { name: "", phone: "", address: "" };

// ─── Page ───────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { vendors, loading: vendorsLoading, create, update, remove } = useVendors();
  const { groups, loading: reqLoading } = useVendorRequisitions();

  const [tab, setTab] = useState<Tab>("vendors");
  const [search, setSearch] = useState("");
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  // Date filter for requests tab
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Vendor Names tab state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredVendors = useMemo(() =>
    vendors.filter((v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.phone ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.address ?? "").toLowerCase().includes(search.toLowerCase())
    ), [vendors, search]);

  const filteredGroups = useMemo(() => {
    const { from, to } = getDateRange(datePreset, customFrom, customTo);

    let result = groups.map((g) => {
      // Filter requisitions by date range
      const reqs = from || to
        ? g.requisitions.filter((r) => {
            const d = new Date(r.requisition_date + "T12:00:00");
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
          })
        : g.requisitions;
      const totalSpend = reqs.reduce((s, r) =>
        s + (r.product_requisition_items?.reduce((a, i) => a + i.total_price, 0) ?? 0), 0);
      return { ...g, requisitions: reqs, totalSpend };
    }).filter((g) => g.requisitions.length > 0);

    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter((g) =>
      g.vendor.name.toLowerCase().includes(q) ||
      g.requisitions.some((r) =>
        r.product_requisition_items?.some((i) =>
          i.ingredients?.name?.toLowerCase().includes(q)
        ) || shortReqId(r.id).toLowerCase().includes(q)
      )
    );
  }, [groups, search, datePreset, customFrom, customTo]);

  // ── Vendor form handlers ───────────────────────────────────────────────────

  const f = (k: keyof VendorForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({ name: v.name, phone: v.phone, address: v.address });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Vendor name is required");
    if (!form.phone.trim()) return toast.error("Phone number is required");
    setSaving(true);
    const payload = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() };
    const { error } = editing ? await update(editing.id, payload) : await create(payload);
    if (error) toast.error((error as any)?.message ?? "Failed to save vendor");
    else { toast.success(editing ? "Vendor updated!" : "Vendor added!"); setOpen(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await remove(deleteId);
    if (error) toast.error((error as any)?.message ?? "Failed to delete vendor");
    else toast.success("Vendor deleted");
    setDeleteId(null);
    setDeleting(false);
  };

  const toggleVendor = (vid: string) =>
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      next.has(vid) ? next.delete(vid) : next.add(vid);
      return next;
    });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header title="Vendor Management" hideRestaurantSelector />
      <div className="p-4 md:p-6 space-y-4">

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-border shadow-sm shrink-0 flex flex-wrap items-center px-[14px] gap-3 py-2.5 md:h-[62px] md:py-0 overflow-x-auto">
          {/* Tab group */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 shrink-0">
            {([
              { value: "vendors",  label: "Vendor Names" },
              { value: "requests", label: "Vendor Items Request" },
            ] as { value: Tab; label: string }[]).map((t) => (
              <button
                key={t.value}
                onClick={() => { setTab(t.value); setSearch(""); }}
                className={`h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  tab === t.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Add Vendor button — only on vendors tab */}
          {tab === "vendors" && (
            <Button size="sm" className="h-9" onClick={openAdd}>
              <Plus size={14} /> Add Vendor
            </Button>
          )}

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "vendors" ? "Search vendors…" : "Search vendor or item…"}
              className="w-52 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* ── Vendor Names tab ──────────────────────────────────────────────── */}
        {tab === "vendors" && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-gray-900 text-sm">
                Vendors <span className="text-gray-400 font-normal">({filteredVendors.length})</span>
              </h3>
            </div>

            {vendorsLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
            ) : filteredVendors.length === 0 ? (
              <div className="p-12 text-center">
                <Truck size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {search ? "No vendors match your search" : "No vendors yet — add your first vendor"}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    {["Name", "Phone", "Address", "Actions"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{v.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone size={12} className="text-gray-400 shrink-0" />
                          {v.phone || <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <MapPin size={12} className="text-gray-400 shrink-0" />
                          {v.address || <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteId(v.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Vendor Items Request tab ──────────────────────────────────────── */}
        {tab === "requests" && (
          <div className="space-y-3">
            {/* Date filter */}
            <div className="bg-white rounded-xl border border-border shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
              <CalendarDays size={14} className="text-gray-400 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {([
                  { value: "today",      label: "Today" },
                  { value: "last_week",  label: "Last Week" },
                  { value: "this_month", label: "This Month" },
                  { value: "all_time",   label: "All Time" },
                  { value: "custom",     label: "Custom" },
                ] as { value: DatePreset; label: string }[]).map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setDatePreset(p.value)}
                    className={`h-7 px-3 rounded-lg text-xs font-medium transition-colors ${
                      datePreset === p.value
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 ml-1 flex-wrap">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-7 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <span className="text-xs text-gray-400">—</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-7 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              )}
            </div>

            {reqLoading ? (
              <div className="bg-white rounded-xl border border-border shadow-sm p-8 text-center text-sm text-gray-400">
                Loading requisitions…
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
                <Package size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {search
                    ? "No vendors or items match your search"
                    : "No vendor-linked requisitions yet — assign a vendor when creating a bazar request"}
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isOpen = expandedVendors.has(group.vendor.id);
                return (
                  <div key={group.vendor.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                    {/* Vendor header — click to expand/collapse */}
                    <button
                      onClick={() => toggleVendor(group.vendor.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
                    >
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                        <Truck size={16} className="text-orange-500" />
                      </div>

                      {/* Vendor info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{group.vendor.name}</p>
                        {group.vendor.phone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone size={10} className="text-gray-400" />
                            <span className="text-xs text-gray-400">{group.vendor.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Requests</p>
                          <p className="text-sm font-bold text-gray-700">{group.requisitions.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Total Spend</p>
                          <p className="text-sm font-bold text-orange-600">{fmt(group.totalSpend)}</p>
                        </div>
                        <div className="w-6 flex items-center justify-center">
                          {isOpen
                            ? <ChevronUp size={15} className="text-gray-400" />
                            : <ChevronDown size={15} className="text-gray-400" />}
                        </div>
                      </div>
                    </button>

                    {/* Requisitions list */}
                    {isOpen && (
                      <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50/30">
                        {group.requisitions.map((req) => (
                          <ReqCard key={req.id} req={req} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Add / Edit Vendor Dialog ───────────────────────────────────────── */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Vendor" : "Add Vendor"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save Changes" : "Add Vendor"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Vendor Name"
            placeholder="e.g. Fresh Farm Suppliers"
            value={form.name}
            onChange={(e) => f("name", e.target.value)}
          />
          <Input
            label="Phone Number"
            placeholder="e.g. +880 1700-000000"
            value={form.phone}
            onChange={(e) => f("phone", e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => f("address", e.target.value)}
              placeholder="e.g. 12 Market Street, Dhaka"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </Dialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        title="Delete Vendor"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this vendor? This action cannot be undone.
        </p>
      </Dialog>
    </div>
  );
}
