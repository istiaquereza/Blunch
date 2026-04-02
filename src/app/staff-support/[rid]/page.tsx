"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { CalendarDays, Loader2, Check, X, ChevronLeft, ChevronRight, HeartHandshake } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  job_role: string | null;
}

interface Leave {
  id: string;
  staff_id: string;
  leave_date: string;
  leave_type: "sick_leave" | "personal_leave" | "paid_leave";
  notes: string | null;
  staff?: { id: string; name: string };
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

const LEAVE_DOT_COLORS: Record<string, string> = {
  sick_leave: "bg-red-400",
  personal_leave: "bg-blue-400",
  paid_leave: "bg-green-400",
};

export default function StaffSupportPage({ params }: { params: Promise<{ rid: string }> }) {
  const { rid } = use(params);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [leaveType, setLeaveType] = useState<"sick_leave" | "personal_leave" | "paid_leave">("sick_leave");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");

  // Calendar
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/staff-support/${rid}`);
    if (!res.ok) { setError("Restaurant not found"); setLoading(false); return; }
    const data = await res.json();
    setRestaurant(data.restaurant);
    setStaffList(data.staff ?? []);
    setLoading(false);
  }, [rid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchLeaves = useCallback(async (staffId: string) => {
    if (!staffId) { setLeaves([]); return; }
    setLeavesLoading(true);
    const res = await fetch(`/api/staff-support/${rid}/leaves?staff_id=${staffId}`);
    if (res.ok) {
      const data = await res.json();
      setLeaves(data.leaves ?? []);
    }
    setLeavesLoading(false);
  }, [rid]);

  useEffect(() => { if (selectedStaffId) fetchLeaves(selectedStaffId); }, [selectedStaffId, fetchLeaves]);

  const handleSubmit = async () => {
    if (!selectedStaffId) { setError("Select a staff member"); return; }
    if (!leaveFrom) { setError("Select leave date"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff-support/${rid}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: selectedStaffId,
          leave_date: leaveFrom,
          leave_date_end: leaveTo || leaveFrom,
          leave_type: leaveType,
          notes: leaveNotes || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); }
      else {
        setSuccess("Leave request submitted!");
        setLeaveFrom("");
        setLeaveTo("");
        setLeaveNotes("");
        setTimeout(() => setSuccess(null), 3000);
        fetchLeaves(selectedStaffId);
      }
    } catch { setError("Network error"); }
    setSubmitting(false);
  };

  // Calendar helpers
  const calDays = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const leaveDatesInMonth = new Set(
    leaves
      .filter((l) => {
        const [y, m] = l.leave_date.split("-").map(Number);
        return y === calYear && m - 1 === calMonth;
      })
      .map((l) => l.leave_date)
  );

  const leaveTypeForDate = (dateStr: string) => {
    const leave = leaves.find((l) => l.leave_date === dateStr);
    return leave?.leave_type ?? null;
  };

  const monthName = new Date(calYear, calMonth, 1).toLocaleString("en-US", { month: "long" });

  // Monthly summary
  const thisMonthLeaves = leaves.filter((l) => {
    const [y, m] = l.leave_date.split("-").map(Number);
    return y === calYear && m - 1 === calMonth;
  });

  const leaveSummary = thisMonthLeaves.reduce<Record<string, number>>((acc, l) => {
    acc[l.leave_type] = (acc[l.leave_type] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  const { firstDay, daysInMonth } = calDays();
  const calCells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
            <HeartHandshake size={20} className="text-purple-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Staff Support</h1>
            <p className="text-xs text-gray-400">{restaurant?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {success && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-100 rounded-xl px-4 py-3 text-sm">
            <Check size={16} /> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-xl px-4 py-3 text-sm">
            <X size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Staff selector */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-xs font-medium text-gray-500 mb-2">Select Staff Member</label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStaffId(s.id)}
                className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  selectedStaffId === s.id
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200"
                }`}
              >
                <p className="truncate font-semibold">{s.name}</p>
                {s.job_role && <p className="text-[11px] text-gray-400 truncate">{s.job_role}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Leave request form */}
        {selectedStaffId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Submit Leave Request</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Leave type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Leave Type</label>
                <div className="flex gap-2 flex-wrap">
                  {(["sick_leave", "personal_leave", "paid_leave"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setLeaveType(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        leaveType === type ? LEAVE_TYPE_COLORS[type] : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">From *</label>
                  <input
                    type="date"
                    value={leaveFrom}
                    onChange={(e) => setLeaveFrom(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">To (optional)</label>
                  <input
                    type="date"
                    value={leaveTo}
                    min={leaveFrom}
                    onChange={(e) => setLeaveTo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
                <textarea
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                  placeholder="Reason for leave..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !leaveFrom}
                className="w-full py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : "Submit Leave Request"}
              </button>
            </div>
          </div>
        )}

        {/* Leave calendar */}
        {selectedStaffId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Leave Calendar</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-medium text-gray-700 w-24 text-center">{monthName} {calYear}</span>
                <button
                  onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {leavesLoading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                  ))}
                </div>
                {/* Cells */}
                <div className="grid grid-cols-7 gap-1">
                  {calCells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isLeave = leaveDatesInMonth.has(dateStr);
                    const leaveType = isLeave ? leaveTypeForDate(dateStr) : null;
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    return (
                      <div
                        key={day}
                        className={`relative aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          isLeave
                            ? leaveType === "sick_leave"
                              ? "bg-red-100 text-red-700"
                              : leaveType === "personal_leave"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                            : isToday
                            ? "bg-orange-50 text-orange-600 font-bold"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-50">
                  {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${LEAVE_DOT_COLORS[key]}`} />
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
        )}
      </div>
    </div>
  );
}
