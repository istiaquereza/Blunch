"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ui/image-upload";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useAssets, useAssetCheckins } from "@/hooks/use-assets";
import { useAssetGroups } from "@/hooks/use-asset-groups";
import {
  Package, Plus, Edit2, Trash2, Search, Pencil, X, Check,
  ClipboardList, ChevronDown, ChevronUp, History,
} from "lucide-react";
import { toast } from "sonner";
import type { Asset } from "@/types";
import { format } from "date-fns";

const CONDITION_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "average", label: "Average" },
  { value: "low", label: "Low" },
];

const conditionBadge = (c: Asset["condition"]): "success" | "warning" | "danger" =>
  c === "good" ? "success" : c === "average" ? "warning" : "danger";

interface AssetForm {
  name: string; asset_group_id: string; quantity: string;
  unit_price: string; purchase_date: string; condition: Asset["condition"]; notes: string;
  image_url: string;
}
const emptyForm: AssetForm = {
  name: "", asset_group_id: "", quantity: "1", unit_price: "0",
  purchase_date: "", condition: "good", notes: "", image_url: "",
};

function CheckinHistory({ assetId }: { assetId: string }) {
  const { checkins, loading } = useAssetCheckins(assetId);
  if (loading) return <p className="text-xs text-gray-400 py-2">Loading history...</p>;
  if (checkins.length === 0) return <p className="text-xs text-gray-400 py-2">No check-ins recorded.</p>;
  return (
    <div className="space-y-0 max-h-48 overflow-y-auto">
      {checkins.map((c) => (
        <div key={c.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-100 last:border-0">
          <span className="text-gray-400 w-24 shrink-0">{format(new Date(c.checkin_date), "dd MMM yyyy")}</span>
          {c.quantity_in > 0 && <span className="text-green-600 font-medium">+{c.quantity_in} in</span>}
          {c.quantity_out > 0 && <span className="text-red-500 font-medium">-{c.quantity_out} out</span>}
          {c.note && <span className="text-gray-400 truncate">{c.note}</span>}
        </div>
      ))}
    </div>
  );
}

function CheckinDialog({ asset, open, onClose, onQuantityUpdate }: { asset: Asset; open: boolean; onClose: () => void; onQuantityUpdate?: (id: string, qty: number) => Promise<{ error: unknown }> }) {
  const { addCheckin } = useAssetCheckins(asset.id);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [qtyIn, setQtyIn] = useState("0");
  const [qtyOut, setQtyOut] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const inQty = parseInt(qtyIn) || 0;
    const outQty = parseInt(qtyOut) || 0;
    if (inQty === 0 && outQty === 0) return toast.error("Enter quantity in or out");
    setSaving(true);
    const { error } = await addCheckin({ asset_id: asset.id, checkin_date: date, quantity_in: inQty, quantity_out: outQty, note: notes });
    if (error) toast.error(error.message);
    else {
      const newQty = Math.max(0, asset.quantity + inQty - outQty);
      await onQuantityUpdate?.(asset.id, newQty);
      toast.success(`Check-in recorded · New qty: ${newQty}`);
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose} title={`Log Check-in — ${asset.name}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} loading={saving}>Save Check-in</Button></>}>
      <div className="space-y-4">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity In" type="number" min="0" value={qtyIn} onChange={(e) => setQtyIn(e.target.value)} />
          <Input label="Quantity Out" type="number" min="0" value={qtyOut} onChange={(e) => setQtyOut(e.target.value)} />
        </div>
        <Input label="Notes (optional)" placeholder="e.g. Monthly maintenance check" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5"><History size={13} /> Recent History</p>
          <CheckinHistory assetId={asset.id} />
        </div>
      </div>
    </Dialog>
  );
}

export default function AssetsPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { assets, loading, create, update, remove } = useAssets(rid);
  const { groups, create: createGroup, update: updateGroup, remove: removeGroup } = useAssetGroups(rid);

  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [editGroup, setEditGroup] = useState<{ id: string; name: string } | null>(null);
  const [checkinAsset, setCheckinAsset] = useState<Asset | null>(null);

  const filtered = useMemo(() =>
    assets.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) &&
      (filterGroup ? a.asset_group_id === filterGroup : true) &&
      (filterCondition ? a.condition === filterCondition : true)
    ), [assets, search, filterGroup, filterCondition]);

  const totalValue = useMemo(() => filtered.reduce((s, a) => s + a.price * a.quantity, 0), [filtered]);

  const f = (k: keyof AssetForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({ name: a.name, asset_group_id: a.asset_group_id ?? "", quantity: String(a.quantity), unit_price: String(a.price), purchase_date: a.purchase_date ?? "", condition: a.condition, notes: a.notes ?? "", image_url: a.image_url ?? "" });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Asset name required");
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);
    const payload = {
      name: form.name.trim(), asset_group_id: form.asset_group_id || null, restaurant_id: rid,
      quantity: parseInt(form.quantity) || 1, price: parseFloat(form.unit_price) || 0,
      purchase_date: form.purchase_date || null, condition: form.condition, notes: form.notes || null,
      image_url: form.image_url || null,
    } as Omit<Asset, "id" | "created_at" | "updated_at" | "asset_groups">;
    const { error } = editing ? await update(editing.id, payload) : await create(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Asset updated!" : "Asset added!"); setFormOpen(false); }
    setSaving(false);
  };

  const handleDelete = async (a: Asset) => {
    if (!confirm(`Delete "${a.name}"?`)) return;
    const { error } = await remove(a.id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  const handleAddGroup = async () => {
    if (!newGroup.trim() || !rid) return;
    const { error } = await createGroup(newGroup.trim());
    if (error) toast.error(error.message); else { setNewGroup(""); toast.success("Group added"); }
  };

  const handleUpdateGroup = async () => {
    if (!editGroup) return;
    const { error } = await updateGroup(editGroup.id, editGroup.name);
    if (error) toast.error(error.message); else { setEditGroup(null); toast.success("Updated"); }
  };

  if (!rid) return (
    <div><Header title="Asset Inventory" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border p-12 text-center">
        <Package size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
        <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
      </div></div>
    </div>
  );

  return (
    <div>
      <Header title="Asset Inventory" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Assets", value: assets.length, sub: "items tracked" },
            { label: "Total Value", value: `৳${assets.reduce((s, a) => s + a.price * a.quantity, 0).toLocaleString()}`, sub: "current value" },
            { label: "Good Condition", value: assets.filter((a) => a.condition === "good").length, sub: "assets" },
            { label: "Needs Attention", value: assets.filter((a) => a.condition === "low").length, sub: "low condition" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
              <p className="text-xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Conditions</option>
              <option value="good">Good</option>
              <option value="average">Average</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setGroupOpen(true)}>Manage Groups</Button>
            <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Asset</Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Assets <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
            {filtered.length > 0 && <span className="text-sm text-gray-500">Total: <strong className="text-gray-900">৳{totalValue.toLocaleString()}</strong></span>}
          </div>
          {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Package size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{search || filterGroup || filterCondition ? "No results found" : "No assets yet"}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    {["Photo", "Asset Name", "Group", "Qty", "Unit Price", "Total Value", "Purchase Date", "Condition", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.flatMap((a) => {
                    const rows = [
                      <tr key={a.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                            {a.image_url
                              ? <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                              : <Package size={16} className="text-gray-300" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            className="flex items-center gap-1.5 font-medium text-gray-900 hover:text-orange-600 text-left">
                            {expandedId === a.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {a.name}
                          </button>
                          {a.notes && <p className="text-xs text-gray-400 mt-0.5 ml-5 truncate max-w-[200px]">{a.notes}</p>}
                        </td>
                        <td className="px-4 py-3">{a.asset_groups ? <Badge variant="info">{a.asset_groups.name}</Badge> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{a.quantity}</td>
                        <td className="px-4 py-3 text-gray-600">৳{Number(a.price).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">৳{(a.price * a.quantity).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">{a.purchase_date ? format(new Date(a.purchase_date), "dd MMM yyyy") : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3"><Badge variant={conditionBadge(a.condition)}>{a.condition}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setCheckinAsset(a)} title="Log Check-in"
                              className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 flex items-center justify-center transition-colors">
                              <ClipboardList size={12} />
                            </button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Edit2 size={13} /></Button>
                            <Button variant="danger" size="sm" onClick={() => handleDelete(a)}><Trash2 size={13} /></Button>
                          </div>
                        </td>
                      </tr>,
                    ];
                    if (expandedId === a.id) {
                      rows.push(
                        <tr key={`${a.id}-exp`}>
                          <td colSpan={9} className="px-8 py-3 bg-gray-50/80 border-b border-border">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Check-in History</p>
                            <CheckinHistory assetId={a.id} />
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? "Edit Asset" : "Add Asset"}
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save Changes" : "Add Asset"}</Button></>}>
        <div className="space-y-4">
          <ImageUpload
            bucket="asset-images"
            value={form.image_url}
            onChange={(url) => setForm((p) => ({ ...p, image_url: url }))}
            label="Asset Photo"
          />
          <Input label="Asset Name" placeholder="e.g. Commercial Refrigerator" value={form.name} onChange={(e) => f("name", e.target.value)} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Asset Group</label>
            <div className="flex gap-2">
              <select value={form.asset_group_id} onChange={(e) => f("asset_group_id", e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">No group</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={() => setGroupOpen(true)}>Manage</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" min="0" value={form.quantity} onChange={(e) => f("quantity", e.target.value)} />
            <Input label="Unit Price (৳)" type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={(e) => f("unit_price", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Purchase Date" type="date" value={form.purchase_date} onChange={(e) => f("purchase_date", e.target.value)} />
            <Select label="Condition" value={form.condition} onChange={(e) => f("condition", e.target.value as Asset["condition"])} options={CONDITION_OPTIONS} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} placeholder="Any additional notes..."
              rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
        </div>
      </Dialog>

      {/* Manage Groups Dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen} title="Manage Asset Groups">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
              placeholder="New group name..." className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <Button size="sm" onClick={handleAddGroup}><Plus size={14} /> Add</Button>
          </div>
          {groups.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No groups yet</p> : (
            <div className="space-y-1.5">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                  {editGroup?.id === g.id ? (
                    <>
                      <input autoFocus value={editGroup.name} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                        className="flex-1 h-7 px-2 rounded border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      <button onClick={handleUpdateGroup} className="w-7 h-7 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"><Check size={12} /></button>
                      <button onClick={() => setEditGroup(null)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-700">{g.name}</span>
                      <button onClick={() => setEditGroup({ id: g.id, name: g.name })} className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-200 flex items-center justify-center"><Pencil size={12} /></button>
                      <button onClick={() => { if (confirm("Delete?")) removeGroup(g.id); }} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>

      {/* Check-in Dialog */}
      {checkinAsset && <CheckinDialog asset={checkinAsset} open={!!checkinAsset} onClose={() => setCheckinAsset(null)} onQuantityUpdate={async (id, qty) => update(id, { quantity: qty })} />}
    </div>
  );
}
