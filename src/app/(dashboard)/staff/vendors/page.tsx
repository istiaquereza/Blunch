"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useVendors } from "@/hooks/use-vendors";
import { Plus, Edit2, Trash2, Search, Truck, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Vendor } from "@/types";

interface VendorForm {
  name: string;
  phone: string;
  address: string;
}

const emptyForm: VendorForm = { name: "", phone: "", address: "" };

export default function VendorsPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { vendors, loading, create, update, remove } = useVendors(rid);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() =>
    vendors.filter((v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.phone.toLowerCase().includes(search.toLowerCase()) ||
      v.address.toLowerCase().includes(search.toLowerCase())
    ), [vendors, search]);

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
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);
    const payload = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() };
    const { error } = editing ? await update(editing.id, payload) : await create(payload);
    if (error) toast.error((error as Error).message);
    else { toast.success(editing ? "Vendor updated!" : "Vendor added!"); setOpen(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await remove(deleteId);
    if (error) toast.error((error as Error).message);
    else toast.success("Vendor deleted");
    setDeleteId(null);
    setDeleting(false);
  };

  if (!rid) return (
    <div>
      <Header title="Vendor Management" />
      <div className="p-6">
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <Truck size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No restaurant selected</p>
          <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Vendor Management" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Toolbar */}
        <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} /> Add Vendor
            </Button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-gray-900 text-sm">
              Vendors <span className="text-gray-400 font-normal">({filtered.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
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
                {filtered.map((v) => (
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
      </div>

      {/* Add / Edit Dialog */}
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

      {/* Delete Confirm Dialog */}
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
