"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useStaff, useStaffLeaves } from "@/hooks/use-staff";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil,
  CalendarDays, LayoutGrid, ToggleLeft, ToggleRight,
  Search, Printer, Sun,
} from "lucide-react";
import type { StaffLeave } from "@/hooks/use-staff";

// ─── constants ────────────────────────────────────────────────────────────────
const DAYS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LEAVE_TYPES = [
  { value: "sick_leave",     label: "Sick Leave" },
  { value: "personal_leave", label: "Personal Leave" },
  { value: "paid_leave",     label: "Monthly Paid Leave" },
] as const;

type LeaveType = "sick_leave" | "personal_leave" | "paid_leave";

const LEAVE_COLORS: Record<LeaveType, { bg: string; text: string; border: string; dot: string }> = {
  sick_leave:     { bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200",   dot: "bg-red-400" },
  personal_leave: { bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-200",  dot: "bg-blue-400" },
  paid_leave:     { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-400" },
};

const STAFF_TYPE_LABELS: Record<string, string> = {
  chefs: "Chefs", senior_chefs: "Senior Chefs", waiter: "Waiter",
  pickupman: "Pickupman", hall_operations: "Hall Operations", dishwasher: "Dishwasher",
};

const STAFF_TYPE_COLORS: Record<string, string> = {
  chefs: "bg-orange-50 text-orange-700 border-orange-100",
  senior_chefs: "bg-red-50 text-red-700 border-red-100",
  waiter: "bg-blue-50 text-blue-700 border-blue-100",
  pickupman: "bg-cyan-50 text-cyan-700 border-cyan-100",
  hall_operations: "bg-indigo-50 text-indigo-700 border-indigo-100",
  dishwasher: "bg-gray-100 text-gray-600 border-gray-200",
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function startOfWeek(d: Date) {
  const c = new Date(d);
  c.setDate(c.getDate() + (c.getDay() === 0 ? -6 : 1 - c.getDay()));
  c.setHours(0,0,0,0);
  return c;
}
function addDays(d: Date, n: number) {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}

// ─── Print monthly allocation PDF ─────────────────────────────────────────────
function printMonthlyAllocation(
  rows: Array<{
    name: string; job_role: string; photo_url: string | null; staff_type: string | null;
    sick: number; personal: number; paid: number; total: number;
    notes: string[];
    entries: Array<{ leave_date: string; leave_type: string; notes: string | null }>;
  }>,
  month: string,
  restaurantName: string,
) {
  const [y, m] = month.split("-");
  const monthLabel = `${MONTHS[parseInt(m) - 1]} ${y}`;

  const leaveTypeLabel: Record<string, string> = {
    sick_leave: "Sick", personal_leave: "Personal", paid_leave: "Paid",
  };

  // Group by staff_type
  const groups: Record<string, typeof rows> = {};
  rows.forEach(row => {
    const key = row.staff_type ?? "__other__";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const groupHtml = Object.entries(groups).map(([type, groupRows]) => {
    const typeLabel = STAFF_TYPE_LABELS[type] ?? "Other";
    const rowsHtml = groupRows.map(row => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <div style="font-weight:600;color:#111827;">${row.name}</div>
          ${row.job_role ? `<div style="font-size:11px;color:#9ca3af;">${row.job_role}</div>` : ""}
          ${row.entries.map(e =>
            `<div style="font-size:11px;color:#6b7280;margin-top:3px;">
              ${e.leave_date} · ${leaveTypeLabel[e.leave_type] ?? e.leave_type}${e.notes ? ` — ${e.notes}` : ""}
            </div>`
          ).join("")}
        </td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb;color:#ef4444;font-weight:700;">${row.sick || "—"}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb;color:#3b82f6;font-weight:700;">${row.personal || "—"}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb;color:#22c55e;font-weight:700;">${row.paid || "—"}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:700;color:#374151;">${row.total}</td>
      </tr>
    `).join("");
    return `
      <tr>
        <td colspan="5" style="padding:10px 12px 4px;background:#f9fafb;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;border-bottom:1px solid #e5e7eb;">
          ${typeLabel}
        </td>
      </tr>
      ${rowsHtml}
    `;
  }).join("");

  const html = `<!DOCTYPE html><html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Monthly Leave — ${monthLabel} — ${restaurantName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 40px 48px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { padding: 10px 12px; background: #f9fafb; text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    th:first-child { text-align: left; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #111827;padding-bottom:16px;">
    <div>
      <h1 style="font-size:22px;font-weight:800;color:#111827;">Monthly Leave Report</h1>
      <p style="font-size:14px;color:#6b7280;margin-top:4px;">${monthLabel} · ${restaurantName}</p>
    </div>
    <p style="font-size:11px;color:#9ca3af;">Printed: ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Staff</th>
        <th>Sick</th>
        <th>Personal</th>
        <th>Paid</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${groupHtml}</tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LeaveCalendarPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;

  const { staff, loading: staffLoading } = useStaff(rid);
  const { leaves, assignLeave, assignLeaveRange, deleteLeave, updateLeave } = useStaffLeaves(rid);

  const [view, setView] = useState<"today" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [search, setSearch] = useState("");

  // ── Assign Leave dialog ──
  const [assignOpen, setAssignOpen] = useState(false);
  const [isRange, setIsRange] = useState(false);
  const [assignForm, setAssignForm] = useState({
    staff_id: "",
    leave_date: localYmd(new Date()),
    leave_date_end: localYmd(new Date()),
    leave_type: "sick_leave" as LeaveType,
    notes: "",
  });
  const [assigning, setAssigning] = useState(false);

  // ── Edit Leave dialog ──
  const [editLeave, setEditLeave] = useState<StaffLeave | null>(null);
  const [editForm, setEditForm] = useState({ leave_type: "sick_leave" as LeaveType, notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  // ── Allocation ──
  const [tableMonth, setTableMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  // ─── Week view ───────────────────────────────────────────────────────────────
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // ─── Month view ──────────────────────────────────────────────────────────────
  const monthYear = anchor.getFullYear();
  const monthIdx  = anchor.getMonth();
  const firstDay  = new Date(monthYear, monthIdx, 1);
  const lastDay   = new Date(monthYear, monthIdx + 1, 0);
  const startPad  = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const monthCells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(monthYear, monthIdx, i+1)),
  ];
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  // ─── Filtered staff ───────────────────────────────────────────────────────
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.toLowerCase();
    return staff.filter(s => s.name.toLowerCase().includes(q) || (s.job_role ?? "").toLowerCase().includes(q));
  }, [staff, search]);

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const prev = () => {
    if (view === "today") setAnchor(d => addDays(d, -1));
    else if (view === "week") setAnchor(d => addDays(d, -7));
    // Always navigate to 1st to avoid day-overflow (e.g. March 31 + 1 month = May 1)
    else setAnchor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const next = () => {
    if (view === "today") setAnchor(d => addDays(d, 1));
    else if (view === "week") setAnchor(d => addDays(d, 7));
    else setAnchor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  // ─── Leaves index ────────────────────────────────────────────────────────────
  const leavesByDate = useMemo(() => {
    const map: Record<string, typeof leaves> = {};
    leaves.forEach((l) => {
      if (!map[l.leave_date]) map[l.leave_date] = [];
      map[l.leave_date].push(l);
    });
    return map;
  }, [leaves]);

  // ─── Monthly allocation ──────────────────────────────────────────────────
  const allocationRows = useMemo(() => {
    const [y, m] = tableMonth.split("-");
    const prefix = `${y}-${m}-`;
    const monthLeaves = leaves.filter((l) => l.leave_date.startsWith(prefix));

    // Build leave counts keyed by staff_id
    const byStaff: Record<string, { sick: number; personal: number; paid: number; notes: string[]; entries: typeof leaves }> = {};
    monthLeaves.forEach((l) => {
      if (!byStaff[l.staff_id]) byStaff[l.staff_id] = { sick: 0, personal: 0, paid: 0, notes: [], entries: [] };
      if (l.leave_type === "sick_leave")     byStaff[l.staff_id].sick++;
      if (l.leave_type === "personal_leave") byStaff[l.staff_id].personal++;
      if (l.leave_type === "paid_leave")     byStaff[l.staff_id].paid++;
      if (l.notes) byStaff[l.staff_id].notes.push(l.notes);
      byStaff[l.staff_id].entries.push(l);
    });

    // Start from ALL staff so every type appears even with zero leaves
    return staff.map((s) => {
      const d = byStaff[s.id] ?? { sick: 0, personal: 0, paid: 0, notes: [], entries: [] };
      return {
        staff_id: s.id,
        name: s.name,
        job_role: s.job_role ?? "",
        photo_url: s.photo_url ?? null,
        staff_type: s.staff_type ?? null,
        sick: d.sick, personal: d.personal, paid: d.paid,
        total: d.sick + d.personal + d.paid,
        notes: d.notes,
        entries: [...d.entries].sort((a, b) => a.leave_date.localeCompare(b.leave_date)),
      };
    }).sort((a, b) => {
      const ta = a.staff_type ?? "zzz";
      const tb = b.staff_type ?? "zzz";
      if (ta !== tb) return ta.localeCompare(tb);
      return b.total - a.total;
    });
  }, [leaves, tableMonth, staff]);

  // Group allocation rows by staff_type for section headers
  const allocationGroups = useMemo(() => {
    const groups: { typeKey: string | null; rows: typeof allocationRows }[] = [];
    for (const row of allocationRows) {
      const last = groups[groups.length - 1];
      if (!last || last.typeKey !== row.staff_type) {
        groups.push({ typeKey: row.staff_type, rows: [row] });
      } else {
        last.rows.push(row);
      }
    }
    return groups;
  }, [allocationRows]);

  // ─── Assign handler ─────────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignForm.staff_id || !assignForm.leave_date || !rid) return;
    setAssigning(true);
    let error;
    if (isRange && assignForm.leave_date_end > assignForm.leave_date) {
      ({ error } = await assignLeaveRange({
        restaurant_id: rid,
        staff_id: assignForm.staff_id,
        leave_date: assignForm.leave_date,
        leave_date_end: assignForm.leave_date_end,
        leave_type: assignForm.leave_type,
        notes: assignForm.notes.trim() || undefined,
      }));
    } else {
      ({ error } = await assignLeave({
        restaurant_id: rid,
        staff_id: assignForm.staff_id,
        leave_date: assignForm.leave_date,
        leave_type: assignForm.leave_type,
        notes: assignForm.notes.trim() || undefined,
      }));
    }
    setAssigning(false);
    if (error) { toast.error("Failed to assign leave"); return; }
    toast.success("Leave assigned");
    setAssignOpen(false);
    setAssignForm({ staff_id: "", leave_date: localYmd(new Date()), leave_date_end: localYmd(new Date()), leave_type: "sick_leave", notes: "" });
    setIsRange(false);
  };

  // ─── Edit handlers ───────────────────────────────────────────────────────────
  const openEditLeave = (l: StaffLeave) => {
    setEditLeave(l);
    setEditForm({ leave_type: l.leave_type as LeaveType, notes: l.notes ?? "" });
  };

  const handleEditSave = async () => {
    if (!editLeave) return;
    setEditSaving(true);
    const { error } = await updateLeave(editLeave.id, {
      leave_type: editForm.leave_type,
      notes: editForm.notes.trim() || null,
    });
    setEditSaving(false);
    if (error) { toast.error("Failed to update leave"); return; }
    toast.success("Leave updated");
    setEditLeave(null);
  };

  const handleEditDelete = async () => {
    if (!editLeave) return;
    if (!confirm("Remove this leave entry?")) return;
    const { error } = await deleteLeave(editLeave.id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Leave removed");
    setEditLeave(null);
  };

  const todayYmd = localYmd(new Date());
  const anchorYmd = localYmd(anchor);

  const headerLabel = view === "today"
    ? anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "week"
    ? `${weekDays[0].toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – ${weekDays[6].toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}`
    : `${MONTHS[monthIdx]} ${monthYear}`;

  // ─── Reusable renderers ──────────────────────────────────────────────────────
  const renderStaffCell = (s: typeof staff[0]) => (
    <div className="px-3 py-2.5 flex items-center gap-2 border-r border-border min-w-0">
      {s.photo_url ? (
        <img src={s.photo_url} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-orange-600">{s.name.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="min-w-0">
        <span className="text-sm font-medium text-gray-800 truncate block">{s.name}</span>
        {s.staff_type && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STAFF_TYPE_COLORS[s.staff_type] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {STAFF_TYPE_LABELS[s.staff_type] ?? s.staff_type}
          </span>
        )}
      </div>
    </div>
  );

  const renderLeaveChip = (l: StaffLeave) => {
    const c = LEAVE_COLORS[l.leave_type as LeaveType] ?? LEAVE_COLORS.sick_leave;
    const lbl = LEAVE_TYPES.find((x) => x.value === l.leave_type)?.label ?? l.leave_type;
    return (
      <div
        key={l.id}
        onClick={() => openEditLeave(l)}
        title={l.notes ? `${lbl}: ${l.notes}` : lbl}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border cursor-pointer hover:opacity-75 transition-opacity ${c.bg} ${c.border} mb-0.5`}
      >
        <span className={`text-[9px] font-semibold truncate ${c.text}`}>{lbl.split(" ")[0]}</span>
        {l.notes && <span className={`text-[8px] ${c.text} opacity-50`}>✎</span>}
        <Pencil size={7} className={`shrink-0 ${c.text} opacity-40 ml-auto`} />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Leave Calendar" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* ── Toolbar ── */}
        <div className="bg-white border border-border rounded-xl shadow-sm shrink-0 flex flex-wrap items-center px-4 gap-3 py-2.5 md:h-[62px] md:py-0">
          {/* Navigation */}
          <button onClick={prev} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-gray-800 min-w-[160px] text-center text-sm shrink-0">{headerLabel}</span>
          <button onClick={next} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
            <ChevronRight size={16} />
          </button>

          {/* View tabs: Today | Week | Month */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 shrink-0">
            <button
              onClick={() => { setView("today"); setAnchor(new Date()); }}
              className={`h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${view === "today" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Sun size={12} /> Today
            </button>
            <button
              onClick={() => setView("week")}
              className={`h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <CalendarDays size={13} /> Week
            </button>
            <button
              onClick={() => { setView("month"); setAnchor(d => new Date(d.getFullYear(), d.getMonth(), 1)); }}
              className={`h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutGrid size={13} /> Month
            </button>
          </div>

          <div className="flex-1" />

          {/* Right: Assign Leave + Search */}
          <Button size="sm" className="h-9 shrink-0" onClick={() => setAssignOpen(true)}>
            <Plus size={14} /> Assign Leave
          </Button>
          <div className="relative shrink-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 w-44"
            />
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex items-center gap-5 flex-wrap">
          {LEAVE_TYPES.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${LEAVE_COLORS[value].dot}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-auto">Click any leave entry to edit or add notes</span>
        </div>

        {/* ── TODAY VIEW ── */}
        {view === "today" && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="grid border-b border-border" style={{ gridTemplateColumns: "220px 1fr" }}>
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/60 border-r border-border">Staff</div>
              <div className={`px-4 py-3 text-center ${anchorYmd === todayYmd ? "bg-orange-50" : "bg-gray-50/60"}`}>
                <p className={`text-xs font-semibold ${anchorYmd === todayYmd ? "text-orange-600" : "text-gray-500"}`}>
                  {anchor.toLocaleDateString("en-GB",{weekday:"short"})}
                </p>
                <p className={`text-sm font-bold mt-0.5 ${anchorYmd === todayYmd ? "text-orange-600" : "text-gray-800"}`}>
                  {anchor.getDate()} {anchor.toLocaleDateString("en-GB",{month:"short"})}
                </p>
              </div>
            </div>
            {staffLoading ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : filteredStaff.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">No staff found.</div>
            ) : filteredStaff.map((s) => {
              const dayLeaves = (leavesByDate[anchorYmd] ?? []).filter(l => l.staff_id === s.id);
              return (
                <div key={s.id} className="grid border-b border-border last:border-0" style={{ gridTemplateColumns: "220px 1fr" }}>
                  {renderStaffCell(s)}
                  <div className={`px-2 py-1.5 min-h-[52px] ${anchorYmd === todayYmd ? "bg-orange-50/20" : ""}`}>
                    {dayLeaves.map(l => renderLeaveChip(l as StaffLeave))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── WEEK VIEW ── */}
        {view === "week" && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-8 border-b border-border">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/60 border-r border-border">Staff</div>
              {weekDays.map((d, i) => {
                const ymd = localYmd(d);
                const isToday = ymd === todayYmd;
                return (
                  <div key={ymd} className={`px-2 py-3 text-center border-r border-border last:border-0 ${isToday ? "bg-orange-50" : "bg-gray-50/60"}`}>
                    <p className={`text-xs font-semibold ${isToday ? "text-orange-600" : "text-gray-500"}`}>{DAYS[i]}</p>
                    <p className={`text-sm font-bold mt-0.5 ${isToday ? "text-orange-600" : "text-gray-800"}`}>{d.getDate()}</p>
                  </div>
                );
              })}
            </div>
            {staffLoading ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : filteredStaff.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">No staff found for this restaurant.</div>
            ) : filteredStaff.map((s) => (
              <div key={s.id} className="grid grid-cols-8 border-b border-border last:border-0">
                {renderStaffCell(s)}
                {weekDays.map((d) => {
                  const ymd = localYmd(d);
                  const dayLeaves = (leavesByDate[ymd] ?? []).filter((l) => l.staff_id === s.id);
                  const isToday = ymd === todayYmd;
                  return (
                    <div key={ymd} className={`px-1 py-1.5 border-r border-border last:border-0 min-h-[52px] ${isToday ? "bg-orange-50/30" : ""}`}>
                      {dayLeaves.map(l => renderLeaveChip(l as StaffLeave))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {view === "month" && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map((d) => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/60 border-r border-border last:border-0">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-border last:border-r-0 bg-gray-50/30" />;
                const ymd = localYmd(d);
                const isToday = ymd === todayYmd;
                const dayLeaves = leavesByDate[ymd] ?? [];
                const col = i % 7;
                return (
                  <div key={ymd} className={`min-h-[100px] border-r border-b border-border p-1.5 ${col === 6 ? "border-r-0" : ""} ${isToday ? "bg-orange-50/40" : ""}`}>
                    <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-orange-500 text-white" : "text-gray-600"}`}>
                      {d.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayLeaves.slice(0, 3).map((l) => {
                        const c = LEAVE_COLORS[l.leave_type as LeaveType] ?? LEAVE_COLORS.sick_leave;
                        return (
                          <div
                            key={l.id}
                            onClick={() => openEditLeave(l as StaffLeave)}
                            title={l.notes ? `${l.staff?.name}: ${l.notes}` : l.staff?.name ?? ""}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-75 ${c.bg} ${c.border}`}
                          >
                            {l.staff?.name && (
                              <span className={`text-[10px] font-semibold truncate ${c.text}`}>{l.staff.name.split(" ")[0]}</span>
                            )}
                            <span className={`text-[9px] ${c.text} opacity-70 ml-auto shrink-0`}>
                              {LEAVE_TYPES.find(x => x.value === l.leave_type)?.label.slice(0,3) ?? ""}
                            </span>
                            {l.notes && <Pencil size={7} className={`${c.text} opacity-40`} />}
                          </div>
                        );
                      })}
                      {dayLeaves.length > 3 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{dayLeaves.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ALLOCATION TABLE ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Monthly Leave Allocation</h3>
              <p className="text-xs text-gray-500 mt-0.5">Grouped by staff type · Click any leave entry to edit</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={tableMonth}
                onChange={(e) => setTableMonth(e.target.value)}
                className="h-9 px-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => printMonthlyAllocation(allocationRows, tableMonth, activeRestaurant?.name ?? "Restaurant")}
              >
                <Printer size={14} /> Print PDF
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wide">Sick</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wide">Personal</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-500 uppercase tracking-wide">Paid</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">No staff found for this restaurant.</td>
                  </tr>
                ) : allocationGroups.flatMap(({ typeKey, rows }) => {
                  const typeLabel = STAFF_TYPE_LABELS[typeKey ?? ""] ?? "Other";
                  const typeColor = STAFF_TYPE_COLORS[typeKey ?? ""] ?? "bg-gray-100 text-gray-600 border-gray-200";
                  const groupHeader = (
                    <tr key={`group-${typeKey}`} className="bg-gray-50/80">
                      <td colSpan={6} className="px-5 py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${typeColor}`}>
                          {typeLabel}
                        </span>
                      </td>
                    </tr>
                  );
                  const staffRows = rows.map((row) => (
                    <tr key={row.staff_id} className="border-b border-border">
                      <td className="px-5 py-3 align-top">
                        <div className="flex items-center gap-2.5 mb-2">
                          {row.photo_url ? (
                            <img src={row.photo_url} alt={row.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-orange-600">{row.name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{row.name}</p>
                            {row.job_role && <p className="text-xs text-gray-400">{row.job_role}</p>}
                          </div>
                        </div>
                        {/* Always-visible leave entries */}
                        <div className="flex flex-wrap gap-1.5 pl-9">
                          {row.entries.map((e) => {
                            const c = LEAVE_COLORS[e.leave_type as LeaveType] ?? LEAVE_COLORS.sick_leave;
                            const lbl = LEAVE_TYPES.find(x => x.value === e.leave_type)?.label ?? e.leave_type;
                            return (
                              <div
                                key={e.id}
                                onClick={() => openEditLeave(e as StaffLeave)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs cursor-pointer hover:opacity-75 transition-opacity ${c.bg} ${c.border}`}
                              >
                                <span className={`font-semibold ${c.text}`}>{e.leave_date}</span>
                                <span className={`${c.text} opacity-60`}>· {lbl.split(" ")[0]}</span>
                                {e.notes && <span className={`${c.text} opacity-50 italic`}>· {e.notes}</span>}
                                <Pencil size={9} className={`${c.text} opacity-40 ml-0.5`} />
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.sick > 0 ? "bg-red-50 text-red-600" : "text-gray-300"}`}>{row.sick}</span>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.personal > 0 ? "bg-blue-50 text-blue-600" : "text-gray-300"}`}>{row.personal}</span>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.paid > 0 ? "bg-green-50 text-green-600" : "text-gray-300"}`}>{row.paid}</span>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs font-bold text-gray-700">{row.total}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.notes.length > 0 ? (
                          <p className="text-xs text-gray-500 italic max-w-[200px]" title={row.notes.join(" · ")}>
                            {row.notes.join(" · ")}
                          </p>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ));

                  return [groupHeader, ...staffRows];
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Assign Leave Dialog ── */}
      <Dialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Assign Leave"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assigning || !assignForm.staff_id || !assignForm.leave_date}>
              {assigning ? "Assigning…" : "Assign Leave"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Staff Member *</label>
            <select
              value={assignForm.staff_id}
              onChange={(e) => setAssignForm((p) => ({ ...p, staff_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-md bg-white shadow-sm border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Select staff…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.job_role ? ` — ${s.job_role}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Leave Date *</label>
            <button
              type="button"
              onClick={() => setIsRange((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isRange ? <ToggleRight size={16} className="text-orange-500" /> : <ToggleLeft size={16} />}
              Date range
            </button>
          </div>

          {!isRange ? (
            <input
              type="date"
              value={assignForm.leave_date}
              onChange={(e) => setAssignForm((p) => ({ ...p, leave_date: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={assignForm.leave_date}
                  onChange={(e) => setAssignForm((p) => ({ ...p, leave_date: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={assignForm.leave_date_end}
                  min={assignForm.leave_date}
                  onChange={(e) => setAssignForm((p) => ({ ...p, leave_date_end: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {LEAVE_TYPES.map(({ value, label }) => {
                const c = LEAVE_COLORS[value];
                const active = assignForm.leave_type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAssignForm((p) => ({ ...p, leave_type: value }))}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                      active ? `${c.bg} ${c.border} ${c.text}` : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={assignForm.notes}
              onChange={(e) => setAssignForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Any notes about this leave…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
        </div>
      </Dialog>

      {/* ── Edit Leave Dialog ── */}
      <Dialog
        open={!!editLeave}
        onOpenChange={(open) => { if (!open) setEditLeave(null); }}
        title="Edit Leave Entry"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditDelete}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 size={13} /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditLeave(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        }
      >
        {editLeave && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-orange-600">
                  {(editLeave.staff?.name ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">{editLeave.staff?.name ?? "Staff"}</p>
                <p className="text-xs text-gray-400">{editLeave.leave_date}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Type</label>
              <div className="grid grid-cols-3 gap-2">
                {LEAVE_TYPES.map(({ value, label }) => {
                  const c = LEAVE_COLORS[value];
                  const active = editForm.leave_type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditForm(p => ({ ...p, leave_type: value }))}
                      className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                        active ? `${c.bg} ${c.border} ${c.text}` : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Add notes about this leave…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
