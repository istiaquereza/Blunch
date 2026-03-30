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
import { useRestaurantMembers } from "@/hooks/use-restaurant-members";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useBillingSettings, useDiscounts } from "@/hooks/use-billing-settings";
import { useFoodItems } from "@/hooks/use-food-items";
import { useTables } from "@/hooks/use-tables";
import { usePrintSettings } from "@/hooks/use-print-settings";
import {
  Edit2, Trash2, Plus, Building2, MapPin, Phone,
  CreditCard, Receipt, LayoutGrid, Printer,
  Pencil, X, Check, ImagePlus, Loader2, Search,
  Globe, Instagram, Facebook, Twitter, Youtube, Link2, ChevronRight, ChevronDown,
  Users, Crown, Briefcase, ShoppingCart, Eye, ShieldCheck, UserPlus, KeyRound,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Restaurant, SocialLink, AppUserRoleType } from "@/types";
import type { PaymentMethod } from "@/hooks/use-payment-methods";
import type { Discount } from "@/hooks/use-billing-settings";
import type { Table } from "@/hooks/use-tables";

const RESTAURANT_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "outlet", label: "Outlet" },
];

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "twitter", label: "Twitter / X", icon: Twitter },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "website", label: "Website", icon: Globe },
  { value: "other", label: "Other", icon: Link2 },
];

interface RestaurantPickerProps {
  restaurants: Restaurant[];
  rid: string;
  onChangeRid: (id: string) => void;
}
function RestaurantPicker({ restaurants, rid, onChangeRid }: RestaurantPickerProps) {
  const [open, setOpen] = useState(false);
  const active = restaurants.find((r) => r.id === rid) ?? restaurants[0];
  if (!restaurants.length) return null;
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        {active?.logo_url
          ? <img src={active.logo_url} alt={active.name} className="w-5 h-5 rounded object-cover" />
          : <Building2 size={14} className="text-gray-400" />}
        <span>{active?.name ?? "Select"}</span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
            {restaurants.map((r) => (
              <button key={r.id} onClick={() => { onChangeRid(r.id); setOpen(false); }}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  r.id === rid ? "bg-gray-50 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50")}>
                {r.logo_url
                  ? <img src={r.logo_url} alt={r.name} className="w-5 h-5 rounded object-cover shrink-0" />
                  : <Building2 size={14} className="text-gray-400 shrink-0" />}
                <span className="truncate">{r.name}</span>
                {r.type === "outlet" && <Badge variant="purple" className="text-[9px] py-0 ml-auto shrink-0">outlet</Badge>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface RestaurantForm {
  name: string; type: "restaurant" | "outlet"; parent_id: string;
  location: string; address: string; phone: string; logo_url: string;
  social_links: SocialLink[];
}
const emptyRestaurant: RestaurantForm = {
  name: "", type: "restaurant", parent_id: "", location: "", address: "", phone: "", logo_url: "",
  social_links: [],
};

function RestaurantsTab({ search = "" }: { search?: string }) {
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
    setForm({
      name: r.name, type: r.type, parent_id: r.parent_id ?? "",
      location: r.location ?? "", address: r.address ?? "", phone: r.phone ?? "",
      logo_url: r.logo_url ?? "", social_links: r.social_links ?? [],
    });
    setOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", "logos");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok || json.error) { toast.error("Logo upload failed: " + (json.error ?? res.statusText)); setLogoUploading(false); return; }
    f("logo_url", json.url);
    setLogoUploading(false);
  };

  const addSocialLink = () => setForm((p) => ({ ...p, social_links: [...p.social_links, { platform: "instagram", url: "" }] }));
  const updateSocialLink = (i: number, key: keyof SocialLink, val: string) =>
    setForm((p) => { const links = [...p.social_links]; links[i] = { ...links[i], [key]: val }; return { ...p, social_links: links }; });
  const removeSocialLink = (i: number) =>
    setForm((p) => ({ ...p, social_links: p.social_links.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(), type: form.type,
      parent_id: form.parent_id || undefined,
      location: form.location || undefined, address: form.address || undefined,
      phone: form.phone || undefined, logo_url: form.logo_url || undefined,
      social_links: form.social_links.length > 0 ? form.social_links : undefined,
    };
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

  // Group: parent restaurants, each followed by their outlets
  const parents = restaurants.filter((r) => r.type === "restaurant");
  const outlets = restaurants.filter((r) => r.type === "outlet");
  const q = search.toLowerCase();
  const filtered = q
    ? restaurants.filter((r) => r.name.toLowerCase().includes(q))
    : null; // null = show grouped

  const renderRow = (r: Restaurant, isOutlet = false) => (
    <div key={r.id} className={cn("p-5 flex items-start justify-between gap-4", isOutlet && "bg-gray-50/50 pl-14")}>
      {isOutlet && (
        <div className="absolute left-7 top-1/2 -translate-y-1/2">
          <ChevronRight size={12} className="text-gray-300" />
        </div>
      )}
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          {r.logo_url
            ? <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
            : <Building2 size={18} className="text-gray-400" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900">{r.name}</p>
            <Badge variant={r.type === "restaurant" ? "info" : "purple"}>{r.type}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {r.location && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> {r.location}</span>}
            {r.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={11} /> {r.phone}</span>}
            {r.social_links && r.social_links.length > 0 && (
              <div className="flex items-center gap-1.5">
                {r.social_links.map((sl, i) => {
                  const plat = SOCIAL_PLATFORMS.find((p) => p.value === sl.platform);
                  const Icon = plat?.icon ?? Link2;
                  return (
                    <a key={i} href={sl.url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 transition-colors" title={plat?.label ?? sl.platform}>
                      <Icon size={12} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => openEdit(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><Edit2 size={14} /></button>
        <button onClick={() => handleDelete(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Restaurants & Outlets</h2>
            <p className="text-sm text-gray-500 mt-0.5">Add your restaurants and outlets</p>
          </div>
          <Button onClick={openAdd} size="md"><Plus size={14} /> Add Restaurant</Button>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          : restaurants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="font-medium text-gray-500">No restaurants yet</p>
              <Button onClick={openAdd} className="mt-4" size="md"><Plus size={14} /> Add Restaurant</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered
                ? filtered.map((r) => renderRow(r, r.type === "outlet"))
                : parents.map((parent) => (
                    <div key={parent.id}>
                      {renderRow(parent, false)}
                      {outlets.filter((o) => o.parent_id === parent.id).map((outlet) => (
                        <div key={outlet.id} className="relative border-t border-gray-50">
                          {renderRow(outlet, true)}
                        </div>
                      ))}
                    </div>
                  ))
              }
              {/* Orphaned outlets (no parent match) */}
              {!filtered && outlets.filter((o) => !parents.find((p) => p.id === o.parent_id)).map((r) => renderRow(r, false))}
            </div>
          )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit Restaurant" : "Add Restaurant / Outlet"}
        className="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save Changes" : "Add"}</Button></>}>
        <div className="space-y-4">
          {/* Logo */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Logo</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                {form.logo_url
                  ? <img src={form.logo_url} alt="logo" className="w-full h-full object-cover" />
                  : <Building2 size={22} className="text-gray-300" />}
              </div>
              <label className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium cursor-pointer transition-colors",
                logoUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 text-gray-700")}>
                {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {logoUploading ? "Uploading…" : "Upload Logo"}
                <input type="file" accept="image/*" className="hidden" disabled={logoUploading} onChange={handleLogoUpload} />
              </label>
              {form.logo_url && <button onClick={() => f("logo_url", "")} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
            </div>
          </div>

          <Input label="Name" placeholder="e.g. Blunch Gulshan" value={form.name} onChange={(e) => f("name", e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={(e) => f("type", e.target.value as "restaurant" | "outlet")} options={RESTAURANT_TYPES} />
            {form.type === "outlet" && restaurantOptions.length > 0 && (
              <Select label="Parent Restaurant" value={form.parent_id} onChange={(e) => f("parent_id", e.target.value)} placeholder="Select parent" options={restaurantOptions} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Location / City" placeholder="e.g. Dhaka" value={form.location} onChange={(e) => f("location", e.target.value)} />
            <Input label="Phone" placeholder="+880 ..." value={form.phone} onChange={(e) => f("phone", e.target.value)} />
          </div>

          <Input label="Address" placeholder="Full address" value={form.address} onChange={(e) => f("address", e.target.value)} />

          {/* Social Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Social Links</label>
              <button onClick={addSocialLink} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                <Plus size={12} /> Add Link
              </button>
            </div>
            {form.social_links.length === 0 && (
              <p className="text-xs text-gray-400 py-2">No social links added yet.</p>
            )}
            {form.social_links.map((sl, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={sl.platform}
                  onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
                  className="h-9 px-2 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white shrink-0 w-36">
                  {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <input
                  value={sl.url}
                  onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
                <button onClick={() => removeSocialLink(i)} className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors shrink-0">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </>
  );
}

const FEE_TYPES = [{ value: "percentage", label: "Percentage (%)" }, { value: "amount", label: "Fixed Amount (৳)" }];

function PaymentMethodsTab({ rid, onChangeRid, restaurants }: { rid: string; onChangeRid: (id: string) => void; restaurants: Restaurant[] }) {
  const { methods, loading, create, update, remove, refresh } = usePaymentMethods(rid || undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [name, setName] = useState("");
  const [feeType, setFeeType] = useState<"percentage" | "amount">("percentage");
  const [feeValue, setFeeValue] = useState("0");
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditing(null); setName(""); setFeeType("percentage"); setFeeValue("0"); setOpen(true); };
  const openEdit = (m: PaymentMethod) => { setEditing(m); setName(m.name); setFeeType(m.fee_type); setFeeValue(String(m.fee_value)); setOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);
    const payload = { name: name.trim(), fee_type: feeType, fee_value: parseFloat(feeValue) || 0, is_active: true };
    let error: unknown;
    if (editing) {
      ({ error } = await update(editing.id, payload));
    } else {
      const supabase = createClient();
      const { error: err } = await supabase.from("payment_methods").insert({ ...payload, restaurant_id: rid });
      error = err;
      if (!err) refresh();
    }
    if (error) toast.error((error as any).message);
    else { toast.success(editing ? "Updated!" : "Added!"); setOpen(false); }
    setSaving(false);
  };

  if (!rid) return (
    <div className="bg-white rounded-xl border border-border p-10 text-center">
      <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Select a restaurant to manage payment methods.</p>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Payment Methods</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configure accepted payment options</p>
          </div>
          <div className="flex items-center gap-2">
            <RestaurantPicker restaurants={restaurants} rid={rid} onChangeRid={onChangeRid} />
            <Button size="md" onClick={openAdd}><Plus size={14} /> Add Method</Button>
          </div>
        </div>
        {loading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
          : methods.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No payment methods yet</p>
              <Button size="md" onClick={openAdd} className="mt-3"><Plus size={14} /> Add Method</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    {["Method", "Fee Type", "Fee Value", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {methods.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.name}</td>
                      <td className="px-5 py-3 text-gray-500">{m.fee_type === "percentage" ? "Percentage" : "Fixed Amount"}</td>
                      <td className="px-5 py-3 text-gray-700">{m.fee_type === "percentage" ? `${m.fee_value}%` : `৳${m.fee_value}`}</td>
                      <td className="px-5 py-3"><Switch checked={m.is_active} onCheckedChange={(v) => update(m.id, { is_active: v })} label={undefined} /></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => { if (confirm(`Delete "${m.name}"?`)) remove(m.id); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Edit Payment Method" : "Add Payment Method"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save" : "Add"}</Button></>}>
        <div className="space-y-4">
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

function BillingTab({ rid, onChangeRid, restaurants }: { rid: string; onChangeRid: (id: string) => void; restaurants: Restaurant[] }) {
  const { settings, loading: bLoading, save } = useBillingSettings(rid);
  const { discounts, loading: dLoading, create, update, remove } = useDiscounts(rid);
  const { items: foodItems } = useFoodItems(rid);
  const [vat, setVat] = useState("0");
  const [vatOn, setVatOn] = useState<"order" | "item">("order");
  const [serviceCharge, setServiceCharge] = useState("0");
  const [saving, setSaving] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState<Discount | null>(null);
  const [dForm, setDForm] = useState({ name: "", discount_type: "percentage" as "percentage" | "amount", discount_value: "0", apply_on: "order" as "order" | "item", food_item_id: "" });
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
  const openAddDiscount = () => { setEditDiscount(null); setDForm({ name: "", discount_type: "percentage", discount_value: "0", apply_on: "order", food_item_id: "" }); setDiscountOpen(true); };
  const openEditDiscount = (d: Discount) => { setEditDiscount(d); setDForm({ name: d.name, discount_type: d.discount_type, discount_value: String(d.discount_value), apply_on: d.apply_on, food_item_id: d.food_item_id ?? "" }); setDiscountOpen(true); };
  const handleSaveDiscount = async () => {
    if (!dForm.name.trim()) return toast.error("Name required");
    if (dForm.apply_on === "item" && !dForm.food_item_id) return toast.error("Select a menu item");
    if (!rid) return toast.error("Select a restaurant first");
    setDSaving(true);
    const payload = { name: dForm.name.trim(), discount_type: dForm.discount_type, discount_value: parseFloat(dForm.discount_value) || 0, apply_on: dForm.apply_on, food_item_id: dForm.apply_on === "item" ? dForm.food_item_id : undefined, is_active: true };
    const { error } = editDiscount ? await update(editDiscount.id, payload) : await create(payload);
    if (error) toast.error(error.message); else { toast.success(editDiscount ? "Updated!" : "Discount added!"); setDiscountOpen(false); }
    setDSaving(false);
  };

  if (!rid) return (
    <div className="bg-white rounded-xl border border-border p-10 text-center">
      <Receipt size={36} className="text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Select a restaurant to manage billing settings.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">VAT & Service Charge</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configure tax and service charge for orders</p>
          </div>
          <RestaurantPicker restaurants={restaurants} rid={rid} onChangeRid={onChangeRid} />
        </div>
        {bLoading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div> : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="VAT Percentage (%)" type="number" min="0" step="0.01" placeholder="0.00" value={vat} onChange={(e) => setVat(e.target.value)} hint="Leave 0 to disable VAT" />
              <Input label="Service Charge (%)" type="number" min="0" step="0.01" placeholder="0.00" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} hint="Leave 0 to disable service charge" />
            </div>
            <div className="flex justify-end"><Button onClick={handleSaveBilling} loading={saving}>Save Billing Settings</Button></div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div><h2 className="font-semibold text-gray-900">Discounts</h2><p className="text-sm text-gray-500 mt-0.5">Create reusable discounts for orders</p></div>
          <Button size="md" onClick={openAddDiscount}><Plus size={14} /> Add Discount</Button>
          {/* no extra picker here — VAT section already has it */}
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
                      <td className="px-5 py-3"><Switch checked={d.is_active} onCheckedChange={(v) => update(d.id, { is_active: v })} label={undefined} /></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEditDiscount(d)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => { if (confirm(`Delete "${d.name}"?`)) remove(d.id); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Apply On</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setDForm((p) => ({ ...p, apply_on: "order" }))}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors",
                  dForm.apply_on === "order" ? "bg-[#111827] text-white" : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}>
                Entire Order
              </button>
              <button
                type="button"
                onClick={() => setDForm((p) => ({ ...p, apply_on: "item", food_item_id: "" }))}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200",
                  dForm.apply_on === "item" ? "bg-[#111827] text-white" : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}>
                Individual Items
              </button>
            </div>
          </div>
          {dForm.apply_on === "item" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Menu Item</label>
              <select
                value={dForm.food_item_id}
                onChange={(e) => setDForm((p) => ({ ...p, food_item_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent"
              >
                <option value="">— Select item —</option>
                {foodItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function TablesTab({ rid, onChangeRid, restaurants }: { rid: string; onChangeRid: (id: string) => void; restaurants: Restaurant[] }) {
  const { tables, loading, create, update, remove } = useTables(rid);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCap, setEditCap] = useState("");
  const [newName, setNewName] = useState("");
  const [newCap, setNewCap] = useState("4");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || !rid) return;
    if (!newCap || parseInt(newCap) < 1) return toast.error("Seat count must be at least 1");
    setAdding(true);
    const { error } = await create(newName.trim(), parseInt(newCap));
    if (error) toast.error(error.message); else { setNewName(""); setNewCap("4"); toast.success("Table added!"); }
    setAdding(false);
  };
  const handleUpdate = async (t: Table) => {
    if (!editName.trim()) return;
    if (!editCap || parseInt(editCap) < 1) return toast.error("Seat count must be at least 1");
    const { error } = await update(t.id, { name: editName.trim(), capacity: parseInt(editCap) });
    if (error) toast.error(error.message); else { setEditId(null); toast.success("Updated!"); }
  };

  if (!rid) return (
    <div className="bg-white rounded-xl border border-border p-10 text-center">
      <LayoutGrid size={36} className="text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Select a restaurant to manage tables.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-gray-900">Table Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage seating tables and sections</p>
        </div>
        <RestaurantPicker restaurants={restaurants} rid={rid} onChangeRid={onChangeRid} />
      </div>
      <div className="p-4 border-b border-border bg-gray-50/50">
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="Table name (e.g. T1, VIP-1)"
            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input type="number" min="1" value={newCap} onChange={(e) => setNewCap(e.target.value)} placeholder="Seats"
            className="w-24 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <Button size="md" onClick={handleAdd} loading={adding}><Plus size={14} /> Add</Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Enter table name + seat capacity, press Enter or click Add</p>
      </div>
      {loading ? <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        : tables.length === 0 ? (<div className="p-12 text-center"><LayoutGrid size={36} className="text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-400">No tables yet — add one above</p></div>)
        : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tables.map((t) => (
              <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-2">
                {editId === t.id ? (
                  <>
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-full" />
                    <input type="number" min="1" value={editCap} onChange={(e) => setEditCap(e.target.value)} placeholder="Seats" className="h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-full" />
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdate(t)} className="flex-1 h-7 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"><Check size={12} /></button>
                      <button onClick={() => setEditId(null)} className="flex-1 h-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"><X size={12} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">{t.name.slice(0, 2).toUpperCase()}</div>
                      <Switch checked={t.is_active} onCheckedChange={(v) => update(t.id, { is_active: v })} label={undefined} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.capacity} seats · #{t.table_number ?? "—"}</p>
                    </div>
                    <div className="flex gap-1 mt-auto">
                      <button onClick={() => { setEditId(t.id); setEditName(t.name); setEditCap(String(t.capacity)); }} className="flex-1 h-7 rounded-lg text-gray-400 hover:bg-gray-100 flex items-center justify-center"><Pencil size={12} /></button>
                      <button onClick={() => { if (confirm(`Delete table "${t.name}"?`)) remove(t.id); }} className="flex-1 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><Trash2 size={12} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function PrintTab({ rid, onChangeRid, restaurants }: { rid: string; onChangeRid: (id: string) => void; restaurants: Restaurant[] }) {
  const { settings, loading, save } = usePrintSettings(rid);
  const { settings: billingSettings } = useBillingSettings(rid);
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

  if (!rid) return (
    <div className="bg-white rounded-xl border border-border p-10 text-center">
      <Printer size={36} className="text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Select a restaurant to manage print settings.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-gray-900">Print Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure what appears on printed bills and receipts</p>
        </div>
        <RestaurantPicker restaurants={restaurants} rid={rid} onChangeRid={onChangeRid} />
      </div>
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
            <textarea value={form.greeting} onChange={(e) => setForm((p) => ({ ...p, greeting: e.target.value }))} placeholder="e.g. Thank you for dining with us! Come again soon." rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          {/* Receipt Preview */}
          {(() => {
            const activeR = restaurants.find((r) => r.id === rid);
            const demoItems = [
              { name: "Wagyu Beef Burger", qty: 2, price: 850 },
              { name: "Truffle Fries", qty: 1, price: 320 },
              { name: "Lemonade", qty: 3, price: 180 },
            ];
            const subtotal = demoItems.reduce((s, i) => s + i.qty * i.price, 0);
            const vatPct = billingSettings?.vat_percentage ?? 0;
            const scPct = billingSettings?.service_charge_percentage ?? 0;
            const vatAmt = (subtotal * vatPct) / 100;
            const scAmt = (subtotal * scPct) / 100;
            const total = subtotal + vatAmt + scAmt;
            return (
              <div className="border border-dashed border-gray-200 rounded-xl p-5 bg-gray-50/40">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Receipt Preview</p>
                {/* Receipt paper */}
                <div className="max-w-xs mx-auto bg-white border border-gray-100 rounded-lg shadow-sm p-4 font-mono text-[11px] text-gray-700 space-y-0">
                  {/* Header */}
                  <div className="text-center space-y-0.5 pb-3 border-b border-dashed border-gray-200">
                    {form.show_logo && (
                      <p className="font-bold text-sm text-gray-900 tracking-wide">
                        {activeR?.name ?? "Restaurant Name"}
                      </p>
                    )}
                    {form.show_address && (
                      <p className="text-gray-400 text-[10px]">
                        {activeR?.address ?? activeR?.location ?? "123 Restaurant St, Dhaka"}
                      </p>
                    )}
                    {form.show_phone && (
                      <p className="text-gray-400 text-[10px]">
                        {activeR?.phone ?? "+880 1700 000000"}
                      </p>
                    )}
                    {form.show_social && activeR?.social_links && activeR.social_links.length > 0 && (
                      <p className="text-gray-400 text-[10px]">
                        {activeR.social_links.map((sl) => sl.url).join("  ·  ")}
                      </p>
                    )}
                  </div>

                  {/* Order info */}
                  <div className="py-2.5 border-b border-dashed border-gray-200 space-y-0.5">
                    <div className="flex justify-between text-gray-500">
                      <span>Order</span><span className="font-medium text-gray-700">#ORD-2026-0042</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Date</span><span>26 Mar 2026  8:45 PM</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Table</span><span>T-04</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Served by</span><span>Rahim</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="py-2.5 border-b border-dashed border-gray-200 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      <span>Item</span><span>Qty × Price</span><span>Total</span>
                    </div>
                    {demoItems.map((item) => (
                      <div key={item.name} className="flex justify-between gap-1">
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className="text-gray-400 shrink-0">{item.qty}×{item.price}</span>
                        <span className="font-medium shrink-0 w-16 text-right">৳{(item.qty * item.price).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="py-2.5 space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span><span>৳{subtotal.toLocaleString()}</span>
                    </div>
                    {vatPct > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>VAT ({vatPct}%)</span><span>৳{vatAmt.toFixed(0)}</span>
                      </div>
                    )}
                    {scPct > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Service Charge ({scPct}%)</span><span>৳{scAmt.toFixed(0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-xs pt-1 border-t border-gray-200">
                      <span>TOTAL</span><span>৳{total.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 text-[10px]">
                      <span>Payment</span><span>Cash</span>
                    </div>
                  </div>

                  {/* Footer */}
                  {(form.biin || form.greeting) && (
                    <div className="pt-2.5 border-t border-dashed border-gray-200 text-center space-y-0.5">
                      {form.biin && <p className="text-gray-400 text-[10px]">BIIN: {form.biin}</p>}
                      {form.greeting && <p className="italic text-gray-400 text-[10px]">{form.greeting}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end"><Button onClick={handleSave} loading={saving}><Printer size={14} /> Save Print Settings</Button></div>
        </div>
      )}
    </div>
  );
}

// ── Role meta ──────────────────────────────────────────────────────────────
const ROLE_META: Record<AppUserRoleType, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: "Super Admin", color: "bg-amber-100 text-amber-700", icon: ShieldCheck },
  owner:       { label: "Owner",       color: "bg-purple-100 text-purple-700", icon: Crown },
  manager:     { label: "Manager",     color: "bg-blue-100 text-blue-700",   icon: Briefcase },
  cashier:     { label: "Cashier",     color: "bg-green-100 text-green-700", icon: ShoppingCart },
  viewer:      { label: "Viewer",      color: "bg-gray-100 text-gray-600",   icon: Eye },
};

const ROLE_OPTIONS: AppUserRoleType[] = ["owner", "manager", "cashier", "viewer"];

function TeamTab({ rid, onChangeRid, restaurants }: { rid: string; onChangeRid: (id: string) => void; restaurants: Restaurant[] }) {
  const { members, loading, addMember, updateRole, toggleActive, removeMember } = useRestaurantMembers(rid || undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "owner" as AppUserRoleType, password: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.email.trim() || !form.name.trim() || !form.password.trim()) return toast.error("All fields are required");
    setSaving(true);
    const { error } = await addMember(form);
    if (error) toast.error(error.message);
    else { toast.success("Member added & login credentials created!"); setOpen(false); setForm({ email: "", name: "", role: "owner", password: "" }); }
    setSaving(false);
  };

  if (!rid) return (
    <div className="bg-white rounded-xl border border-border p-10 text-center">
      <Users size={36} className="text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Select a restaurant to manage team members.</p>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Team Members</h2>
            <p className="text-sm text-gray-500 mt-0.5">Control who has access to this restaurant</p>
          </div>
          <div className="flex items-center gap-2">
            <RestaurantPicker restaurants={restaurants} rid={rid} onChangeRid={onChangeRid} />
            <Button size="md" onClick={() => setOpen(true)}><UserPlus size={14} /> Add Member</Button>
          </div>
        </div>

        {/* Role legend */}
        <div className="px-5 py-3 bg-gray-50/60 border-b border-border flex items-center gap-3 flex-wrap">
          {Object.entries(ROLE_META).map(([role, meta]) => {
            const Icon = meta.icon;
            return (
              <span key={role} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                <Icon size={10} /> {meta.label}
              </span>
            );
          })}
        </div>

        {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          : members.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No team members yet</p>
              <Button size="md" onClick={() => setOpen(true)} className="mt-3"><UserPlus size={14} /> Add Member</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    {["Member", "Email", "Role", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => {
                    const meta = ROLE_META[m.role as AppUserRoleType] ?? ROLE_META.viewer;
                    const Icon = meta.icon;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-bold">{(m.name || m.email)[0].toUpperCase()}</span>
                            </div>
                            <span className="font-medium text-gray-900">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{m.email}</td>
                        <td className="px-5 py-3">
                          <select
                            value={m.role}
                            onChange={(e) => updateRole(m.id, e.target.value as AppUserRoleType)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900 ${meta.color}`}>
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{ROLE_META[r].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => toggleActive(m.id, !m.is_active)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              m.is_active ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600" : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
                            }`}>
                            {m.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            {m.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <button onClick={() => { if (confirm(`Remove ${m.name} from this restaurant?`)) removeMember(m.id); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={open} onOpenChange={setOpen} title="Add Team Member"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleAdd} loading={saving}>Add Member</Button></>}>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
            <KeyRound size={13} className="shrink-0 mt-0.5" />
            <span>A login account will be created for this member using the email and password you provide. Share these credentials with them.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" placeholder="e.g. Rahman Ali" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Email" type="email" placeholder="person@email.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Password" type="password" placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as AppUserRoleType }))}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Role description */}
          <div className={`p-3 rounded-lg text-xs ${ROLE_META[form.role].color}`}>
            {form.role === "owner" && "Full access to all features and settings for this restaurant."}
            {form.role === "manager" && "Full access except user management and activity logs."}
            {form.role === "cashier" && "Can create and manage orders and view sales reports."}
            {form.role === "viewer" && "Read-only access to dashboard and reports."}
          </div>
        </div>
      </Dialog>
    </>
  );
}

const TABS = [
  { id: "restaurants", label: "Restaurants", icon: Building2 },
  { id: "payments",    label: "Payments",    icon: CreditCard },
  { id: "billing",     label: "Billing",     icon: Receipt },
  { id: "tables",      label: "Table Management", icon: LayoutGrid },
  { id: "print",       label: "Print",       icon: Printer },
];

export default function SettingsPage() {
  const { activeRestaurant, restaurants: allRestaurants, setActiveRestaurant } = useRestaurant();
  const [activeTab, setActiveTab] = useState("restaurants");
  const [activeRid, setActiveRid] = useState<string>(activeRestaurant?.id ?? "");
  const [tabSearch, setTabSearch] = useState("");

  // Sync when context updates (e.g. first load)
  useEffect(() => {
    if (activeRestaurant?.id && !activeRid) setActiveRid(activeRestaurant.id);
  }, [activeRestaurant?.id]);

  const handleChangeRid = (id: string) => {
    setActiveRid(id);
    const r = allRestaurants.find((x) => x.id === id);
    if (r) setActiveRestaurant(r);
  };

  return (
    <div>
      <Header title="Settings" hideRestaurantSelector />
      <div className="p-6 space-y-4">
        {/* Tab bar card */}
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <div className="bg-white border border-border rounded-xl shadow-sm p-3 flex items-center gap-3">
            <Tabs.List className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-1 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <Tabs.Trigger key={id} value={id}
                  className={cn(
                    "flex items-center gap-1 flex-1 justify-center h-7 rounded-md text-[12px] font-medium transition-all focus:outline-none whitespace-nowrap px-2",
                    activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}>
                  <Icon size={12} className="shrink-0" />
                  <span>{label}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {/* Search */}
            <div className="relative shrink-0 ml-[150px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={tabSearch}
                onChange={(e) => setTabSearch(e.target.value)}
                placeholder="Search..."
                className="w-44 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tab content */}
          <Tabs.Content value="restaurants" className="mt-4"><RestaurantsTab search={tabSearch} /></Tabs.Content>
          <Tabs.Content value="payments"    className="mt-4"><PaymentMethodsTab rid={activeRid} onChangeRid={handleChangeRid} restaurants={allRestaurants} /></Tabs.Content>
          <Tabs.Content value="billing"     className="mt-4"><BillingTab rid={activeRid} onChangeRid={handleChangeRid} restaurants={allRestaurants} /></Tabs.Content>
          <Tabs.Content value="tables"      className="mt-4"><TablesTab rid={activeRid} onChangeRid={handleChangeRid} restaurants={allRestaurants} /></Tabs.Content>
          <Tabs.Content value="print"       className="mt-4"><PrintTab rid={activeRid} onChangeRid={handleChangeRid} restaurants={allRestaurants} /></Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
