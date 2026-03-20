"use client";

import { useState, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useStaff, useBenefitPackages } from "@/hooks/use-staff";
import { useFoodCategories } from "@/hooks/use-food-categories";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, FileText, Upload, X, Package,
  User, Phone, MapPin, CalendarDays, ChefHat, Camera, Briefcase, DollarSign, Eye, Users,
} from "lucide-react";
import type { StaffMember, BenefitPackage, BenefitDetail } from "@/hooks/use-staff";

// ─── helpers ──────────────────────────────────────────────────────────────────
function nextIncrement(joiningDate: string | null): string {
  if (!joiningDate) return "—";
  const d = new Date(joiningDate);
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateLong(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtSalary(n: number) {
  return "৳" + Number(n).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayLong() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Empty form ────────────────────────────────────────────────────────────────
const emptyStaffForm = () => ({
  name: "",
  job_role: "",
  staff_type: "" as "" | "kitchen" | "hall",
  salary: "",
  phone: "",
  address: "",
  photo_url: "",
  document_url: "",
  joining_date: "",
  food_category_ids: [] as string[],
  benefit_package_id: "",
});

const emptyPackageForm = () => ({
  name: "",
  details: [{ label: "", value: "" }] as BenefitDetail[],
});

// ─── Employment Letter PDF ─────────────────────────────────────────────────────
function printEmploymentLetter(
  member: StaffMember,
  pkg: BenefitPackage | undefined,
  restaurantName: string,
  restaurantLogo?: string | null,
) {
  const benefitRows = (pkg?.details ?? [])
    .filter((d) => d.label.trim())
    .map((d) => `<li style="margin:4px 0;color:#374151"><strong>${d.label}:</strong> ${d.value}</li>`)
    .join("");

  const logoHtml = restaurantLogo
    ? `<img src="${restaurantLogo}" alt="${restaurantName}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;" />`
    : `<div style="width:48px;height:48px;background:#f97316;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;">${restaurantName.charAt(0).toUpperCase()}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Employment Letter — ${member.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', Georgia, serif;
      color: #111827;
      background: #fff;
      padding: 60px 72px;
      max-width: 800px;
      margin: 0 auto;
      font-size: 14px;
      line-height: 1.7;
    }
    .letterhead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #f97316;
      padding-bottom: 20px;
      margin-bottom: 36px;
    }
    .brand-name { font-size: 22px; font-weight: 800; color: #111827; margin-left: 12px; }
    .letter-date { font-size: 13px; color: #6b7280; text-align: right; }
    .title {
      font-size: 18px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: #f97316;
      text-align: center; margin-bottom: 32px;
    }
    .salutation { margin-bottom: 20px; font-weight: 500; }
    .body-text  { margin-bottom: 16px; color: #374151; text-align: justify; }
    .highlight  { font-weight: 700; color: #111827; }
    .benefits-box {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 18px 24px;
      margin: 24px 0;
    }
    .benefits-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: #ea580c; margin-bottom: 10px;
    }
    .benefits-box ul { padding-left: 18px; }
    .signature-block {
      margin-top: 48px;
      border-top: 1px solid #e5e7eb;
      padding-top: 28px;
    }
    .sincerely { color: #6b7280; margin-bottom: 48px; }
    .sig-line { border-top: 1.5px solid #111827; width: 220px; margin-bottom: 6px; }
    .sig-name   { font-weight: 700; font-size: 15px; }
    .sig-title  { color: #6b7280; font-size: 13px; }
    .sig-org    { color: #f97316; font-size: 13px; font-weight: 600; }
    .footer {
      margin-top: 48px;
      text-align: center;
      font-size: 11px;
      color: #d1d5db;
      border-top: 1px solid #f3f4f6;
      padding-top: 16px;
    }
    @media print { body { padding: 40px 56px; } }
  </style>
</head>
<body>

  <!-- Letterhead -->
  <div class="letterhead">
    <div style="display:flex;align-items:center">
      ${logoHtml}
      <div class="brand-name" style="margin-left:12px">${restaurantName}</div>
    </div>
    <div class="letter-date">
      <div style="font-weight:600;color:#111827">Date</div>
      <div>${todayLong()}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="title">Employment Letter</div>

  <!-- Salutation -->
  <div class="salutation">To Whom It May Concern,</div>

  <!-- Body -->
  <p class="body-text">
    This is to certify that <span class="highlight">${member.name}</span> is employed with
    <span class="highlight">${restaurantName}</span> as a
    <span class="highlight">${member.job_role || "Team Member"}</span>.
  </p>

  <p class="body-text">
    He/She joined the company on <span class="highlight">${fmtDateLong(member.joining_date)}</span>
    and is currently receiving a monthly salary of
    <span class="highlight">${fmtSalary(member.salary)}</span>.
  </p>

  <p class="body-text">
    As part of employment, the employee is entitled to company benefits including meals, leave, and other
    applicable benefits as per company policy.
  </p>

  <p class="body-text">
    This letter is issued upon the employee's request for official purposes.
  </p>

  ${pkg && benefitRows ? `
  <div class="benefits-box">
    <div class="benefits-title">Employee Benefits — ${pkg.name}</div>
    <ul>${benefitRows}</ul>
  </div>` : ""}

  <!-- Signature -->
  <div class="signature-block">
    <p class="sincerely">Sincerely,</p>
    <div class="sig-line"></div>
    <div class="sig-name">Istiaque Reza</div>
    <div class="sig-title">Co-Founder &amp; Authorized Signatory</div>
    <div class="sig-org">Yatai · Blunch</div>
  </div>

  <div class="footer">
    This letter is computer-generated and valid without a physical seal unless otherwise specified. · ${restaurantName}
  </div>

</body>
</html>`;

  const w = window.open("", "_blank", "width=860,height=720");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffInformationPage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const rid = activeRestaurant?.id;
  const { staff, loading, createStaff, updateStaff, deleteStaff } = useStaff(rid);
  const { packages, createPackage, updatePackage, deletePackage } = useBenefitPackages(rid);
  const { categories } = useFoodCategories(rid);

  // ── Staff dialog ──
  const [staffOpen, setStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyStaffForm());
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef   = useRef<HTMLInputElement>(null);

  // ── Package dialog ──
  const [pkgOpen, setPkgOpen]       = useState(false);
  const [pkgListOpen, setPkgListOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<BenefitPackage | null>(null);
  const [pkgForm, setPkgForm]       = useState(emptyPackageForm());
  const [pkgSaving, setPkgSaving]   = useState(false);

  // ── Search ──
  const [search, setSearch] = useState("");
  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? "").includes(search) ||
    (s.job_role ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ── File upload ──
  const uploadFile = useCallback(async (file: File, bucket: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || data.error) { toast.error("Upload failed: " + (data.error ?? res.statusText)); return null; }
    return data.url as string;
  }, []);

  // ── Open / close staff form ──
  const openAdd = () => { setEditingStaff(null); setForm(emptyStaffForm()); setStaffOpen(true); };
  const openEdit = (s: StaffMember) => {
    setEditingStaff(s);
    setForm({
      name: s.name,
      job_role: s.job_role ?? "",
      staff_type: (s.staff_type ?? "") as "" | "kitchen" | "hall",
      salary: s.salary ? String(s.salary) : "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      photo_url: s.photo_url ?? "",
      document_url: s.document_url ?? "",
      joining_date: s.joining_date ?? "",
      food_category_ids: s.food_category_ids ?? [],
      benefit_package_id: s.benefit_package_id ?? "",
    });
    setStaffOpen(true);
  };

  // ── Save staff ──
  const handleSaveStaff = async () => {
    if (!form.name.trim()) { toast.error("Please enter a staff name"); return; }
    if (!rid) { toast.error("No active restaurant selected"); return; }
    setSaving(true);
    const payload = {
      restaurant_id:    rid,
      name:             form.name.trim(),
      job_role:         form.job_role.trim() || null,
      staff_type:       form.staff_type || null,
      salary:           parseFloat(form.salary) || 0,
      phone:            form.phone.trim() || null,
      address:          form.address.trim() || null,
      photo_url:        form.photo_url || null,
      document_url:     form.document_url || null,
      joining_date:     form.joining_date || null,
      food_category_ids: form.food_category_ids,
      benefit_package_id: form.benefit_package_id || null,
    };
    const { error } = editingStaff
      ? await updateStaff(editingStaff.id, payload)
      : await createStaff(payload as any);
    setSaving(false);
    if (error) {
      console.error("Staff save error:", error);
      toast.error("Failed to save: " + (error.message ?? JSON.stringify(error)));
      return;
    }
    toast.success(editingStaff ? "Staff updated" : "Staff added");
    setStaffOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const { error } = await deleteStaff(id);
    if (error) toast.error("Failed to delete"); else toast.success("Staff removed");
  };

  const toggleCat = (catId: string) =>
    setForm((p) => ({
      ...p,
      food_category_ids: p.food_category_ids.includes(catId)
        ? p.food_category_ids.filter((id) => id !== catId)
        : [...p.food_category_ids, catId],
    }));

  // ── Package form ──
  const openAddPkg  = () => { setEditingPkg(null); setPkgForm(emptyPackageForm()); setPkgOpen(true); };
  const openEditPkg = (pkg: BenefitPackage) => {
    setEditingPkg(pkg);
    setPkgForm({ name: pkg.name, details: pkg.details.length ? [...pkg.details] : [{ label: "", value: "" }] });
    setPkgOpen(true);
  };

  const handleSavePkg = async () => {
    if (!pkgForm.name.trim() || !rid) return;
    setPkgSaving(true);
    const payload = {
      restaurant_id: rid,
      name: pkgForm.name.trim(),
      details: pkgForm.details.filter((d) => d.label.trim()),
    };
    const { error } = editingPkg
      ? await updatePackage(editingPkg.id, payload)
      : await createPackage(payload as any);
    setPkgSaving(false);
    if (error) { toast.error("Failed to save package"); return; }
    toast.success(editingPkg ? "Package updated" : "Package created");
    setPkgOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Staff Information" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role or phone…"
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-72"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPkgListOpen(true)}>
              <Package size={14} /> Benefit Packages
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} /> Add Staff
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/60">
                  {["Photo", "Name & Role", "Restaurant", "Joining Date", "Salary", "Benefit Package", "Next Increment", "Actions"].map((h, i) => (
                    <th key={`h-${i}`} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    {search ? "No staff match your search." : 'No staff yet. Click "Add Staff" to get started.'}
                  </td></tr>
                ) : filtered.map((s) => {
                  const pkg      = packages.find((p) => p.id === s.benefit_package_id);
                  const catNames = (s.food_category_ids ?? [])
                    .map((id) => categories.find((c) => c.id === id)?.name)
                    .filter(Boolean) as string[];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt={s.name} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-orange-600">{s.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        {s.job_role  && <p className="text-xs text-orange-600 font-medium">{s.job_role}</p>}
                        {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.restaurants?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(s.joining_date)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        {s.salary ? fmtSalary(s.salary) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {pkg ? (
                          <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-1 rounded-lg border border-purple-100">{pkg.name}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-green-600 font-semibold text-xs whitespace-nowrap">
                        {nextIncrement(s.joining_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(s)} title="Edit"
                            className="w-8 h-8 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors">
                            <Pencil size={13} />
                          </button>
                          {s.document_url ? (
                            <a href={s.document_url} target="_blank" rel="noreferrer" title="View Document"
                              className="w-8 h-8 rounded-lg text-gray-400 hover:bg-purple-50 hover:text-purple-600 flex items-center justify-center transition-colors">
                              <Eye size={13} />
                            </a>
                          ) : (
                            <span title="No document uploaded"
                              className="w-8 h-8 rounded-lg text-gray-200 flex items-center justify-center cursor-not-allowed">
                              <Eye size={13} />
                            </span>
                          )}
                          <button
                            onClick={() => {
                              const rest = restaurants.find((r) => r.id === s.restaurant_id) ?? activeRestaurant;
                              printEmploymentLetter(s, packages.find((p) => p.id === s.benefit_package_id), rest?.name ?? "Restaurant", rest?.logo_url);
                            }}
                            title="Employment Letter PDF"
                            className="w-8 h-8 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 flex items-center justify-center transition-colors">
                            <FileText size={13} />
                          </button>
                          <button onClick={() => handleDelete(s.id, s.name)} title="Delete"
                            className="w-8 h-8 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Staff Dialog ── */}
      <Dialog
        open={staffOpen}
        onOpenChange={setStaffOpen}
        title={editingStaff ? "Edit Staff" : "Add Staff"}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStaffOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStaff} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editingStaff ? "Save Changes" : "Add Staff"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">

          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Photo" className="w-20 h-20 rounded-full object-cover border-2 border-orange-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange-50 border-2 border-dashed border-orange-200 flex items-center justify-center">
                  <User size={28} className="text-orange-300" />
                </div>
              )}
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow hover:bg-orange-600">
                <Camera size={12} />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Staff Photo</p>
              <p className="text-xs text-gray-400">JPG, PNG – max 5MB</p>
              {photoUploading && <p className="text-xs text-orange-500 mt-1">Uploading…</p>}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setPhotoUploading(true);
                const url = await uploadFile(file, "staff-photos");
                setPhotoUploading(false);
                if (url) setForm((p) => ({ ...p, photo_url: url }));
              }} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <User size={13} className="inline mr-1" />Full Name *
            </label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Rahim Uddin"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>

          {/* Role + Staff Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Briefcase size={13} className="inline mr-1" />Job Role / Title
              </label>
              <input value={form.job_role} onChange={(e) => setForm((p) => ({ ...p, job_role: e.target.value }))}
                placeholder="e.g. Head Chef, Cashier"
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Users size={13} className="inline mr-1" />Staff Type
              </label>
              <select value={form.staff_type} onChange={(e) => setForm((p) => ({ ...p, staff_type: e.target.value as "" | "kitchen" | "hall" }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Select type…</option>
                <option value="kitchen">Kitchen Staff</option>
                <option value="hall">Hall Staff</option>
              </select>
            </div>
          </div>

          {/* Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <DollarSign size={13} className="inline mr-1" />Monthly Salary (৳)
            </label>
            <input type="number" min="0" value={form.salary}
              onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))}
              placeholder="e.g. 12000"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>

          {/* Phone + Joining Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Phone size={13} className="inline mr-1" />Phone
              </label>
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+880..."
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <CalendarDays size={13} className="inline mr-1" />Joining Date
              </label>
              <input type="date" value={form.joining_date}
                onChange={(e) => setForm((p) => ({ ...p, joining_date: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MapPin size={13} className="inline mr-1" />Address
            </label>
            <textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              rows={2} placeholder="Full address…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
          </div>

          {/* Food Expertise — kitchen staff only */}
          {form.staff_type !== "hall" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ChefHat size={13} className="inline mr-1" />Food Expertise
            </label>
            {categories.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No food categories found. Add them from the Menu page.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => toggleCat(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      form.food_category_ids.includes(cat.id)
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                    }`}>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Benefit Package */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Package size={13} className="inline mr-1" />Benefit Package
            </label>
            <select value={form.benefit_package_id}
              onChange={(e) => setForm((p) => ({ ...p, benefit_package_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">No package</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
              ))}
            </select>
            {packages.length === 0 && (
              <p className="text-xs text-gray-400 mt-1 italic">No packages yet — create one from "Benefit Packages".</p>
            )}
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Upload size={13} className="inline mr-1" />Upload Document (NID / Contract)
            </label>
            <div onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
              {form.document_url ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700">Document uploaded</p>
                    <a href={form.document_url} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-orange-500 underline">View file</a>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setForm((p) => ({ ...p, document_url: "" })); }}
                    className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                </>
              ) : (
                <>
                  <Upload size={18} className="text-gray-300" />
                  <div>
                    <p className="text-sm text-gray-500">{docUploading ? "Uploading…" : "Click to upload document"}</p>
                    <p className="text-xs text-gray-400">PDF, JPG, PNG – max 10MB</p>
                  </div>
                </>
              )}
            </div>
            <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setDocUploading(true);
                const url = await uploadFile(file, "staff-documents");
                setDocUploading(false);
                if (url) setForm((p) => ({ ...p, document_url: url }));
              }} />
          </div>
        </div>
      </Dialog>

      {/* ── Create / Edit Package Dialog ── */}
      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}
        title={editingPkg ? "Edit Benefit Package" : "Create Benefit Package"}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPkgOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePkg} disabled={pkgSaving || !pkgForm.name.trim()}>
              {pkgSaving ? "Saving…" : editingPkg ? "Save Changes" : "Create Package"}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Package Name *</label>
            <input value={pkgForm.name} onChange={(e) => setPkgForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Standard Package"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Benefit Details</label>
              <button type="button"
                onClick={() => setPkgForm((p) => ({ ...p, details: [...p.details, { label: "", value: "" }] }))}
                className="text-xs text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1">
                <Plus size={12} /> Add Row
              </button>
            </div>
            <div className="space-y-2">
              {pkgForm.details.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={d.label}
                    onChange={(e) => setPkgForm((p) => ({ ...p, details: p.details.map((dd, ii) => ii === i ? { ...dd, label: e.target.value } : dd) }))}
                    placeholder="Benefit (e.g. Leave)"
                    className="flex-1 h-8 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <input value={d.value}
                    onChange={(e) => setPkgForm((p) => ({ ...p, details: p.details.map((dd, ii) => ii === i ? { ...dd, value: e.target.value } : dd) }))}
                    placeholder="Value (e.g. 5 days/month)"
                    className="flex-1 h-8 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  {pkgForm.details.length > 1 && (
                    <button type="button"
                      onClick={() => setPkgForm((p) => ({ ...p, details: p.details.filter((_, ii) => ii !== i) }))}
                      className="w-7 h-7 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">e.g. Leave → 5 days/month · Salary → ৳12,000 · Festival Bonus → 2×</p>
          </div>
        </div>
      </Dialog>

      {/* ── Package List Dialog ── */}
      <Dialog open={pkgListOpen} onOpenChange={setPkgListOpen} title="Benefit Packages"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPkgListOpen(false)}>Close</Button>
            <Button onClick={() => { setPkgListOpen(false); openAddPkg(); }}>
              <Plus size={14} /> New Package
            </Button>
          </div>
        }>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {packages.length === 0 ? (
            <div className="text-center py-10">
              <Package size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No packages yet.</p>
            </div>
          ) : packages.map((pkg) => (
            <div key={pkg.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-900">{pkg.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setPkgListOpen(false); openEditPkg(pkg); }}
                    className="w-7 h-7 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center"><Pencil size={12} /></button>
                  <button onClick={async () => {
                    if (!confirm("Delete package?")) return;
                    const { error } = await deletePackage(pkg.id);
                    if (error) toast.error("Failed"); else toast.success("Deleted");
                  }} className="w-7 h-7 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><Trash2 size={12} /></button>
                </div>
              </div>
              {pkg.details.map((d, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
                  <span className="text-gray-500">{d.label}</span>
                  <span className="font-semibold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
