"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useAllStaff } from "@/hooks/use-staff";
import { createClient } from "@/lib/supabase/client";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  Search,
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function getCurrentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface PayrollRow {
  staffId: string;
  name: string;
  jobRole: string | null;
  restaurantName: string | null;
  monthlySalary: number;
  paid: number;
  due: number;
  status: "fully_paid" | "partial" | "unpaid";
}

interface PaymentRecord {
  id: string;
  amount: number;
  transaction_date: string;
  description?: string;
  payment_methods?: { name: string } | null;
}

// ── Pay Dialog ─────────────────────────────────────────────────────────────────
function PayDialog({
  row,
  month,
  paymentMethods,
  restaurantId,
  onSave,
  onClose,
}: {
  row: PayrollRow;
  month: string;
  paymentMethods: { id: string; name: string }[];
  restaurantId: string;
  onSave: (payload: object) => Promise<{ error: unknown }>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(row.due));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Valid amount required"); return; }
    if (amt > row.due) { setError(`Cannot exceed due amount (${fmt(row.due)})`); return; }
    setSaving(true);
    const { error: err } = await onSave({
      restaurant_id: restaurantId,
      type: "expense",
      description: `Salary — ${row.name} (${month})`,
      amount: amt,
      payment_method_id: paymentMethodId || undefined,
      status: "paid",
      transaction_date: date,
      staff_id: row.staffId,
      payroll_month: `${month}-01`,
    });
    setSaving(false);
    if (err) { setError(String(err)); return; }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Staff</span>
          <span className="font-medium text-gray-800">{row.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Month</span>
          <span className="font-medium text-gray-800">{getMonthLabel(month)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Monthly Salary</span>
          <span className="font-semibold text-gray-800">{fmt(row.monthlySalary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Already Paid</span>
          <span className="font-semibold text-green-600">{fmt(row.paid)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
          <span className="text-gray-600 font-semibold">Due</span>
          <span className="font-bold text-amber-600">{fmt(row.due)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Amount (৳) *</label>
          <input
            type="number"
            min="0"
            max={row.due}
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <Input
          label="Date *"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Payment Method</label>
        <select
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Not specified</option>
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>{pm.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Pay Salary</Button>
      </div>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StaffPayrollPage() {
  const { restaurants, activeRestaurant } = useRestaurant();
  const restaurantIds = useMemo(() => restaurants.map(r => r.id), [restaurants]);
  const { staff, loading: staffLoading } = useAllStaff(restaurantIds);
  const { methods: paymentMethods } = usePaymentMethods(activeRestaurant?.id);

  const [month, setMonth] = useState(getCurrentYM());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partial" | "unpaid">("all");
  const [payrollData, setPayrollData] = useState<Map<string, number>>(new Map());
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [payTarget, setPayTarget] = useState<PayrollRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PayrollRow | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PaymentRecord[]>([]);

  // Fetch payroll payments for the selected month
  const fetchPayroll = useCallback(async () => {
    if (!restaurantIds.length || !month) return;
    setLoadingPayroll(true);
    const supabase = createClient();
    const monthStart = `${month}-01`;
    const [yr, mo] = month.split("-").map(Number);
    const lastDay = new Date(yr, mo, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const { data } = await supabase
      .from("transactions")
      .select("staff_id, amount, status")
      .in("restaurant_id", restaurantIds)
      .eq("type", "expense")
      .eq("status", "paid")
      .not("staff_id", "is", null)
      .gte("payroll_month", monthStart)
      .lte("payroll_month", monthEnd);

    const map = new Map<string, number>();
    (data ?? []).forEach((r: any) => {
      if (r.staff_id) {
        map.set(r.staff_id, (map.get(r.staff_id) ?? 0) + r.amount);
      }
    });
    setPayrollData(map);
    setLoadingPayroll(false);
  }, [restaurantIds, month]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  // Fetch history records for a specific staff member
  const fetchHistory = useCallback(async (staffId: string) => {
    const supabase = createClient();
    const monthStart = `${month}-01`;
    const [yr, mo] = month.split("-").map(Number);
    const lastDay = new Date(yr, mo, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const { data } = await supabase
      .from("transactions")
      .select("id, amount, transaction_date, description, payment_methods!transactions_payment_method_id_fkey(name)")
      .eq("staff_id", staffId)
      .eq("type", "expense")
      .eq("status", "paid")
      .gte("payroll_month", monthStart)
      .lte("payroll_month", monthEnd)
      .order("transaction_date", { ascending: false });

    setHistoryRecords((data ?? []) as unknown as PaymentRecord[]);
  }, [month]);

  // Build payroll rows
  const rows = useMemo<PayrollRow[]>(() => {
    return staff.map(s => {
      const paid = payrollData.get(s.id) ?? 0;
      const due = Math.max(0, s.salary - paid);
      const status: PayrollRow["status"] =
        s.salary === 0 ? "fully_paid"
        : paid >= s.salary ? "fully_paid"
        : paid > 0 ? "partial"
        : "unpaid";
      return {
        staffId: s.id,
        name: s.name,
        jobRole: s.job_role,
        restaurantName: s.restaurants?.name ?? null,
        monthlySalary: s.salary,
        paid,
        due,
        status,
      };
    });
  }, [staff, payrollData]);

  const filtered = useMemo(() => {
    let list = rows;
    if (search) list = list.filter(r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.jobRole?.toLowerCase().includes(search.toLowerCase()) ||
      r.restaurantName?.toLowerCase().includes(search.toLowerCase())
    );
    if (statusFilter !== "all") list = list.filter(r => {
      if (statusFilter === "paid") return r.status === "fully_paid";
      if (statusFilter === "partial") return r.status === "partial";
      if (statusFilter === "unpaid") return r.status === "unpaid";
      return true;
    });
    return list;
  }, [rows, search, statusFilter]);

  // Summary stats
  const totalSalary = rows.reduce((s, r) => s + r.monthlySalary, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const fullyPaid = rows.filter(r => r.status === "fully_paid").length;

  // Month navigation
  const prevMonth = () => {
    const [yr, mo] = month.split("-").map(Number);
    const d = new Date(yr, mo - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [yr, mo] = month.split("-").map(Number);
    const d = new Date(yr, mo, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const isCurrentMonth = month === getCurrentYM();

  // Save payroll payment
  const handlePaySave = async (payload: object) => {
    const supabase = createClient();
    const { error } = await supabase.from("transactions").insert(payload);
    if (!error) fetchPayroll();
    return { error };
  };

  return (
    <>
      <Header title="Staff Payroll" />

      <div className="p-4 md:p-6 space-y-4">

        {/* ── Month Selector ── */}
        <div className="bg-white border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-700">{getMonthLabel(month)}</span>
            {/* Status filter */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden h-9">
              {([["all", "All"], ["unpaid", "Unpaid"], ["partial", "Partial"], ["paid", "Paid"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={`px-3 text-xs font-medium transition-colors ${
                    statusFilter === v
                      ? v === "paid" ? "bg-green-500 text-white"
                        : v === "partial" ? "bg-amber-500 text-white"
                        : v === "unpaid" ? "bg-red-500 text-white"
                        : "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="w-56 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users size={16} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Staff</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{rows.length}</p>
            <p className="text-xs text-gray-400 mt-1">{fullyPaid} fully paid</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <DollarSign size={16} className="text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Payroll</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{fmt(totalSalary)}</p>
            <p className="text-xs text-gray-400 mt-1">{getMonthLabel(month)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{fmt(totalPaid)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {totalSalary > 0 ? ((totalPaid / totalSalary) * 100).toFixed(0) : 0}% of total
            </p>
          </div>
          <div className={`rounded-xl border p-4 ${totalDue > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalDue > 0 ? "bg-amber-100" : "bg-gray-50"}`}>
                <Clock size={16} className={totalDue > 0 ? "text-amber-600" : "text-gray-400"} />
              </div>
              <span className={`text-xs font-medium ${totalDue > 0 ? "text-amber-700" : "text-gray-500"}`}>Due</span>
            </div>
            <p className={`text-2xl font-bold ${totalDue > 0 ? "text-amber-700" : "text-gray-400"}`}>{fmt(totalDue)}</p>
            <p className={`text-xs mt-1 ${totalDue > 0 ? "text-amber-600" : "text-gray-400"}`}>
              {rows.filter(r => r.status !== "fully_paid").length} staff pending
            </p>
          </div>
        </div>

        {/* ── Payroll Table ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden overflow-x-auto">
          {staffLoading || loadingPayroll ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 size={16} className="animate-spin" /> Loading payroll data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No staff found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting the search or filter.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">Restaurant</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Due</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row) => (
                  <tr key={row.staffId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{row.name}</p>
                        <p className="text-xs text-gray-400 sm:hidden">{row.jobRole ?? "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {row.jobRole ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                      {row.restaurantName ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      {fmt(row.monthlySalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                      {row.paid > 0 ? fmt(row.paid) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {row.due > 0 ? (
                        <span className="text-amber-600">{fmt(row.due)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.status === "fully_paid" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> Paid
                        </span>
                      ) : row.status === "partial" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock size={10} /> Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <Clock size={10} /> Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.paid > 0 && (
                          <button
                            onClick={async () => {
                              setHistoryTarget(row);
                              await fetchHistory(row.staffId);
                            }}
                            className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            History
                          </button>
                        )}
                        {row.status !== "fully_paid" && row.monthlySalary > 0 && (
                          <button
                            onClick={() => setPayTarget(row)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                          >
                            <Plus size={11} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">
                    {filtered.length} staff members
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-500 md:hidden">
                    {filtered.length} staff members
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-gray-700">{fmt(filtered.reduce((s, r) => s + r.monthlySalary, 0))}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-green-600">{fmt(filtered.reduce((s, r) => s + r.paid, 0))}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-amber-600">{fmt(filtered.reduce((s, r) => s + r.due, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Pay Dialog ── */}
      {payTarget && activeRestaurant && (
        <Dialog
          open={!!payTarget}
          onOpenChange={(o) => !o && setPayTarget(null)}
          title={`Pay Salary — ${payTarget.name}`}
          maxWidth="max-w-md"
        >
          <PayDialog
            row={payTarget}
            month={month}
            paymentMethods={paymentMethods}
            restaurantId={activeRestaurant.id}
            onSave={handlePaySave}
            onClose={() => setPayTarget(null)}
          />
        </Dialog>
      )}

      {/* ── Payment History Dialog ── */}
      {historyTarget && (
        <Dialog
          open={!!historyTarget}
          onOpenChange={(o) => !o && setHistoryTarget(null)}
          title={`Payment History — ${historyTarget.name}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{getMonthLabel(month)}</p>
            {historyRecords.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No payments recorded</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {historyRecords.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-700">
                        {new Date(r.transaction_date + "T12:00:00").toLocaleDateString("en-GB", {
                          day: "numeric", month: "short",
                        })}
                      </p>
                      {r.payment_methods?.name && (
                        <p className="text-xs text-gray-400">{r.payment_methods.name}</p>
                      )}
                    </div>
                    <span className="font-semibold text-green-600">{fmt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-sm">
              <span className="font-semibold text-gray-600">Total Paid</span>
              <span className="font-bold text-green-600">{fmt(historyRecords.reduce((s, r) => s + r.amount, 0))}</span>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setHistoryTarget(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
