"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { useTransactions, type Transaction } from "@/hooks/use-transactions";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronRight,
  ArrowUpCircle,
  ArrowDownCircle,
  FileDown,
  Wallet,
  Tag,
  CreditCard,
} from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

type Preset = "today" | "this_week" | "this_month" | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "today",      label: "Today" },
  { value: "this_week",  label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom",     label: "Custom Range" },
];

function getPresetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  switch (p) {
    case "today":      return { from: ymd(now), to: ymd(now) };
    case "this_week":  return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: ymd(now) };
    case "this_month": return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: ymd(now) };
    default:           return { from: ymd(now), to: ymd(now) };
  }
}

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Day Row ──────────────────────────────────────────────────────────────────
interface DayGroup {
  date: string;
  income: Transaction[];
  expense: Transaction[];
  totalIncome: number;
  totalExpense: number;
  net: number;
}

function DayRow({ group }: { group: DayGroup }) {
  const [expanded, setExpanded] = useState(false);
  const allTx = [...group.income, ...group.expense].sort(
    (a, b) => a.transaction_date.localeCompare(b.transaction_date)
  );

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          <div>
            <p className="text-sm font-semibold text-gray-900">{fmtDateLong(group.date)}</p>
            <p className="text-xs text-gray-400">{allTx.length} transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-gray-400">Income</p>
            <p className="text-sm font-semibold text-green-600">{fmt(group.totalIncome)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Expense</p>
            <p className="text-sm font-semibold text-red-500">{fmt(group.totalExpense)}</p>
          </div>
          <div className="text-right min-w-[80px]">
            <p className="text-xs text-gray-400">Net</p>
            <p className={`text-sm font-bold ${group.net >= 0 ? "text-blue-600" : "text-orange-500"}`}>
              {group.net >= 0 ? "+" : ""}{fmt(group.net)}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {allTx.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-6 py-2.5 bg-gray-50">
              <div className="flex items-center gap-3">
                {t.type === "income"
                  ? <ArrowUpCircle size={14} className="text-green-500 shrink-0" />
                  : <ArrowDownCircle size={14} className="text-red-400 shrink-0" />}
                <div>
                  <p className="text-sm text-gray-700">
                    {t.description ?? <span className="italic text-gray-400">No description</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.expense_categories && (
                      <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                        {t.expense_categories.name}
                      </span>
                    )}
                    {t.payment_methods && (
                      <span className="text-xs text-gray-400">{t.payment_methods.name}</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      t.status === "paid" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                    }`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              </div>
              <span className={`text-sm font-semibold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PDF print helper ──────────────────────────────────────────────────────────
function printSummary(
  restaurantName: string,
  dateFrom: string,
  dateTo: string,
  transactions: Transaction[],
  incomeByCategory: { name: string; total: number }[],
  expenseByCategory: { name: string; total: number }[],
  incomeByMethod: { name: string; total: number }[],
  cashInHand: number,
  totals: { income: number; expense: number; net: number; days: number; count: number }
) {
  const row = (label: string, amount: number, color = "#111") =>
    `<tr><td>${label}</td><td style="text-align:right;color:${color};font-weight:600">${fmt(amount)}</td></tr>`;

  const tableSection = (title: string, rows: { name: string; total: number }[], color: string) => `
    <div class="section">
      <h3 style="color:${color}">${title}</h3>
      <table>
        <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows.map((r) => row(r.name, r.total)).join("")}</tbody>
      </table>
    </div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Daily Sells Report</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px}
  .meta{color:#666;font-size:12px;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
  .card p{margin:0;font-size:12px;color:#6b7280}
  .card .val{font-size:18px;font-weight:700;margin-top:4px}
  .section{margin-bottom:20px}
  h3{font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;border-bottom:2px solid #333;padding:5px 4px;font-size:11px;text-transform:uppercase}
  td{padding:5px 4px;border-bottom:1px solid #eee}
  .total-row td{border-top:2px solid #333;font-weight:700}
  .cash-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center}
  @media print{body{padding:0}}
</style></head>
<body>
  <h1>Daily Sells Report</h1>
  <div class="meta">
    ${restaurantName} &nbsp;·&nbsp;
    ${dateFrom === dateTo ? fmtDateShort(dateFrom) : `${fmtDateShort(dateFrom)} → ${fmtDateShort(dateTo)}`}
    &nbsp;·&nbsp; ${totals.days} day${totals.days !== 1 ? "s" : ""}, ${totals.count} transactions
  </div>

  <div class="grid">
    <div class="card"><p>Total Income</p><div class="val" style="color:#16a34a">${fmt(totals.income)}</div></div>
    <div class="card"><p>Total Expense</p><div class="val" style="color:#ef4444">${fmt(totals.expense)}</div></div>
    <div class="card"><p>Net Balance</p><div class="val" style="color:${totals.net >= 0 ? "#2563eb" : "#f97316"}">${fmt(totals.net)}</div></div>
    <div class="card"><p>Cash in Hand</p><div class="val" style="color:#16a34a">${fmt(cashInHand)}</div></div>
  </div>

  <div class="grid">
    ${tableSection("Income by Category", incomeByCategory.length ? incomeByCategory : [{ name: "Uncategorized", total: totals.income }], "#16a34a")}
    ${tableSection("Expenses by Category", expenseByCategory.length ? expenseByCategory : [{ name: "Uncategorized", total: totals.expense }], "#ef4444")}
  </div>

  ${tableSection("Income by Payment Method", incomeByMethod, "#2563eb")}

  <div class="cash-box">
    <strong>Cash in Hand (End of Period)</strong>
    <strong style="font-size:16px;color:#16a34a">${fmt(cashInHand)}</strong>
  </div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailySellsPage() {
  const { activeRestaurant } = useRestaurant();
  const [preset, setPreset] = useState<Preset>("today");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());

  const { transactions, loading } = useTransactions(activeRestaurant?.id, dateFrom, dateTo);

  // Group by date
  const dayGroups: DayGroup[] = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const d = t.transaction_date.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, txs]) => {
        const income = txs.filter((t) => t.type === "income");
        const expense = txs.filter((t) => t.type === "expense");
        const totalIncome = income.reduce((s, t) => s + t.amount, 0);
        const totalExpense = expense.reduce((s, t) => s + t.amount, 0);
        return { date, income, expense, totalIncome, totalExpense, net: totalIncome - totalExpense };
      });
  }, [transactions]);

  const totals = useMemo(() => ({
    income: transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    days: dayGroups.length,
    count: transactions.length,
  }), [transactions, dayGroups]);

  const net = totals.income - totals.expense;

  // Income by category
  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions.filter((t) => t.type === "income")) {
      const k = t.expense_categories?.name ?? "Uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  // Expenses by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions.filter((t) => t.type === "expense")) {
      const k = t.expense_categories?.name ?? "Uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  // Income by payment method
  const incomeByMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions.filter((t) => t.type === "income")) {
      const k = t.payment_methods?.name ?? "Unspecified";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  // Cash in hand = cash income − cash expenses
  const cashInHand = useMemo(() => {
    const cashIn = transactions
      .filter((t) => t.type === "income" && t.payment_methods?.name?.toLowerCase().includes("cash"))
      .reduce((s, t) => s + t.amount, 0);
    const cashOut = transactions
      .filter((t) => t.type === "expense" && t.payment_methods?.name?.toLowerCase().includes("cash"))
      .reduce((s, t) => s + t.amount, 0);
    return cashIn - cashOut;
  }, [transactions]);

  const bestDay = dayGroups.reduce<DayGroup | null>((b, g) => (!b || g.net > b.net ? g : b), null);
  const worstDay = dayGroups.reduce<DayGroup | null>((w, g) => (!w || g.net < w.net ? g : w), null);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = getPresetRange(p);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  return (
    <>
      <Header title="Daily Sells Report" />

      <div className="p-4 md:p-6 space-y-4">

        {/* ── Toolbar ── */}
        <div className="bg-white rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Preset */}
            <select
              value={preset}
              onChange={(e) => handlePreset(e.target.value as Preset)}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Custom date pickers */}
            {preset === "custom" && (
              <>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <span className="text-gray-400 text-sm">→</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </>
            )}

            <span className="text-xs text-gray-400 ml-1">
              {totals.days} day{totals.days !== 1 ? "s" : ""} · {totals.count} transactions
            </span>

            <div className="flex-1" />

            {/* PDF Download */}
            <button
              onClick={() => printSummary(
                activeRestaurant?.name ?? "Restaurant",
                dateFrom, dateTo,
                transactions,
                incomeByCategory,
                expenseByCategory,
                incomeByMethod,
                cashInHand,
                { ...totals, net }
              )}
              title="Download PDF Report"
              className="h-9 w-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 flex items-center justify-center transition-colors"
            >
              <FileDown size={16} />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} className="text-green-500" />
              <p className="text-xs text-gray-500">Total Income</p>
            </div>
            <p className="text-xl font-bold text-green-600">{fmt(totals.income)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={15} className="text-red-500" />
              <p className="text-xs text-gray-500">Total Expense</p>
            </div>
            <p className="text-xl font-bold text-red-500">{fmt(totals.expense)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={15} className={net >= 0 ? "text-blue-500" : "text-orange-500"} />
              <p className="text-xs text-gray-500">Net Balance</p>
            </div>
            <p className={`text-xl font-bold ${net >= 0 ? "text-blue-600" : "text-red-500"}`}>{fmt(net)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={15} className="text-emerald-500" />
              <p className="text-xs text-gray-500">Cash in Hand</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">{fmt(cashInHand)}</p>
            <p className="text-xs text-gray-400 mt-1">cash in − cash out</p>
          </div>
        </div>

        {/* Category + Payment Method breakdown */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Income by Category */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Tag size={14} className="text-green-500" />
                <h3 className="text-sm font-semibold text-gray-800">Income by Category</h3>
              </div>
              {incomeByCategory.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-400 text-center">No income recorded</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {incomeByCategory.map((c) => (
                    <li key={c.name} className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{c.name}</span>
                      <span className="text-sm font-semibold text-green-600">{fmt(c.total)}</span>
                    </li>
                  ))}
                  <li className="px-4 py-2.5 flex items-center justify-between bg-gray-50 border-t border-gray-200">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Total</span>
                    <span className="text-sm font-bold text-green-700">{fmt(totals.income)}</span>
                  </li>
                </ul>
              )}
            </div>

            {/* Expenses by Category */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Tag size={14} className="text-red-500" />
                <h3 className="text-sm font-semibold text-gray-800">Expenses by Category</h3>
              </div>
              {expenseByCategory.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-400 text-center">No expenses recorded</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {expenseByCategory.map((c) => (
                    <li key={c.name} className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{c.name}</span>
                      <span className="text-sm font-semibold text-red-500">{fmt(c.total)}</span>
                    </li>
                  ))}
                  <li className="px-4 py-2.5 flex items-center justify-between bg-gray-50 border-t border-gray-200">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Total</span>
                    <span className="text-sm font-bold text-red-600">{fmt(totals.expense)}</span>
                  </li>
                </ul>
              )}
            </div>

            {/* Income by Payment Method + Cash in Hand */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <CreditCard size={14} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Income by Payment Method</h3>
                </div>
                {incomeByMethod.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-gray-400 text-center">No income recorded</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {incomeByMethod.map((m) => (
                      <li key={m.name} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm text-gray-700">{m.name}</span>
                        <span className="text-sm font-semibold text-blue-600">{fmt(m.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Cash in Hand highlight */}
              <div className={`rounded-xl border p-4 ${cashInHand >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={15} className={cashInHand >= 0 ? "text-emerald-600" : "text-red-500"} />
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cash in Hand</p>
                </div>
                <p className={`text-2xl font-bold ${cashInHand >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmt(cashInHand)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Cash income minus cash expenses
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Best / Worst */}
        {dayGroups.length >= 2 && (
          <div className="grid grid-cols-2 gap-4">
            {bestDay && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs font-semibold text-green-700 mb-1">Best Day</p>
                <p className="text-sm font-bold text-green-800">{fmtDateShort(bestDay.date)}</p>
                <p className="text-lg font-bold text-green-600 mt-1">+{fmt(bestDay.net)}</p>
              </div>
            )}
            {worstDay && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs font-semibold text-red-700 mb-1">Worst Day</p>
                <p className="text-sm font-bold text-red-800">{fmtDateShort(worstDay.date)}</p>
                <p className="text-lg font-bold text-red-500">{fmt(worstDay.net)}</p>
              </div>
            )}
          </div>
        )}

        {/* Day list */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Loading report…</div>
        ) : !activeRestaurant ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
            Select a restaurant to view the report.
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Calendar size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No data for this period</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting the date range.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayGroups.map((g) => <DayRow key={g.date} group={g} />)}
          </div>
        )}
      </div>
    </>
  );
}
