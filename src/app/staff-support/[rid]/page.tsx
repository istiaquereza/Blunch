"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { Loader2, Check, X, ChevronLeft, ChevronRight, HeartHandshake, Plus, Trash2, ChevronDown } from "lucide-react";

interface StaffMember { id: string; name: string; job_role: string | null }

interface Leave {
  id: string;
  staff_id: string;
  leave_date: string;
  leave_type: "sick_leave" | "personal_leave" | "paid_leave";
  notes: string | null;
  staff?: { id: string; name: string } | null;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick_leave: "Sick Leave",
  personal_leave: "Personal Leave",
  paid_leave: "Paid Leave",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  sick_leave: "bg-red-100 text-red-700",
  personal_leave: "bg-blue-100 text-blue-700",
  paid_leave: "bg-green-100 text-green-700",
};

const LEAVE_BG: Record<string, string> = {
  sick_leave: "bg-red-400",
  personal_leave: "bg-blue-400",
  paid_leave: "bg-green-400",
};

const LEAVE_CELL_BG: Record<string, string> = {
  sick_leave: "bg-red-100 text-red-700",
  personal_leave: "bg-blue-100 text-blue-700",
  paid_leave: "bg-green-100 text-green-700",
};

export default function StaffSupportPage({ params }: { params: Promise<{ rid: string }> }) {
  const { rid } = use(params);

  const [restaurant, setRestaurant] = useState<{ id: string; name: string; logo_url?: string | null } | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Calendar
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Bottom sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStaffId, setSheetStaffId] = useState("");
  const [leaveType, setLeaveType] = useState<"sick_leave" | "personal_leave" | "paid_leave">("sick_leave");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const showToast = (text: string, ok = true) => {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/staff-support/${rid}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setRestaurant(data.restaurant);
    setStaffList(data.staff ?? []);
    setLoading(false);
  }, [rid]);

  const fetchLeaves = useCallback(async () => {
    setLeavesLoading(true);
    // Fetch all staff leaves — no staff_id filter
    const res = await fetch(`/api/staff-support/${rid}/leaves`);
    if (res.ok) { const d = await res.json(); setLeaves(d.leaves ?? []); }
    setLeavesLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (!loading) fetchLeaves(); }, [loading, fetchLeaves]);

  const openSheet = (preDate?: string) => {
    setSheetStaffId(staffList[0]?.id ?? "");
    setLeaveFrom(preDate ?? "");
    setLeaveTo("");
    setLeaveNotes("");
    setLeaveType("sick_leave");
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!sheetStaffId) { showToast("Select a staff member", false); return; }
    if (!leaveFrom) { showToast("Select leave date", false); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff-support/${rid}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: sheetStaffId,
          leave_date: leaveFrom,
          leave_date_end: leaveTo || leaveFrom,
          leave_type: leaveType,
          notes: leaveNotes || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Failed to submit", false); }
      else {
        showToast("Leave assigned!");
        setSheetOpen(false);
        fetchLeaves();
      }
    } catch { showToast("Network error", false); }
    setSubmitting(false);
  };

  const handleDelete = async (leaveId: string) => {
    setDeleting(leaveId);
    try {
      const res = await fetch(`/api/staff-support/${rid}/leaves?leave_id=${leaveId}`, { method: "DELETE" });
      if (res.ok) { showToast("Leave removed"); fetchLeaves(); }
      else showToast("Failed to delete", false);
    } catch { showToast("Network error", false); }
    setDeleting(null);
  };

  // Calendar helpers
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthName = new Date(calYear, calMonth, 1).toLocaleString("en-US", { month: "long" });

  // Group leaves by date
  const leavesByDate = new Map<string, Leave[]>();
  for (const l of leaves) {
    const [y, m] = l.leave_date.split("-").map(Number);
    if (y === calYear && m - 1 === calMonth) {
      const existing = leavesByDate.get(l.leave_date) ?? [];
      leavesByDate.set(l.leave_date, [...existing, l]);
    }
  }

  // Monthly summary
  const leavesForMonth = [...leavesByDate.values()].flat();
  const leaveSummary = leavesForMonth.reduce<Record<string, number>>((acc, l) => {
    acc[l.leave_type] = (acc[l.leave_type] ?? 0) + 1;
    return acc;
  }, {});

  const selectedLeaves = selectedDate ? (leavesByDate.get(selectedDate) ?? []) : [];

  const staffById = new Map(staffList.map(s => [s.id, s]));

  const prevMonth = () => {
    setCalMonth(m => { if (m === 0) { setCalYear(y => y - 1); return 11; } return m - 1; });
    setSelectedDate(null);
  };
  const nextMonth = () => {
    setCalMonth(m => { if (m === 11) { setCalYear(y => y + 1); return 0; } return m + 1; });
    setSelectedDate(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <Loader2 className="animate-spin text-orange-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-28" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant?.name} className="w-9 h-9 rounded-xl object-cover shrink-0 border border-gray-100" />
          ) : (
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
              <HeartHandshake size={20} className="text-purple-500" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-gray-900">Staff Support</h1>
            <p className="text-xs text-gray-400">{restaurant?.name}</p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap ${toastMsg.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toastMsg.ok ? <Check size={14} /> : <X size={14} />}
          {toastMsg.text}
        </div>
      )}

      <div className="max-w-xl mx-auto p-4">

        {/* Calendar card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Calendar header */}
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Leave Calendar</h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold text-gray-700 w-28 text-center">{monthName} {calYear}</span>
              <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {leavesLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calCells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayLeaves = leavesByDate.get(dateStr) ?? [];
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                  const isSelected = selectedDate === dateStr;
                  const hasLeave = dayLeaves.length > 0;
                  const singleLeave = dayLeaves.length === 1 ? dayLeaves[0] : null;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all gap-0.5
                        ${singleLeave
                          ? `${LEAVE_CELL_BG[singleLeave.leave_type]} ${isSelected ? "ring-2 ring-offset-1 ring-gray-700" : "hover:opacity-80"}`
                          : hasLeave
                          ? `bg-gray-50 ${isSelected ? "ring-2 ring-offset-1 ring-gray-700" : "hover:bg-gray-100"} text-gray-700`
                          : isToday
                          ? "bg-orange-500 text-white"
                          : isSelected
                          ? "bg-gray-800 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      <span>{day}</span>
                      {/* Dots for multiple leaves */}
                      {dayLeaves.length > 1 && (
                        <div className="flex gap-0.5">
                          {dayLeaves.slice(0, 3).map((l, di) => (
                            <span key={di} className={`w-1 h-1 rounded-full ${LEAVE_BG[l.leave_type]}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected date detail */}
              {selectedDate && (
                <div className="mt-4 rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>

                  {selectedLeaves.length === 0 ? (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <p className="text-xs text-gray-400">No leave on this day</p>
                      <button onClick={() => openSheet(selectedDate)} className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                        + Assign
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {selectedLeaves.map((leave) => {
                        const staffName = leave.staff?.name ?? staffById.get(leave.staff_id)?.name ?? "Staff";
                        return (
                          <div key={leave.id} className="px-4 py-3 flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${LEAVE_BG[leave.leave_type]}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{staffName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLORS[leave.leave_type]}`}>
                                  {LEAVE_TYPE_LABELS[leave.leave_type]}
                                </span>
                                {leave.notes && <p className="text-[11px] text-gray-400 truncate">{leave.notes}</p>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(leave.id)}
                              disabled={deleting === leave.id}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                            >
                              {deleting === leave.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-50">
                {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${LEAVE_BG[key]}`} />
                    <span className="text-[11px] text-gray-500">{label}</span>
                  </div>
                ))}
              </div>

              {/* Monthly summary */}
              {Object.keys(leaveSummary).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">This Month</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(leaveSummary).map(([type, count]) => (
                      <span key={type} className={`text-xs font-medium px-2.5 py-1 rounded-lg ${LEAVE_TYPE_COLORS[type]}`}>
                        {LEAVE_TYPE_LABELS[type]}: {count} day{count !== 1 ? "s" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Leave sticky button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA]/90 to-transparent">
        <div className="max-w-xl mx-auto">
          <button
            onClick={() => openSheet(selectedDate ?? undefined)}
            className="w-full py-3.5 bg-[#111827] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg"
          >
            <Plus size={16} /> Assign Leave
          </button>
        </div>
      </div>

      {/* Bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50" style={{ fontFamily: "Inter, sans-serif" }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[92vh] flex flex-col">

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <p className="text-base font-bold text-gray-900">Assign Leave</p>
              <button onClick={() => setSheetOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Sheet body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

              {/* Staff dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Staff Member *</label>
                <div className="relative">
                  <select
                    value={sheetStaffId}
                    onChange={(e) => setSheetStaffId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 appearance-none bg-white pr-9"
                  >
                    <option value="">Select staff member…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.job_role ? ` — ${s.job_role}` : ""}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Leave type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Leave Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["sick_leave", "personal_leave", "paid_leave"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setLeaveType(type)}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-colors border ${
                        leaveType === type
                          ? `${LEAVE_TYPE_COLORS[type]} border-transparent`
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                      }`}
                    >
                      {LEAVE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">From *</label>
                  <input
                    type="date"
                    value={leaveFrom}
                    onChange={(e) => setLeaveFrom(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">To</label>
                  <input
                    type="date"
                    value={leaveTo}
                    min={leaveFrom}
                    onChange={(e) => setLeaveTo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes</label>
                <textarea
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                  placeholder="Reason for leave..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 resize-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !leaveFrom || !sheetStaffId}
                className="w-full py-3.5 bg-[#111827] text-white text-sm font-bold rounded-2xl hover:bg-gray-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Assigning…</> : "Assign Leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
