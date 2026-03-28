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
  Gift,
  Printer,
  ChefHat,
  Utensils,
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

const BONUS_TYPES = ["Daily Sells Bonus", "Health Support", "Service Charge"];

interface PayrollRow {
  staffId: string;
  name: string;
  jobRole: string | null;
  staffType: "kitchen" | "hall" | null;
  restaurantName: string | null;
  restaurantId: string;
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
  isBonus?: boolean;
  bonusType?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function isSalaryTx(description?: string) {
  return !description || description.startsWith("Salary —") || description.startsWith("Salary -") || description.startsWith("Advance Salary —");
}

function getBonusLabel(description?: string) {
  if (!description) return "Bonus";
  for (const t of BONUS_TYPES) {
    if (description.startsWith(t)) return t;
  }
  return description.split("—")[0].trim();
}

// ── Get or create expense category ─────────────────────────────────────────────
async function getOrCreateBonusCategory(supabase: ReturnType<typeof createClient>, name: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .eq("type", "expense")
      .limit(1)
      .single();
    if (existing) return existing.id;
    const { data: created } = await supabase
      .from("expense_categories")
      .insert({ name, type: "expense", user_id: user.id })
      .select("id")
      .single();
    return created?.id ?? null;
  } catch {
    return null;
  }
}

// ── Print Salary Statement ─────────────────────────────────────────────────────
function printSalaryStatement(row: PayrollRow, records: PaymentRecord[], month: string, restaurantName: string) {
  const salaryRecords = records.filter((r) => isSalaryTx(r.description));
  const bonusRecords = records.filter((r) => !isSalaryTx(r.description));
  const totalSalaryPaid = salaryRecords.reduce((s, r) => s + r.amount, 0);
  const totalBonus = bonusRecords.reduce((s, r) => s + r.amount, 0);
  const totalPaid = totalSalaryPaid + totalBonus;

  const rowHtml = (r: PaymentRecord) => `
    <tr>
      <td>${new Date(r.transaction_date + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
      <td>${isSalaryTx(r.description) ? "Salary" : getBonusLabel(r.description)}</td>
      <td>${r.payment_methods?.name ?? "—"}</td>
      <td class="amount">${fmt(r.amount)}</td>
    </tr>
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Salary Statement — ${row.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #111; padding-bottom: 16px; }
    .logo { font-size: 20px; font-weight: 700; }
    .title { font-size: 11px; color: #555; margin-top: 2px; }
    .statement-info { text-align: right; font-size: 12px; color: #444; }
    .staff-block { background: #f5f5f5; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 32px; }
    .staff-block .label { font-size: 10px; color: #888; margin-bottom: 2px; }
    .staff-block .value { font-size: 13px; font-weight: 600; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #111; color: #fff; }
    thead th { padding: 7px 10px; text-align: left; font-size: 11px; font-weight: 600; }
    thead th.amount { text-align: right; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody tr:nth-child(even) { background: #fafafa; }
    td { padding: 7px 10px; font-size: 12px; }
    td.amount { text-align: right; font-weight: 600; }
    .summary { border-top: 2px solid #111; padding-top: 12px; display: flex; justify-content: flex-end; }
    .summary-table { width: 280px; }
    .summary-table tr td { padding: 4px 8px; font-size: 12px; }
    .summary-table tr td:last-child { text-align: right; font-weight: 600; }
    .summary-table .total-row td { font-size: 14px; font-weight: 700; border-top: 1px solid #ddd; padding-top: 6px; margin-top: 4px; }
    .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">${restaurantName}</div>
      <div class="title">Salary Statement</div>
    </div>
    <div class="statement-info">
      <div><strong>${getMonthLabel(month)}</strong></div>
      <div>Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
    </div>
  </div>

  <div class="staff-block">
    <div>
      <div class="label">Staff Name</div>
      <div class="value">${row.name}</div>
    </div>
    <div>
      <div class="label">Role</div>
      <div class="value">${row.jobRole ?? "—"}</div>
    </div>
    <div>
      <div class="label">Type</div>
      <div class="value">${row.staffType ? (row.staffType.charAt(0).toUpperCase() + row.staffType.slice(1)) : "—"}</div>
    </div>
    <div>
      <div class="label">Monthly Salary</div>
      <div class="value">${fmt(row.monthlySalary)}</div>
    </div>
  </div>

  <h2>Payment Details</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Method</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${records.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:16px;">No payments recorded</td></tr>` : records.map(rowHtml).join("")}
    </tbody>
  </table>

  <div class="summary">
    <table class="summary-table">
      <tr><td>Monthly Salary</td><td>${fmt(row.monthlySalary)}</td></tr>
      <tr><td>Salary Paid</td><td>${fmt(totalSalaryPaid)}</td></tr>
      ${bonusRecords.length > 0 ? `<tr><td>Benefits & Bonuses</td><td>${fmt(totalBonus)}</td></tr>` : ""}
      <tr class="total-row"><td>Total Paid</td><td>${fmt(totalPaid)}</td></tr>
      ${row.due > 0 ? `<tr><td style="color:#b45309;">Salary Due</td><td style="color:#b45309;">${fmt(row.due)}</td></tr>` : ""}
    </table>
  </div>

  <div class="footer">This is a computer-generated document. No signature required.</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
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
  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();

  const [date, setDate] = useState(todayStr);
  const [salaryMonth, setSalaryMonth] = useState(month); // which month's salary this pays for
  const [amount, setAmount] = useState(String(row.due));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [monthPaid, setMonthPaid] = useState<number | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const isAdvance = salaryMonth > month;
  const isDifferentMonth = salaryMonth !== month;

  // Fetch existing salary payments when salary month changes
  useEffect(() => {
    if (!isDifferentMonth) {
      setMonthPaid(null);
      setAmount(String(row.due));
      return;
    }
    setLoadingMonth(true);
    const supabase = createClient();
    const monthStart = `${salaryMonth}-01`;
    const [yr, mo] = salaryMonth.split("-").map(Number);
    const lastDay = new Date(yr, mo, 0).getDate();
    const monthEnd = `${salaryMonth}-${String(lastDay).padStart(2, "0")}`;
    supabase
      .from("transactions")
      .select("amount, description")
      .eq("staff_id", row.staffId)
      .eq("type", "expense")
      .eq("status", "paid")
      .gte("payroll_month", monthStart)
      .lte("payroll_month", monthEnd)
      .then(({ data }) => {
        const paid = (data ?? []).filter((r: any) => isSalaryTx(r.description)).reduce((s: number, r: any) => s + r.amount, 0);
        setMonthPaid(paid);
        setAmount(String(Math.max(0, row.monthlySalary - paid)));
        setLoadingMonth(false);
      });
  }, [salaryMonth, isDifferentMonth, row.staffId, row.monthlySalary, row.due]);

  const effectivePaid = isDifferentMonth ? (monthPaid ?? 0) : row.paid;
  const effectiveDue = Math.max(0, row.monthlySalary - effectivePaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Valid amount required"); return; }
    if (amt > row.monthlySalary) { setError(`Cannot exceed monthly salary (${fmt(row.monthlySalary)})`); return; }
    if (!paymentMethodId) { setError("Payment method is required"); return; }
    setSaving(true);
    const baseLabel = isAdvance
      ? `Advance Salary — ${row.name} (${getMonthLabel(salaryMonth)})`
      : `Salary — ${row.name} (${getMonthLabel(salaryMonth)})`;
    const label = note.trim() ? `${baseLabel} — ${note.trim()}` : baseLabel;
    const { error: err } = await onSave({
      restaurant_id: restaurantId,
      type: "expense",
      description: label,
      amount: amt,
      payment_method_id: paymentMethodId,
      status: "paid",
      transaction_date: date,
      staff_id: row.staffId,
      payroll_month: `${salaryMonth}-01`,
    });
    setSaving(false);
    if (err) { setError(String(err)); return; }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Payment date + Salary month side by side */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Payment Date *"
          type="date"
          value={date}
          max={todayStr}
          onChange={(e) => { setDate(e.target.value); setError(""); }}
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Salary Month *</label>
          <input
            type="month"
            value={salaryMonth}
            onChange={(e) => { if (e.target.value) { setSalaryMonth(e.target.value); setError(""); } }}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Advance badge */}
      {isAdvance && (
        <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
          🗓 Advance salary for <strong>{getMonthLabel(salaryMonth)}</strong> — expense recorded on payment date
        </div>
      )}

      {/* Summary card */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Staff</span>
          <span className="font-medium text-gray-800">{row.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Salary Month</span>
          <span className="font-medium text-gray-800">{getMonthLabel(salaryMonth)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Monthly Salary</span>
          <span className="font-semibold text-gray-800">{fmt(row.monthlySalary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Already Paid</span>
          <span className="font-semibold text-green-600">
            {loadingMonth ? <span className="text-gray-300">…</span> : fmt(effectivePaid)}
          </span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
          <span className="text-gray-600 font-semibold">Due</span>
          <span className="font-bold text-amber-600">
            {loadingMonth ? <span className="text-gray-300">…</span> : fmt(effectiveDue)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Amount (৳) *</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(""); }}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Payment Method *</label>
        <select
          value={paymentMethodId}
          onChange={(e) => { setPaymentMethodId(e.target.value); setError(""); }}
          className={`w-full h-9 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${!paymentMethodId ? "border-orange-300" : "border-gray-200"}`}
        >
          <option value="">Select payment method…</option>
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>{pm.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. partial payment, advance…"
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Pay Salary</Button>
      </div>
    </form>
  );
}

// ── Bonus Dialog ───────────────────────────────────────────────────────────────
function BonusDialog({
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
  onSave: (bonusType: string, payload: object) => Promise<{ error: unknown }>;
  onClose: () => void;
}) {
  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();

  const [bonusType, setBonusType] = useState(BONUS_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [bonusMonth, setBonusMonth] = useState(month);
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isCustomType = bonusType === "__custom__";
  const effectiveType = isCustomType ? customType.trim() : bonusType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Valid amount required"); return; }
    if (isCustomType && !customType.trim()) { setError("Please enter a benefit type name"); return; }
    if (!paymentMethodId) { setError("Payment method is required"); return; }
    setSaving(true);
    const desc = note
      ? `${effectiveType} — ${row.name} (${note})`
      : `${effectiveType} — ${row.name}`;
    const { error: err } = await onSave(effectiveType, {
      restaurant_id: restaurantId,
      type: "expense",
      description: desc,
      amount: amt,
      payment_method_id: paymentMethodId,
      status: "paid",
      transaction_date: date,
      staff_id: row.staffId,
      payroll_month: `${bonusMonth}-01`,
    });
    setSaving(false);
    if (err) { setError(String(err)); return; }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-purple-50 rounded-xl border border-purple-100 px-4 py-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-purple-500">Staff</span>
          <span className="font-medium text-gray-800">{row.name}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Benefit Type *</label>
        <select
          value={bonusType}
          onChange={(e) => { setBonusType(e.target.value); setError(""); }}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {BONUS_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
          <option value="__custom__">+ Custom type…</option>
        </select>
        {isCustomType && (
          <input
            type="text"
            value={customType}
            onChange={(e) => { setCustomType(e.target.value); setError(""); }}
            placeholder="Enter benefit type name"
            autoFocus
            className="w-full h-9 px-3 rounded-lg border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">For Month *</label>
        <input
          type="month"
          value={bonusMonth}
          onChange={(e) => { if (e.target.value) setBonusMonth(e.target.value); }}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Amount (৳) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="0"
          />
        </div>
        <Input
          label="Date *"
          type="date"
          value={date}
          max={todayStr}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Payment Method *</label>
        <select
          value={paymentMethodId}
          onChange={(e) => { setPaymentMethodId(e.target.value); setError(""); }}
          className={`w-full h-9 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${!paymentMethodId ? "border-orange-300" : "border-gray-200"}`}
        >
          <option value="">Select payment method…</option>
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>{pm.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Eid bonus, weekly bonus…"
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Give Benefit</Button>
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
  const [bonusTarget, setBonusTarget] = useState<PayrollRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PayrollRow | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PaymentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch payroll SALARY payments for the selected month (bonuses excluded from due calc)
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
      .select("staff_id, amount, description")
      .in("restaurant_id", restaurantIds)
      .eq("type", "expense")
      .eq("status", "paid")
      .not("staff_id", "is", null)
      .gte("payroll_month", monthStart)
      .lte("payroll_month", monthEnd);

    const map = new Map<string, number>();
    (data ?? []).forEach((r: any) => {
      // Only salary payments count towards due calculation
      if (r.staff_id && isSalaryTx(r.description)) {
        map.set(r.staff_id, (map.get(r.staff_id) ?? 0) + r.amount);
      }
    });
    setPayrollData(map);
    setLoadingPayroll(false);
  }, [restaurantIds, month]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  // Fetch all payment history (salary + bonuses) for a staff member
  const fetchHistory = useCallback(async (staffId: string) => {
    setHistoryLoading(true);
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

    const records = (data ?? []) as unknown as PaymentRecord[];
    setHistoryRecords(records.map(r => ({
      ...r,
      isBonus: !isSalaryTx(r.description),
      bonusType: !isSalaryTx(r.description) ? getBonusLabel(r.description) : undefined,
    })));
    setHistoryLoading(false);
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
        staffType: s.staff_type,
        restaurantName: s.restaurants?.name ?? null,
        restaurantId: s.restaurant_id,
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
  const hallCount = rows.filter(r => r.staffType === "hall").length;
  const kitchenCount = rows.filter(r => r.staffType === "kitchen").length;

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

  // Save salary payment
  const handlePaySave = async (payload: object) => {
    const supabase = createClient();
    const salaryCategoryId = await getOrCreateBonusCategory(supabase, "Salary");
    const { error } = await supabase.from("transactions").insert({
      ...payload,
      ...(salaryCategoryId ? { category_id: salaryCategoryId } : {}),
    });
    if (!error) fetchPayroll();
    return { error };
  };

  // Save bonus/benefit payment
  const handleBonusSave = async (bonusType: string, payload: object) => {
    const supabase = createClient();
    const categoryId = await getOrCreateBonusCategory(supabase, bonusType);
    const { error } = await supabase.from("transactions").insert({
      ...payload,
      ...(categoryId ? { category_id: categoryId } : {}),
    });
    if (!error) fetchPayroll();
    return { error };
  };

  return (
    <>
      <Header title="Staff Payroll" />

      <div className="p-6 space-y-4">

        {/* ── Month Selector & Filters ── */}
        <div className="bg-white border border-border rounded-xl shadow-sm shrink-0 h-[62px] flex items-center px-6 border-b border-gray-100 gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 px-[14px] rounded-lg border border-[#e5e7eb] text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
            />
            {/* Status filter */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
              {([["all", "All"], ["unpaid", "Unpaid"], ["partial", "Partial"], ["paid", "Paid"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-all ${
                    statusFilter === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="w-52 h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-[18px]">
          {/* Total Staff */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users size={16} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Staff</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{rows.length}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {hallCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600">
                  <Utensils size={9} /> {hallCount} Hall
                </span>
              )}
              {kitchenCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600">
                  <ChefHat size={9} /> {kitchenCount} Kitchen
                </span>
              )}
              {hallCount === 0 && kitchenCount === 0 && (
                <p className="text-[10px] text-gray-400">{fullyPaid} fully paid</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <DollarSign size={16} className="text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Payroll</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{fmt(totalSalary)}</p>
            <p className="text-xs text-gray-400 mt-1">{getMonthLabel(month)}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
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

          <div className={`rounded-xl border shadow-sm p-4 ${totalDue > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
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
                    <td className="px-4 py-3">
                      {row.staffType === "kitchen" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                          <ChefHat size={9} /> Kitchen
                        </span>
                      ) : row.staffType === "hall" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          <Utensils size={9} /> Hall
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
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
                            className="px-2 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            History
                          </button>
                        )}
                        <button
                          onClick={() => setBonusTarget(row)}
                          className="flex items-center gap-0.5 px-2 py-1 text-[11px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                        >
                          <Gift size={10} /> Benefit
                        </button>
                        {row.status !== "fully_paid" && row.monthlySalary > 0 && (
                          <button
                            onClick={() => setPayTarget(row)}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-[#111827] hover:bg-black rounded-lg transition-colors"
                          >
                            <Plus size={10} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">
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

      {/* ── Pay Salary Dialog ── */}
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

      {/* ── Add Benefit Dialog ── */}
      {bonusTarget && activeRestaurant && (
        <Dialog
          open={!!bonusTarget}
          onOpenChange={(o) => !o && setBonusTarget(null)}
          title={`Add Benefit — ${bonusTarget.name}`}
          maxWidth="max-w-md"
        >
          <BonusDialog
            row={bonusTarget}
            month={month}
            paymentMethods={paymentMethods}
            restaurantId={activeRestaurant.id}
            onSave={handleBonusSave}
            onClose={() => setBonusTarget(null)}
          />
        </Dialog>
      )}

      {/* ── Payment History Dialog ── */}
      {historyTarget && (
        <Dialog
          open={!!historyTarget}
          onOpenChange={(o) => { if (!o) { setHistoryTarget(null); setHistoryRecords([]); } }}
          title={`Payment History — ${historyTarget.name}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{getMonthLabel(month)}</p>
              <button
                onClick={() => printSalaryStatement(historyTarget, historyRecords, month, activeRestaurant?.name ?? "Restaurant")}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Printer size={11} /> Print Statement
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
                <Loader2 size={15} className="animate-spin" /> Loading…
              </div>
            ) : historyRecords.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No payments recorded</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {historyRecords.map((r) => (
                  <li key={r.id} className="py-3 flex items-start justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-gray-700">
                          {new Date(r.transaction_date + "T12:00:00").toLocaleDateString("en-GB", {
                            day: "numeric", month: "short",
                          })}
                        </p>
                        {r.isBonus ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            <Gift size={8} /> {r.bonusType}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                            Salary
                          </span>
                        )}
                      </div>
                      {r.payment_methods?.name && (
                        <p className="text-xs text-gray-400 mt-0.5">{r.payment_methods.name}</p>
                      )}
                    </div>
                    <span className={`font-semibold shrink-0 ${r.isBonus ? "text-purple-600" : "text-green-600"}`}>
                      {fmt(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!historyLoading && historyRecords.length > 0 && (
              <>
                {/* Breakdown */}
                {(() => {
                  const salaryPaid = historyRecords.filter(r => !r.isBonus).reduce((s, r) => s + r.amount, 0);
                  const bonusPaid = historyRecords.filter(r => r.isBonus).reduce((s, r) => s + r.amount, 0);
                  const salaryDue = Math.max(0, historyTarget!.monthlySalary - salaryPaid);
                  return (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>Monthly Salary</span>
                        <span className="font-semibold text-gray-700">{fmt(historyTarget!.monthlySalary)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Salary Paid</span>
                        <span className="font-semibold text-green-600">{fmt(salaryPaid)}</span>
                      </div>
                      {bonusPaid > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Benefits & Bonuses</span>
                          <span className="font-semibold text-purple-600">{fmt(bonusPaid)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1.5 border-t border-gray-200 font-semibold">
                        <span className="text-gray-700">Total Paid</span>
                        <span className="text-gray-800">{fmt(salaryPaid + bonusPaid)}</span>
                      </div>
                      {salaryDue > 0 && (
                        <div className="flex justify-between text-amber-700 font-semibold">
                          <span>Salary Due</span>
                          <span>{fmt(salaryDue)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setHistoryTarget(null); setHistoryRecords([]); }}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
