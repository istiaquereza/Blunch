"use client";

import { useState, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useRestaurant } from "@/contexts/restaurant-context";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useBillingSettings, useDiscounts } from "@/hooks/use-billing-settings";
import { useTables } from "@/hooks/use-tables";
import { usePrintSettings } from "@/hooks/use-print-settings";
import {
  Edit2, Trash2, Plus, Building2, MapPin, Phone,
  CreditCard, Receipt, LayoutGrid, Printer,
  Pencil, X, Check, ImagePlus, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Restaurant } from "@/types";
import type { PaymentMethod } from "@/hooks/use-payment-methods";
import type { Discount } from "@/hooks/use-billing-settings";
import type { Table } from "@/hooks/use-tables";

const RESTAURANT_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "outlet", label: "Outlet" },
];

interface RestaurantForm {
  name: string; type: "restaurant" | "outlet"; parent_id: string;
  location: string; address: string; phone: string; logo_url: string;
}
const emptyRestaurant: RestaurantForm = { name: "", type: "restaurant", parent_id: "", location: "", address: "", phone: "", logo_url: "" };

function RestaurantsTab() {
  const { restaurants, loading, create, update, remove } = useRestaurants();
  const { refresh } = useRestaurant();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RestaurantForm>(emptyRestaurant);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const restaurantOptions = restaurants.filter((r) => r.type === "restaurant").map((r) => ({ value: r.id, label: r.name }));
  const f = (k: keyof RestaurantForm, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const openAdd = () => { setEditing(null); setForm(emptyRestaurant); setOpen(true); };
  const openEdit = (r: Restaurant) => {
    setEditing(r);
    setForm({ name: r.name, type: r.type, parent_id: r.parent_id ?? "", location: r.location ?? "", address: r.address ?? "", phone: r.phone ?? "", logo_url: r.logo_url ?? "" });
    setOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `restaurant-logos/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Logo upload failed"); setLogoUploading(false); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    f("logo_url", data.publicUrl);
    setLogoUploading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = { name: form.name.trim(), type: form.type, parent_id: form.parent_id || null, location: form.location || null, address: form.address || null, phone: form.phone || null, logo_url: form.logo_url || null };
    const { error } = editing ? await update(editing.id, payload) : await create(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Updated!" : "Restaurant added!"); setOpen(false); refresh(); }
    setSaving(false);
  };
  const handleDelete = async (r: Restaurant) => {
    if (!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    const { error } = await remove(r.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };
  return (
    <>
      <div className="bg-white rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div><h2 className="font-semibold text-gray-900">Restaurants & Outlets</h2><p className="text-sm text-gray-500 mt-0.5">Add your restaurants and outlets</p></div>
          <Button onClick={openAdd} size="sm"><Plus size={14} /> Add Restaurant</Button>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          : restaurants.length === 0 ? (
            <div className="p-12 text-center"><Building2 size={40} className="text-gray-200 mx-auto mb-3" /><p className="font-medium text-gray-500">No restaurants yet</p><Button onClick={openAdd} className="mt-4" size="sm"><Plus size={14} /> Add Restaurant</Button></div>
          ) : (
            <div className="divide-y divide-border">
              {restaurants.map((r) => (
                <div key={r.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {r.logo_url
                        ? <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                        : <Building2 size={18} className="text-orange-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2"><p className="font-medium text-gray-900">{r.name}</p><Badge variant={r.type === "restaurant" ? "info" : "purple"}>{r.type}</Badge></div>
                      {r.type === "outlet" && r.parent_id && <p className="text-xs text-gray-400 mt-0.5">Under: {restaurants.find((x) => x.id === r.parent_id)?.name ?? "—"}</p>}
                      <div className="flex items-center gap-4 mt-1">
                        {r.location && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> {r.location}</span>}
                        {r.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={11} /> {r.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Edit2 size={13} /></Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(r)}><Trash2 size={13} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit Restaurant" : "Add Restaurant / Outlet"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save Changes" : "Add"}</Button></>}>
        <div className="space-y-4">
          {/* Logo upload */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Logo</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                {form.logo_url
                  ? <img src={form.logo_url} alt="logo" className="w-full h-full object-cover" />
                  : <Building2 size={22} className="text-gray-300" />}
              </div>
              <label className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium cursor-pointer transition-colors",
                logoUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 text-gray-700"
              )}>
                {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {logoUploading ? "Uploading…" : "Upload Logo"}
                <input type="file" accept="image/*" className="hidden" disabled={logoUploading} onChange={handleLogoUpload} />
              </label>
              {form.logo_url && (
                <button onClick={() => f("logo_url", "")} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              )}
            </div>
          </div>
          <Input label="Name" placeholder="e.g. Blunch Gulshan" value={form.name} onChange={(e) => f("name", e.target.value)} />
          <Select label="Type" value={form.type} onChange={(e) => f("type", e.target.value as "restaurant" | "outlet")} options={RESTAURANT_TYPES} />
          {form.type === "outlet" && restaurantOptions.length > 0 && (<Select label="Parent Restaurant" value={form.parent_id} onChange={(e) => f("parent_id", e.target.value)} placeholder="Select parent restaurant" options={restaurantOptions} />)}
          <Input label="Location / City" placeholder="e.g. Dhaka" value={form.location} onChange={(e) => f("location", e.target.value)} />
          <Input label="Address" placeholder="Full address" value={form.address} onChange={(e) => f("address", e.target.value)} />
          <Input label="Phone" placeholder="+880 ..." value={form.phone} onChange={(e) => f("phone", e.target.value)} />
        </div>
      </Dialog>
    </>
  );
}

const FEE_TYPES = [{ value: "percentage", label: "Percentage (%)" }, { value: "amount", label: "Fixed Amount (৳)" }];

function PaymentMethodsTab({ rid }: { rid?: string }) {
  const { restaurants } = useRestaurants();
  const [selectedRid, setSelectedRid] = useState<string>(rid ?? "");

  // Keep selectedRid in sync when active restaurant changes from header
  useEffect(() => { if (rid && !selectedRid) setSelectedRid(rid); }, [rid]);

  const { methods, loading, create, update, remove, refresh } = usePaymentMethods(selectedRid || undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [name, setName] = useState("");
  const [feeType, setFeeType] = useState<"percentage" | "amount">("percentage");
  const [feeValue, setFeeValue] = useState("0");
  const [dialogRid, setDialogRid] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const restaurantOptions = restaurants.map((r) => ({ value: r.id, label: r.name }));

  const openAdd = () => {
    setEditing(null);
    setName(""); setFeeType("percentage"); setFeeValue("0");
    setDialogRid(selectedRid);
    setOpen(true);
  };
  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setName(m.name); setFeeType(m.fee_type); setFeeValue(String(m.fee_value));
    setDialogRid(m.restaurant_id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!dialogRid) return toast.error("Select a restaurant");
    setSaving(true);
    const payload = { name: name.trim(), fee_type: feeType, fee_value: parseFloat(feeValue) || 0, is_active: true };
    let error: unknown;
    if (editing) {
      ({ error } = await update(editing.id, payload));
    } else {
      // Create under the dialog-selected restaurant
      const supabase = createClient();
      const { error: err } = await supabase
        .from("payment_methods")
        .insert({ ...payload, restaurant_id: dialogRid });
      error = err;
      if (!err) {
        setSelectedRid(dialogRid); // switch view to the restaurant we just added to
        refresh();
      }
    }
    if (error) toast.error((error as any).message);
    else { toast.success(editing ? "Updated!" : "Added!"); setOpen(false); }
    setSaving(false);
  };

  const selectedRestaurantName = restaurants.find((r) => r.id === selectedRid)?.name;

  return (
    <>
      <div className="bg-white rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div>
              <h2 className="font-semibold text-gray-900">Payment Methods</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configure accepted payment options per restaurant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Restaurant filter dropdown */}
            <select
              value={selectedRid}
              onChange={(e) => setSelectedRid(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white min-w-[160px]"
            >
              <option value="">All Restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Method</Button>
          </div>
        </div>

        {/* Restaurant context banner */}
        {selectedRid && selectedRestaurantName && (
          <div className="px-5 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <Building2 size={13} className="text-orange-500" />
            <span className="text-xs text-orange-700 font-medium">Showing methods for: {selectedRestaurantName}</span>
          </div>
        )}
        {!selectedRid && (
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-gray-400">Select a restaurant above to filter, or view all below.</span>
          </div>
        )}

        {loading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
          : methods.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">{selectedRid ? "No payment methods for this restaurant" : "No payment methods yet"}</p>
              <Button size="sm" onClick={openAdd} className="mt-3"><Plus size={14} /> Add Method</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/60">
                  {["Method", "Restaurant", "Fee Type", "Fee Value", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {methods.map((m) => {
                  const restName = restaurants.find((r) => r.id === m.restaurant_id)?.name ?? "—";
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.name}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{restName}</td>
                      <td className="px-5 py-3 text-gray-500">{m.fee_type === "percentage" ? "Percentage" : "Fixed Amount"}</td>
                      <td className="px-5 py-3 text-gray-700">{m.fee_type === "percentage" ? `${m.fee_value}%` : `৳${m.fee_value}`}</td>
                      <td className="px-5 py-3"><Switch checked={m.is_active} onCheckedChange={(v) => update(m.id, { is_active: v })} label={m.is_active ? "Active" : "Inactive"} /></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Edit2 size={13} /></Button>
                          <Button variant="danger" size="sm" onClick={() => { if (confirm(`Delete "${m.name}"?`)) remove(m.id); }}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
      </div>

      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit Payment Method" : "Add Payment Method"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save" : "Add"}</Button></>}>
        <div className="space-y-4">
          {/* Restaurant selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Restaurant *</label>
            <select
              value={dialogRid}
              onChange={(e) => setDialogRid(e.target.value)}
              disabled={!!editing}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Select restaurant…</option>
              {restaurantOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <Input label="Method Name" placeholder="e.g. bKash, Cash, Card" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Fee Type" value={feeType} onChange={(e) => setFeeType(e.target.value as "percentage" | "amount")} options={FEE_TYPES} />
          <Input label={feeType === "percentage" ? "Fee (%)" : "Fee Amount (৳)"} type="number" min="0" step="0.01" placeholder="0" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} />
        </div>
      </Dialog>
    </>
  );
}

const APPLY_ON_OPTIONS = [{ value: "order", label: "On Entire Order" }, { value: "item", label: "Per Item" }];
const DISCOUNT_TYPES = [{ value: "percentage", label: "Percentage (%)" }, { value: "amount", label: "Fixed Amount (৳)" }];

function BillingTab({ rid }: { rid?: string }) {
  const { settings, loading: bLoading, save } = useBillingSettings(rid);
  const { discounts, loading: dLoading, create, update, remove } = useDiscounts(rid);
  const [vat, setVat] = useState("0");
  const [vatOn, setVatOn] = useState<"order" | "item">("order");
  const [serviceCharge, setServiceCharge] = useState("0");
  const [saving, setSaving] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState<Discount | null>(null);
  const [dForm, setDForm] = useState({ name: "", discount_type: "percentage" as "percentage" | "amount", discount_value: "0", apply_on: "order" as "order" | "item" });
  const [dSaving, setDSaving] = useState(false);

  useEffect(() => {
    if (settings) { setVat(String(settings.vat_percentage)); setVatOn(settings.vat_apply_on); setServiceCharge(String(settings.service_charge_percentage)); }
  }, [settings]);

  const handleSaveBilling = async () => {
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);
    const { error } = await save({ vat_percentage: parseFloat(vat) || 0, vat_apply_on: vatOn, service_charge_percentage: parseFloat(serviceCharge) || 0 });
    if (error) toast.error(error.message); else toast.success("Billing settings saved!");
    setSaving(false);
  };
  const openAddDiscount = () => { setEditDiscount(null); setDForm({ name: "", discount_type: "percentage", discount_value: "0", apply_on: "order" }); setDiscountOpen(true); };
  const openEditDiscount = (d: Discount) => { setEditDiscount(d); setDForm({ name: d.name, discount_type: d.discount_type, discount_value: String(d.discount_value), apply_on: d.apply_on }); setDiscountOpen(true); };
  const handleSaveDiscount = async () => {
    if (!dForm.name.trim()) return toast.error("Name required");
    if (!rid) return toast.error("Select a restaurant first");
    setDSaving(true);
    const payload = { name: dForm.name.trim(), discount_type: dForm.discount_type, discount_value: parseFloat(dForm.discount_value) || 0, apply_on: dForm.apply_on, is_active: true };
    const { error } = editDiscount ? await update(editDiscount.id, payload) : await create(payload);
    if (error) toast.error(error.message); else { toast.success(editDiscount ? "Updated!" : "Discount added!"); setDiscountOpen(false); }
    setDSaving(false);
  };

  if (!rid) return <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-gray-400">Select a restaurant from the header to manage billing settings.</div>;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-border">
        <div className="p-5 border-b border-border"><h2 className="font-semibold text-gray-900">VAT & Service Charge</h2><p className="text-sm text-gray-500 mt-0.5">Configure tax and service charge for orders</p></div>
        {bLoading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div> : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="VAT Percentage (%)" type="number" min="0" step="0.01" placeholder="0.00" value={vat} onChange={(e) => setVat(e.target.value)} hint="Leave 0 to disable VAT" />
              <Select label="VAT Apply On" value={vatOn} onChange={(e) => setVatOn(e.target.value as "order" | "item")} options={APPLY_ON_OPTIONS} />
            </div>
            <Input label="Service Charge (%)" type="number" min="0" step="0.01" placeholder="0.00" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} hint="Leave 0 to disable service charge" />
            <div className="flex justify-end"><Button onClick={handleSaveBilling} loading={saving}>Save Billing Settings</Button></div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div><h2 className="font-semibold text-gray-900">Discounts</h2><p className="text-sm text-gray-500 mt-0.5">Create reusable discounts for orders</p></div>
          <Button size="sm" onClick={openAddDiscount}><Plus size={14} /> Add Discount</Button>
        </div>
        {dLoading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
          : discounts.length === 0 ? (<div className="p-10 text-center"><Receipt size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-400">No discounts configured</p></div>)
          : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-gray-50/60">{["Name", "Type", "Value", "Apply On", "Status", ""].map((h) => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-5 py-3 text-gray-500">{d.discount_type === "percentage" ? "Percentage" : "Fixed"}</td>
                    <td className="px-5 py-3 font-medium">{d.discount_type === "percentage" ? `${d.discount_value}%` : `৳${d.discount_value}`}</td>
                    <td className="px-5 py-3"><Badge variant="info">{d.apply_on}</Badge></td>
                    <td className="px-5 py-3"><Switch checked={d.is_active} onCheckedChange={(v) => update(d.id, { is_active: v })} label={d.is_active ? "Active" : "Off"} /></td>
                    <td className="px-5 py-3"><div className="flex gap-1 justify-end"><Button variant="ghost" size="sm" onClick={() => openEditDiscount(d)}><Edit2 size={13} /></Button><Button variant="danger" size="sm" onClick={() => { if (confirm(`Delete "${d.name}"?`)) remove(d.id); }}><Trash2 size={13} /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </div>
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen} title={editDiscount ? "Edit Discount" : "Add Discount"}
        footer={<><Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button><Button onClick={handleSaveDiscount} loading={dSaving}>{editDiscount ? "Save" : "Add"}</Button></>}>
        <div className="space-y-4">
          <Input label="Discount Name" placeholder="e.g. Weekend Special, Staff 20%" value={dForm.name} onChange={(e) => setDForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={dForm.discount_type} onChange={(e) => setDForm((p) => ({ ...p, discount_type: e.target.value as "percentage" | "amount" }))} options={DISCOUNT_TYPES} />
            <Input label={dForm.discount_type === "percentage" ? "Value (%)" : "Amount (৳)"} type="number" min="0" step="0.01" placeholder="0" value={dForm.discount_value} onChange={(e) => setDForm((p) => ({ ...p, discount_value: e.target.value }))} />
          </div>
          <Select label="Apply On" value={dForm.apply_on} onChange={(e) => setDForm((p) => ({ ...p, apply_on: e.target.value as "order" | "item" }))} options={APPLY_ON_OPTIONS} />
        </div>
      </Dialog>
    </div>
  );
}

function TablesTab({ rid }: { rid?: string }) {
  const { tables, loading, create, update, remove } = useTables(rid);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCap, setEditCap] = useState("");
  const [newName, setNewName] = useState("");
  const [newCap, setNewCap] = useState("4");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || !rid) return;
    setAdding(true);
    const { error } = await create(newName.trim(), parseInt(newCap) || 4);
    if (error) toast.error(error.message); else { setNewName(""); setNewCap("4"); toast.success("Table added!"); }
    setAdding(false);
  };
  const handleUpdate = async (t: Table) => {
    if (!editName.trim()) return;
    const { error } = await update(t.id, { name: editName.trim(), capacity: parseInt(editCap) || t.capacity });
    if (error) toast.error(error.message); else { setEditId(null); toast.success("Updated!"); }
  };

  if (!rid) return <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-gray-400">Select a restaurant from the header to manage tables.</div>;

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="p-5 border-b border-border"><h2 className="font-semibold text-gray-900">Order Tracking — Tables</h2><p className="text-sm text-gray-500 mt-0.5">Manage seating tables and sections</p></div>
      <div className="p-4 border-b border-border bg-gray-50/50">
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="Table name (e.g. T1, VIP-1)"
            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <input type="number" min="1" value={newCap} onChange={(e) => setNewCap(e.target.value)} placeholder="Seats"
            className="w-24 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <Button size="sm" onClick={handleAdd} loading={adding}><Plus size={14} /> Add</Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Enter table name + seat capacity, press Enter or click Add</p>
      </div>
      {loading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        : tables.length === 0 ? (<div className="p-12 text-center"><LayoutGrid size={36} className="text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-400">No tables yet — add one above</p></div>)
        : (
          <div className="divide-y divide-border">
            {tables.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                {editId === t.id ? (
                  <>
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <input type="number" min="1" value={editCap} onChange={(e) => setEditCap(e.target.value)} className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <button onClick={() => handleUpdate(t)} className="w-7 h-7 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"><Check size={12} /></button>
                    <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{t.name.slice(0, 2).toUpperCase()}</span>
                      <div><p className="font-medium text-sm text-gray-800">{t.name}</p><p className="text-xs text-gray-400">{t.capacity} seats</p></div>
                    </div>
                    <Switch checked={t.is_active} onCheckedChange={(v) => update(t.id, { is_active: v })} label={t.is_active ? "Active" : "Inactive"} />
                    <button onClick={() => { setEditId(t.id); setEditName(t.name); setEditCap(String(t.capacity)); }} className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 flex items-center justify-center"><Pencil size={12} /></button>
                    <button onClick={() => { if (confirm(`Delete table "${t.name}"?`)) remove(t.id); }} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function PrintTab({ rid }: { rid?: string }) {
  const { settings, loading, save } = usePrintSettings(rid);
  const [form, setForm] = useState({ show_logo: true, show_address: true, show_phone: true, show_social: false, biin: "", greeting: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) { setForm({ show_logo: settings.show_logo, show_address: settings.show_address, show_phone: settings.show_phone, show_social: settings.show_social, biin: settings.biin ?? "", greeting: settings.greeting ?? "" }); }
  }, [settings]);

  const handleSave = async () => {
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);
    const { error } = await save({ ...form, biin: form.biin || null, greeting: form.greeting || null });
    if (error) toast.error(error.message); else toast.success("Print settings saved!");
    setSaving(false);
  };

  if (!rid) return <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-gray-400">Select a restaurant from the header to manage print settings.</div>;

  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="p-5 border-b border-border"><h2 className="font-semibold text-gray-900">Print Settings</h2><p className="text-sm text-gray-500 mt-0.5">Configure what appears on printed bills and receipts</p></div>
      {loading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div> : (
        <div className="p-5 space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Show on Receipt</p>
            {([
              { key: "show_logo" as const, label: "Restaurant Logo" },
              { key: "show_address" as const, label: "Address" },
              { key: "show_phone" as const, label: "Phone Number" },
              { key: "show_social" as const, label: "Social Media Links" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50">
                <span className="text-sm text-gray-700">{label}</span>
                <Switch checked={form[key] as boolean} onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: v }))} label="" />
              </div>
            ))}
          </div>
          <Input label="BIIN / Tax Registration Number" placeholder="e.g. 123456789-0101" value={form.biin} onChange={(e) => setForm((p) => ({ ...p, biin: e.target.value }))} hint="Displayed at the bottom of receipts for VAT compliance" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Footer Greeting Message</label>
            <textarea value={form.greeting} onChange={(e) => setForm((p) => ({ ...p, greeting: e.target.value }))} placeholder="e.g. Thank you for dining with us! Come again soon." rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/40">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Receipt Preview</p>
            <div className="text-center text-xs text-gray-600 space-y-0.5">
              {form.show_logo && <p className="font-bold text-sm">Blunch</p>}
              {form.show_address && <p className="text-gray-400">123 Restaurant St, Dhaka</p>}
              {form.show_phone && <p className="text-gray-400">+880 1234 567890</p>}
              <p className="border-t border-dashed border-gray-200 pt-2 mt-2 text-gray-500">Order #ORD-20250101-0001</p>
              <p className="text-gray-500">—— Items ——</p>
              {form.biin && <p className="text-gray-400 text-[10px]">BIIN: {form.biin}</p>}
              {form.greeting && <p className="italic text-gray-400 text-[10px] mt-1">{form.greeting}</p>}
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={handleSave} loading={saving}><Printer size={14} /> Save Print Settings</Button></div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "restaurants", label: "Restaurants", icon: Building2 },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "tables", label: "Order Tracking", icon: LayoutGrid },
  { id: "print", label: "Print", icon: Printer },
];

export default function SettingsPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;
  const [activeTab, setActiveTab] = useState("restaurants");

  return (
    <div>
      <Header title="Blunch Settings" />
      <div className="p-4 md:p-6 max-w-5xl">
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 md:mb-6 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Tabs.Trigger key={id} value={id}
                className={cn(
                  "flex items-center gap-1.5 flex-1 justify-center h-9 rounded-lg text-xs sm:text-sm font-medium transition-all focus:outline-none whitespace-nowrap px-2 sm:px-3",
                  activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                <Icon size={13} className="shrink-0" /><span className="hidden sm:inline">{label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="restaurants"><RestaurantsTab /></Tabs.Content>
          <Tabs.Content value="payments"><PaymentMethodsTab rid={rid} /></Tabs.Content>
          <Tabs.Content value="billing"><BillingTab rid={rid} /></Tabs.Content>
          <Tabs.Content value="tables"><TablesTab rid={rid} /></Tabs.Content>
          <Tabs.Content value="print"><PrintTab rid={rid} /></Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
