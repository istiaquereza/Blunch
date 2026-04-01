"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useIngredients } from "@/hooks/use-ingredients";
import { useInventoryGroups } from "@/hooks/use-inventory-groups";
import { Plus, Edit2, Trash2, Search, FlaskConical, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { Ingredient } from "@/types";

const UNIT_OPTIONS: Record<string, string[]> = {
  weight: ["mg", "g", "lb", "kg"],
  volume: ["ml", "l", "cup", "tbsp"],
  unit: ["cm", "m", "inch", "ft"],
  quantity: ["pc", "dozen", "pack"],
};
const UNIT_TYPES = [
  { value: "weight", label: "Weight" },
  { value: "volume", label: "Volume" },
  { value: "unit", label: "Unit (Length)" },
  { value: "quantity", label: "Quantity" },
];

interface IngForm {
  name: string; unit_type: string; default_unit: string;
  unit_price: string; inventory_group_id: string;
}
const emptyForm: IngForm = { name: "", unit_type: "weight", default_unit: "g", unit_price: "", inventory_group_id: "" };

export default function IngredientsPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { ingredients, loading, create, update, remove } = useIngredients(rid);
  const { groups, create: createGroup, update: updateGroup, remove: removeGroup } = useInventoryGroups(rid);

  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [ingOpen, setIngOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<IngForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [editGroup, setEditGroup] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() =>
    ingredients.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      (filterGroup ? i.inventory_group_id === filterGroup : true)
    ), [ingredients, search, filterGroup]);

  const unitOptions = (UNIT_OPTIONS[form.unit_type] ?? []).map((u) => ({ value: u, label: u }));

  const f = (k: keyof IngForm, v: string) =>
    setForm((p) => ({ ...p, [k]: v, ...(k === "unit_type" ? { default_unit: UNIT_OPTIONS[v]?.[0] ?? "" } : {}) }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setIngOpen(true); };
  const openEdit = (i: Ingredient) => {
    setEditing(i);
    setForm({ name: i.name, unit_type: i.unit_type, default_unit: i.default_unit, unit_price: String(i.unit_price), inventory_group_id: i.inventory_group_id ?? "" });
    setIngOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (!rid) return toast.error("Select a restaurant first");
    setSaving(true);
    const payload = { name: form.name.trim(), unit_type: form.unit_type as Ingredient["unit_type"], default_unit: form.default_unit, unit_price: parseFloat(form.unit_price) || 0, inventory_group_id: form.inventory_group_id || undefined, restaurant_id: rid };
    const { error } = editing ? await update(editing.id, payload) : await create(payload);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Updated!" : "Ingredient added!"); setIngOpen(false); }
    setSaving(false);
  };

  const handleDelete = async (i: Ingredient) => {
    if (!confirm(`Delete "${i.name}"?`)) return;
    const { error } = await remove(i.id);
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
    <div><Header title="Food Ingredients" />
      <div className="p-6"><div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
        <FlaskConical size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-medium text-gray-500">No restaurant selected</p>
        <p className="text-sm text-gray-400 mt-1">Go to <strong>Settings</strong> to add a restaurant first</p>
      </div></div>
    </div>
  );

  return (
    <div>
      <Header title="Food Ingredients" hideRestaurantSelector={true} />
      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-border shadow-sm shrink-0 h-[62px] flex items-center px-[14px] gap-3 overflow-x-auto">
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
            className="h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
            <option value="">All Groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-9" onClick={() => setGroupOpen(true)}>Manage Groups</Button>
          <Button size="sm" className="h-9" onClick={openAdd}><Plus size={14} /> Add Ingredient</Button>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients..."
              className="w-52 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden overflow-x-auto">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="text-gray-700 text-sm">Food Ingredients <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
          </div>
          {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FlaskConical size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{search || filterGroup ? "No results found" : "No ingredients yet"}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/60">
                    {["Name", "Unit Type", "Default Unit", "Unit Price", "Group", "Actions"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{i.name}</td>
                      <td className="px-5 py-3"><Badge variant="info">{i.unit_type}</Badge></td>
                      <td className="px-5 py-3 text-gray-600">{i.default_unit}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">৳{Number(i.unit_price).toFixed(2)}<span className="text-gray-400 text-xs ml-1">/{i.default_unit}</span></td>
                      <td className="px-5 py-3">{i.inventory_groups ? <Badge variant="purple">{i.inventory_groups.name}</Badge> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Edit2 size={13} /></Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(i)}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Add / Edit Ingredient */}
      <Dialog open={ingOpen} onOpenChange={setIngOpen} title={editing ? "Edit Ingredient" : "Add Ingredient"}
        footer={<><Button variant="outline" onClick={() => setIngOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? "Save Changes" : "Add Ingredient"}</Button></>}>
        <div className="space-y-4">
          <Input label="Ingredient Name" placeholder="e.g. Chicken Breast" value={form.name} onChange={(e) => f("name", e.target.value)} />
          <Select label="Unit Type" value={form.unit_type} onChange={(e) => f("unit_type", e.target.value)} options={UNIT_TYPES} />
          <Select label="Default Unit" value={form.default_unit} onChange={(e) => f("default_unit", e.target.value)} options={unitOptions} />
          <Input label={`Unit Price (৳ per ${form.default_unit})`} type="number" min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={(e) => f("unit_price", e.target.value)} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Inventory Group</label>
            <div className="flex gap-2">
              <select value={form.inventory_group_id} onChange={(e) => f("inventory_group_id", e.target.value)}
                className="flex-1 h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="">No group</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={() => setGroupOpen(true)}>Manage</Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Manage Groups */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen} title="Manage Inventory Groups">
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
    </div>
  );
}
