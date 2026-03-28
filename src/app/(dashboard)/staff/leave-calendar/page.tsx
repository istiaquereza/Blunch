"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useStaff, useStaffLeaves } from "@/hooks/use-staff";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  CalendarDays, LayoutGrid, ToggleLeft, ToggleRight,
} from "lucide-react";

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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LeaveCalendarPage() {
  const { activeRestaurant } = useRestaurant();
  const rid = activeRestaurant?.id;

  const { staff, loading: staffLoading } = useStaff(rid);
  const { leaves, assignLeave, assignLeaveRange, deleteLeave } = useStaffLeaves(rid);

  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());

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

  // ── Allocation month filter ──
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

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const prev = () => {
    if (view === "week") setAnchor(addDays(anchor, -7));
    else { const d = new Date(anchor); d.setMonth(d.getMonth()-1); setAnchor(d); }
  };
  const next = () => {
    if (view === "week") setAnchor(addDays(anchor, 7));
    else { const d = new Date(anchor); d.setMonth(d.getMonth()+1); setAnchor(d); }
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

  // ─── Monthly allocation ───────────────────────────────────────────────────
  const allocationRows = useMemo(() => {
    const [y, m] = tableMonth.split("-");
    const prefix = `${y}-${m}-`;
    const monthLeaves = leaves.filter((l) => l.leave_date.startsWith(prefix));
    const byStaff: Record<string, { sick: number; personal: number; paid: number }> = {};
    monthLeaves.forEach((l) => {
      if (!byStaff[l.staff_id]) byStaff[l.staff_id] = { sick: 0, personal: 0, paid: 0 };
      if (l.leave_type === "sick_leave")     byStaff[l.staff_id].sick++;
      if (l.leave_type === "personal_leave") byStaff[l.staff_id].personal++;
      if (l.leave_type === "paid_leave")     byStaff[l.staff_id].paid++;
    });
    return Object.entries(byStaff).map(([staff_id, counts]) => {
      const s = staff.find((x) => x.id === staff_id);
      return { staff_id, name: s?.name ?? "Unknown", job_role: s?.job_role ?? "", photo_url: s?.photo_url ?? null, ...counts, total: counts.sick + counts.personal + counts.paid };
    }).sort((a, b) => b.total - a.total);
  }, [leaves, tableMonth, staff]);

  // ─── Assign handler ────────────────────────────────────────────────────────
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

  const headerLabel = view === "week"
    ? `${weekDays[0].toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – ${weekDays[6].toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}`
    : `${MONTHS[monthIdx]} ${monthYear}`;

  const today = localYmd(new Date());

  return (
    <div className="flex flex-col h-full">
      <Header title="Leave Calendar" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Toolbar ── */}
        <div className="bg-white border border-border rounded-xl shadow-sm shrink-0 h-[62px] flex items-center px-[14px] gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <button onClick={prev} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-gray-800 min-w-[180px] text-center text-sm">{headerLabel}</span>
            <button onClick={next} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setAnchor(new Date())} className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Today
            </button>
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView("week")}
                className={`h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <CalendarDays size={13} /> Week
              </button>
              <button
                onClick={() => setView("month")}
                className={`h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <LayoutGrid size={13} /> Month
              </button>
            </div>
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <Plus size={14} /> Assign Leave
            </Button>
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
        </div>

        {/* ── WEEK VIEW ── */}
        {view === "week" && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-8 border-b border-border">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/60 border-r border-border">Staff</div>
              {weekDays.map((d, i) => {
                const ymd = localYmd(d);
                const isToday = ymd === today;
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
            ) : staff.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">No staff found for this restaurant.</div>
            ) : staff.map((s) => (
              <div key={s.id} className="grid grid-cols-8 border-b border-border last:border-0">
                <div className="px-3 py-2.5 flex items-center gap-2.5 border-r border-border min-w-0">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-orange-600">{s.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                </div>
                {weekDays.map((d) => {
                  const ymd = localYmd(d);
                  const dayLeaves = (leavesByDate[ymd] ?? []).filter((l) => l.staff_id === s.id);
                  const isToday = ymd === today;
                  return (
                    <div key={ymd} className={`px-1 py-1.5 border-r border-border last:border-0 min-h-[52px] ${isToday ? "bg-orange-50/30" : ""}`}>
                      {dayLeaves.map((l) => {
                        const c = LEAVE_COLORS[l.leave_type as LeaveType] ?? LEAVE_COLORS.sick_leave;
                        const lbl = LEAVE_TYPES.find((x) => x.value === l.leave_type)?.label ?? l.leave_type;
                        return (
                          <div key={l.id} className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md border ${c.bg} ${c.border} mb-0.5`}>
                            <span className={`text-[9px] font-semibold truncate ${c.text}`}>{lbl.split(" ")[0]}</span>
                            <button
                              onClick={async () => {
                                if (!confirm("Remove this leave?")) return;
                                const { error } = await deleteLeave(l.id);
                                if (error) toast.error("Failed"); else toast.success("Removed");
                              }}
                              className={`w-3.5 h-3.5 flex items-center justify-center shrink-0 ${c.text} opacity-60 hover:opacity-100`}
                            >
                              <Trash2 size={8} />
                            </button>
                          </div>
                        );
                      })}
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
                const isToday = ymd === today;
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
                          <div key={l.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${c.bg} ${c.border}`}>
                            {l.staff?.name && (
                              <span className={`text-[10px] font-semibold truncate ${c.text}`}>{l.staff.name.split(" ")[0]}</span>
                            )}
                            <span className={`text-[9px] ${c.text} opacity-70 ml-auto shrink-0`}>
                              {LEAVE_TYPES.find(x => x.value === l.leave_type)?.label.slice(0,3) ?? ""}
                            </span>
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

        {/* ── ALLOCATION TABLE (always below calendar) ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Monthly Leave Allocation</h3>
              <p className="text-xs text-gray-500 mt-0.5">Days taken per staff member this month</p>
            </div>
            <input
              type="month"
              value={tableMonth}
              onChange={(e) => setTableMonth(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
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
                </tr>
              </thead>
              <tbody>
                {allocationRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">No leaves recorded for this month.</td>
                  </tr>
                ) : allocationRows.map((row) => (
                  <tr key={row.staff_id} className="border-b border-border last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
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
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.sick > 0 ? "bg-red-50 text-red-600" : "text-gray-300"}`}>{row.sick}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.personal > 0 ? "bg-blue-50 text-blue-600" : "text-gray-300"}`}>{row.personal}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.paid > 0 ? "bg-green-50 text-green-600" : "text-gray-300"}`}>{row.paid}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs font-bold text-gray-700">{row.total}</span>
                    </td>
                  </tr>
                ))}
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
          {/* Staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Staff Member *</label>
            <select
              value={assignForm.staff_id}
              onChange={(e) => setAssignForm((p) => ({ ...p, staff_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select staff…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.job_role ? ` — ${s.job_role}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Date range toggle */}
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

          {/* Leave type */}
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

          {/* Notes */}
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
    </div>
  );
}
