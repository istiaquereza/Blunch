"use client";

import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useRestaurant } from "@/contexts/restaurant-context";
import {
  useTransactions,
  useExpenseCategories,
  type Transaction,
  type ExpenseCategory,
} from "@/hooks/use-transactions";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useAllStaff } from "@/hooks/use-staff";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Tag,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
  Search,
  Users,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function today() { return localYmd(new Date()); }
function fmt_date(d: Date) { return localYmd(d); }

type Preset = "all_time" | "today" | "last7" | "this_month" | "last_month" | "custom";

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case "all_time":
      return { from: "", to: "" };
    case "today":
      return { from: fmt_date(now), to: fmt_date(now) };
    case "last7": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: fmt_date(from), to: fmt_date(now) };
    }
    case "this_month":
      return {
        from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        to: fmt_date(now),
      };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt_date(first), to: fmt_date(last) };
    }
    default:
      return { from: "", to: "" };
  }
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "all_time", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

// ─── Transaction Form ─────────────────────────────────────────────────────────
interface TxFormProps {
  initial?: Transaction;
  categories: ExpenseCategory[];
  paymentMethods: { id: string; name: string }[];
  restaurantId: string;
  restaurantIds: string[]; // all restaurants for staff lookup
  onSave: (payload: Omit<Transaction, "id" | "created_at" | "expense_categories" | "payment_methods" | "staff">) => Promise<{ error: unknown }>;
  onClose: () => void;
}

type TxTab = "income" | "expense" | "payroll";

function PayrollForm({
  restaurantIds,
  restaurantId,
  paymentMethods,
  onSave,
  onClose,
}: {
  restaurantIds: string[];
  restaurantId: string;
  paymentMethods: { id: string; name: string }[];
  onSave: (payload: Omit<Transaction, "id" | "created_at" | "expense_categories" | "payment_methods" | "staff">) => Promise<{ error: unknown }>;
  onClose: () => void;
}) {
  const { staff } = useAllStaff(restaurantIds);
  const [staffId, setStaffId] = useState("");
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Salary info for selected staff
  const selectedStaff = staff.find(s => s.id === staffId);
  const [paidThisMonth, setPaidThisMonth] = useState(0);

  // Fetch how much has been paid this month for selected staff
  useEffect(() => {
    if (!staffId || !payrollMonth) { setPaidThisMonth(0); return; }
    const supabase = createClient();
    const monthStart = `${payrollMonth}-01`;
    // Calculate end of month
    const [yr, mo] = payrollMonth.split("-").map(Number);
    const monthEnd = new Date(yr, mo, 0); // last day of month
    const monthEndStr = `${yr}-${String(mo).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

    supabase
      .from("transactions")
      .select("amount")
      .eq("staff_id", staffId)
      .eq("type", "expense")
      .eq("status", "paid")
      .gte("payroll_month", monthStart)
      .lte("payroll_month", monthEndStr)
      .then(({ data }) => {
        const total = (data ?? []).reduce((s: number, r: any) => s + r.amount, 0);
        setPaidThisMonth(total);
      });
  }, [staffId, payrollMonth]);

  const totalSalary = selectedStaff?.salary ?? 0;
  const due = Math.max(0, totalSalary - paidThisMonth);
  const isFullyPaid = totalSalary > 0 && due <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) { setError("Please select a staff member"); return; }
    if (!payrollMonth) { setError("Please select a month"); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Valid amount is required"); return; }
    if (amt > due) { setError(`Amount cannot exceed due amount (৳${due.toLocaleString()})`); return; }
    setSaving(true);
    const monthDate = `${payrollMonth}-01`;
    const desc = description || `Salary - ${selectedStaff?.name ?? ""} (${payrollMonth})`;
    const { error: err } = await onSave({
      restaurant_id: restaurantId,
      type: "expense",
      description: desc,
      amount: amt,
      payment_method_id: paymentMethodId || undefined,
      status: "paid",
      transaction_date: date,
      staff_id: staffId,
      payroll_month: monthDate,
    });
    setSaving(false);
    if (err) { setError(String(err)); return; }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Staff selector */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Staff Member *</label>
        <select
          value={staffId}
          onChange={(e) => { setStaffId(e.target.value); setError(""); }}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Select staff…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.restaurants?.name ? ` — ${s.restaurants.name}` : ""}{s.job_role ? ` (${s.job_role})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Month picker */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Payroll Month *</label>
        <input
          type="month"
          value={payrollMonth}
          onChange={(e) => setPayrollMonth(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Salary summary banner */}
      {selectedStaff && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${isFullyPaid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <p className="font-semibold text-gray-700">{selectedStaff.name}</p>
              <p className="text-xs text-gray-500">{selectedStaff.job_role ?? "Staff"}</p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-xs text-gray-500">Monthly Salary</p>
              <p className="font-bold text-gray-800">৳{totalSalary.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-current/10 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-500">Paid</p>
              <p className="font-semibold text-green-600">৳{paidThisMonth.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Due</p>
              <p className={`font-semibold ${due > 0 ? "text-amber-600" : "text-green-600"}`}>
                ৳{due.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className={`font-semibold text-xs ${isFullyPaid ? "text-green-600" : "text-amber-600"}`}>
                {isFullyPaid ? "Fully Paid" : "Pending"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Amount (৳) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            disabled={isFullyPaid}
            placeholder={isFullyPaid ? "Fully paid" : due > 0 ? `Max ৳${due.toLocaleString()}` : "0.00"}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          {selectedStaff && due > 0 && (
            <p className="text-xs text-amber-600">Due: ৳{due.toLocaleString()}</p>
          )}
        </div>
        <Input
          label="Date *"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <Input
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={selectedStaff ? `Salary — ${selectedStaff.name} (${payrollMonth})` : "Salary payment…"}
      />

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
        <Button type="submit" loading={saving} disabled={isFullyPaid}>
          Add Payroll
        </Button>
      </div>
    </form>
  );
}

function TxForm({ initial, categories, paymentMethods, restaurantId, restaurantIds, onSave, onClose }: TxFormProps) {
  const [tab, setTab] = useState<TxTab>(initial ? (initial.staff_id ? "payroll" : initial.type) : "expense");
  const [form, setForm] = useState({
    type: (initial?.type ?? "expense") as "expense" | "income",
    description: initial?.description ?? "",
    amount: initial ? String(initial.amount) : "",
    category_id: initial?.category_id ?? "",
    payment_method_id: initial?.payment_method_id ?? "",
    status: initial?.status ?? "paid" as "paid" | "due",
    transaction_date: initial?.transaction_date ?? today(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const filteredCats = categories.filter((c) => c.type === form.type);

  // Sync form.type when tab changes (income/expense tabs only)
  useEffect(() => {
    if (tab === "income" || tab === "expense") {
      setForm(f => ({ ...f, type: tab }));
    }
  }, [tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || isNaN(parseFloat(form.amount))) {
      setError("Valid amount is required");
      return;
    }
    setSaving(true);
    const { error: err } = await onSave({
      restaurant_id: restaurantId,
      type: form.type,
      description: form.description || undefined,
      amount: parseFloat(form.amount),
      category_id: form.category_id || undefined,
      payment_method_id: form.payment_method_id || undefined,
      status: form.status,
      transaction_date: form.transaction_date,
    });
    setSaving(false);
    if (err) { setError(String(err)); return; }
    onClose();
  };

  // If editing a payroll tx, show edit form directly (no tab switching)
  if (initial?.staff_id) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Editing payroll transaction. Use the Staff Payroll page for full payroll management.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (৳) *" type="number" min="0" step="0.01" value={form.amount}
            onChange={(e) => { set("amount", e.target.value); setError(""); }} placeholder="0.00" />
          <Input label="Date *" type="date" value={form.transaction_date}
            onChange={(e) => set("transaction_date", e.target.value)} />
        </div>
        <Input label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      {!initial && (
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([["income", "Income"], ["expense", "Expense"], ["payroll", "Payroll"]] as [TxTab, string][]).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? t === "income" ? "bg-green-500 text-white"
                    : t === "expense" ? "bg-red-500 text-white"
                    : "bg-purple-600 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "payroll" && !initial ? (
        <PayrollForm
          restaurantIds={restaurantIds}
          restaurantId={restaurantId}
          paymentMethods={paymentMethods}
          onSave={onSave}
          onClose={onClose}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle for income/expense */}
          {initial && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(["income", "expense"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { set("type", t); set("category_id", ""); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    form.type === t
                      ? t === "income" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {t === "income" ? "Income" : "Expense"}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (৳) *"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => { set("amount", e.target.value); setError(""); }}
              placeholder="0.00"
            />
            <Input
              label="Date *"
              type="date"
              value={form.transaction_date}
              onChange={(e) => set("transaction_date", e.target.value)}
            />
          </div>

          <Input
            label="Description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What is this for?"
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={form.category_id}
                onChange={(e) => set("category_id", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">No category</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Payment Method</label>
              <select
                value={form.payment_method_id}
                onChange={(e) => set("payment_method_id", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Not specified</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(["paid", "due"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    form.status === s
                      ? s === "paid" ? "bg-green-500 text-white" : "bg-yellow-500 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {s === "paid" ? "Paid" : "Due"}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>
              {initial ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Category Manager ─────────────────────────────────────────────────────────
interface CategoryManagerProps {
  categories: ExpenseCategory[];
  onCreate: (name: string, type: "expense" | "income") => Promise<{ error: unknown }>;
  onRemove: (id: string) => Promise<{ error: unknown }>;
}
function CategoryManager({ categories, onCreate, onRemove }: CategoryManagerProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), type);
    setSaving(false);
    setName("");
  };

  const incomes = categories.filter((c) => c.type === "income");
  const expenses = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Category name"
          className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "expense" | "income")}
          className="h-9 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <Button size="sm" loading={saving} onClick={handleAdd} disabled={!name.trim()}>
          <Plus size={14} /> Add
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
        {[{ label: "Income", items: incomes, color: "bg-green-50 text-green-700" }, { label: "Expense", items: expenses, color: "bg-red-50 text-red-700" }].map(({ label, items, color }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
            {items.length === 0 ? (
              <p className="text-xs text-gray-300 italic">None yet</p>
            ) : (
              <ul className="space-y-1">
                {items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{c.name}</span>
                    <button onClick={() => onRemove(c.id)} className="p-0.5 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IncomeExpensesPage() {
  const { activeRestaurant, restaurants } = useRestaurant();
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const { transactions, loading, create, update, remove } = useTransactions(
    activeRestaurant?.id,
    dateFrom || undefined,
    dateTo || undefined
  );
  const { categories, create: createCat, remove: removeCat } = useExpenseCategories();
  const { methods: paymentMethods } = usePaymentMethods(activeRestaurant?.id);

  const [preset, setPreset] = useState<Preset>("today");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [viewTx, setViewTx] = useState<Transaction | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = useMemo(() => {
    let list = transactions;
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (categoryFilter) list = list.filter((t) => t.expense_categories?.id === categoryFilter);
    if (search) list = list.filter((t) => t.description?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [transactions, typeFilter, categoryFilter, search]);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;
  const totalDue = transactions.filter((t) => t.type === "expense" && t.status === "due").reduce((s, t) => s + t.amount, 0);

  const reqIdFromDesc = (desc?: string | null) => {
    if (!desc) return null;
    const m = desc.match(/^(REQ-[A-Z0-9]+):/);
    return m ? m[1] : null;
  };

  return (
    <>
      <Header title="Income & Expenses" />

      <div className="p-4 md:p-6 space-y-4">
        {/* ── Toolbar ── */}
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions…"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <select
              value={preset}
              onChange={(e) => {
                const p = e.target.value as Preset;
                setPreset(p);
                if (p !== "custom") {
                  const { from, to } = getPresetRange(p);
                  setDateFrom(from);
                  setDateTo(to);
                }
              }}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {preset === "custom" && (
              <>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </>
            )}

            <div className="flex rounded-lg border border-gray-200 overflow-hidden h-9">
              {(["all", "income", "expense"] as const).map(chip => (
                <button
                  key={chip}
                  onClick={() => setTypeFilter(chip)}
                  className={`px-3 text-xs font-medium transition-colors capitalize ${
                    typeFilter === chip
                      ? chip === "income" ? "bg-green-500 text-white" : chip === "expense" ? "bg-red-500 text-white" : "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {chip === "all" ? "All" : chip === "income" ? "Income" : "Expense"}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex-1" />

            <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>
              <Tag size={14} /> Categories
            </Button>
            <Button onClick={() => setAddOpen(true)} disabled={!activeRestaurant} size="sm">
              <Plus size={14} /> Add Transaction
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp size={16} className="text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Income</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{fmt(totalIncome)}</p>
            <p className="text-xs text-gray-400 mt-1">{transactions.filter((t) => t.type === "income").length} entries</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown size={16} className="text-red-500" />
              </div>
              <span className="text-xs font-medium text-gray-500">Total Expense</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{fmt(totalExpense)}</p>
            <p className="text-xs text-gray-400 mt-1">{transactions.filter((t) => t.type === "expense").length} entries</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${net >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
                <DollarSign size={16} className={net >= 0 ? "text-blue-600" : "text-orange-500"} />
              </div>
              <span className="text-xs font-medium text-gray-500">Net Balance</span>
            </div>
            <p className={`text-2xl font-bold ${net >= 0 ? "text-blue-600" : "text-red-500"}`}>{fmt(net)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {!dateFrom && !dateTo ? "All time" : dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`}
            </p>
          </div>
          <div className={`rounded-xl border p-4 ${totalDue > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalDue > 0 ? "bg-amber-100" : "bg-gray-50"}`}>
                <TrendingDown size={16} className={totalDue > 0 ? "text-amber-600" : "text-gray-400"} />
              </div>
              <span className={`text-xs font-medium ${totalDue > 0 ? "text-amber-700" : "text-gray-500"}`}>Due Expenses</span>
            </div>
            <p className={`text-2xl font-bold ${totalDue > 0 ? "text-amber-700" : "text-gray-400"}`}>{fmt(totalDue)}</p>
            <p className={`text-xs mt-1 ${totalDue > 0 ? "text-amber-600" : "text-gray-400"}`}>
              {transactions.filter((t) => t.type === "expense" && t.status === "due").length} outstanding
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading transactions…</div>
          ) : !activeRestaurant ? (
            <div className="p-8 text-center text-sm text-gray-400">Select a restaurant to view transactions.</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No transactions found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or add a new transaction.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(t.transaction_date + "T12:00:00").toLocaleDateString("en-GB", {
                        day: "numeric", month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {t.type === "income" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <ArrowUpCircle size={11} /> Income
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                          <ArrowDownCircle size={11} /> Expense
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[240px]">
                      {(() => {
                        const reqId = reqIdFromDesc(t.description);
                        const rawItems = reqId && t.description
                          ? t.description.slice(reqId.length + 1).trim()
                          : null;
                        const items = rawItems ? rawItems.split(" | ") : [];
                        const firstItem = items[0]
                          ? items[0].replace(/ @৳.*$/, "").trim()
                          : null;
                        const summaryLabel = firstItem
                          ? items.length > 1
                            ? `${firstItem} & ${items.length - 1} more`
                            : firstItem
                          : t.description;
                        return (
                          <div className="flex flex-col gap-0.5">
                            {reqId && (
                              <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded w-fit">
                                {reqId}
                              </span>
                            )}
                            <span className="truncate text-gray-600 text-xs">
                              {summaryLabel || <span className="text-gray-300">—</span>}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {t.expense_categories?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {t.payment_methods?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.status === "paid"
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}>
                        {t.status === "paid" ? "Paid" : "Due"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                        {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {t.type === "expense" && t.status === "due" && (
                          <button
                            onClick={() => update(t.id, { status: "paid" })}
                            title="Mark as Paid"
                            className="px-2 py-1 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => setViewTx(t)}
                          title="View details"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => setEditTarget(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50">
                    <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-gray-500">
                      {filtered.length} transactions
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs space-y-0.5">
                        <div className="text-green-600 font-semibold">
                          +{fmt(filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0))}
                        </div>
                        <div className="text-red-500 font-semibold">
                          -{fmt(filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0))}
                        </div>
                      </div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {/* ── View Transaction Dialog ── */}
      {viewTx && (() => {
        const reqId = reqIdFromDesc(viewTx.description);
        const rawItems = reqId && viewTx.description
          ? viewTx.description.slice(reqId.length + 1).trim()
          : null;
        const itemList = rawItems ? rawItems.split(" | ") : [];
        return (
          <Dialog
            open={!!viewTx}
            onOpenChange={(o) => !o && setViewTx(null)}
            title="Transaction Details"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Date</p>
                  <p className="font-medium">
                    {new Date(viewTx.transaction_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Amount</p>
                  <p className={`text-lg font-bold ${viewTx.type === "income" ? "text-green-600" : "text-red-500"}`}>
                    {viewTx.type === "income" ? "+" : "-"}{fmt(viewTx.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Type</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${viewTx.type === "income" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {viewTx.type === "income" ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                    {viewTx.type === "income" ? "Income" : "Expense"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Status</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${viewTx.status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {viewTx.status === "paid" ? "Paid" : "Due"}
                  </span>
                </div>
                {viewTx.expense_categories?.name && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Category</p>
                    <p className="text-sm text-gray-700">{viewTx.expense_categories.name}</p>
                  </div>
                )}
                {viewTx.payment_methods?.name && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Payment Method</p>
                    <p className="text-sm text-gray-700">{viewTx.payment_methods.name}</p>
                  </div>
                )}
              </div>

              {reqId && (
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded">
                      {reqId}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bazar Items</span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {itemList.length > 0 && itemList[0] !== "" ? (
                      itemList.map((item, i) => {
                        const atIdx = item.lastIndexOf(" @৳");
                        const namePart = atIdx >= 0 ? item.slice(0, atIdx) : item;
                        const pricePart = atIdx >= 0 ? "৳" + item.slice(atIdx + 3) : "";
                        return (
                          <li key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                            <span className="text-gray-700 font-medium">{namePart}</span>
                            {pricePart && <span className="text-gray-500 text-xs">{pricePart}</span>}
                          </li>
                        );
                      })
                    ) : (
                      <li className="px-4 py-2.5 text-sm text-gray-400 italic">Item details not available</li>
                    )}
                  </ul>
                  <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-100 flex justify-between text-sm font-semibold">
                    <span className="text-gray-600">Total</span>
                    <span className={viewTx.type === "income" ? "text-green-600" : "text-red-500"}>{fmt(viewTx.amount)}</span>
                  </div>
                </div>
              )}

              {!reqId && viewTx.description && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Description</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{viewTx.description}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                {viewTx.type === "expense" && viewTx.status === "due" && (
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                    onClick={() => { update(viewTx.id, { status: "paid" }); setViewTx(null); }}
                  >
                    Mark as Paid
                  </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setViewTx(null)}>Close</Button>
              </div>
            </div>
          </Dialog>
        );
      })()}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add Transaction" maxWidth="max-w-lg">
        {activeRestaurant && (
          <TxForm
            categories={categories}
            paymentMethods={paymentMethods}
            restaurantId={activeRestaurant.id}
            restaurantIds={restaurants.map(r => r.id)}
            onSave={create}
            onClose={() => setAddOpen(false)}
          />
        )}
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)} title="Edit Transaction" maxWidth="max-w-lg">
        {editTarget && activeRestaurant && (
          <TxForm
            initial={editTarget}
            categories={categories}
            paymentMethods={paymentMethods}
            restaurantId={activeRestaurant.id}
            restaurantIds={restaurants.map(r => r.id)}
            onSave={(payload) => update(editTarget.id, payload)}
            onClose={() => setEditTarget(null)}
          />
        )}
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Transaction">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete this {deleteTarget.type} of{" "}
              <span className="font-semibold">{fmt(deleteTarget.amount)}</span>
              {deleteTarget.description ? ` — ${deleteTarget.description}` : ""}? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleteLoading}
                onClick={async () => {
                  setDeleteLoading(true);
                  await remove(deleteTarget.id);
                  setDeleteLoading(false);
                  setDeleteTarget(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Category Manager */}
      <Dialog open={catOpen} onOpenChange={setCatOpen} title="Manage Categories">
        <CategoryManager
          categories={categories}
          onCreate={createCat}
          onRemove={removeCat}
        />
      </Dialog>
    </>
  );
}
