"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck, Plus, Pencil, Trash2, Search, X, Check,
  Users, Crown, Briefcase, ShoppingCart, Eye,
  LayoutDashboard, UtensilsCrossed, Package, TrendingUp,
  BarChart2, UserCog, Settings, ChevronDown, ChevronUp,
  AlertCircle, ToggleLeft, ToggleRight, Copy, KeyRound,
  Zap, History, UserPlus, RefreshCw, Activity, Building2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ─── Role definitions ──────────────────────────────────────────────────────────
type AppRole = "super_admin" | "owner" | "manager" | "cashier" | "viewer";

const ROLES: {
  value: AppRole;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}[] = [
  { value: "super_admin", label: "Super Admin", description: "Full access + activity log for all users", color: "text-amber-700", bg: "bg-amber-100", border: "border-amber-300", icon: Zap },
  { value: "owner",       label: "Owner",       description: "Full access to all features and settings", color: "text-purple-700", bg: "bg-purple-100", border: "border-purple-300", icon: Crown },
  { value: "manager",     label: "Manager",     description: "Access to most features, except user management", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-300", icon: Briefcase },
  { value: "cashier",     label: "Cashier",     description: "Can create orders and view sells", color: "text-green-700", bg: "bg-green-100", border: "border-green-300", icon: ShoppingCart },
  { value: "viewer",      label: "Viewer",      description: "Read-only access to dashboard and reports", color: "text-gray-700", bg: "bg-gray-100", border: "border-gray-300", icon: Eye },
];

// ─── Permission matrix ─────────────────────────────────────────────────────────
type PermLevel = "full" | "view" | "none";
type PermRow = { module: string; icon: React.ElementType } & Record<AppRole, PermLevel>;

const PERMISSIONS: PermRow[] = [
  { module: "Dashboard",        icon: LayoutDashboard, super_admin: "full", owner: "full", manager: "full",  cashier: "view", viewer: "view" },
  { module: "Orders",           icon: ShoppingCart,    super_admin: "full", owner: "full", manager: "full",  cashier: "full", viewer: "none" },
  { module: "Food Menu",        icon: UtensilsCrossed, super_admin: "full", owner: "full", manager: "full",  cashier: "view", viewer: "view" },
  { module: "Inventory",        icon: Package,         super_admin: "full", owner: "full", manager: "full",  cashier: "none", viewer: "none" },
  { module: "Sells & Expenses", icon: TrendingUp,      super_admin: "full", owner: "full", manager: "full",  cashier: "view", viewer: "view" },
  { module: "Analytics",        icon: BarChart2,       super_admin: "full", owner: "full", manager: "full",  cashier: "none", viewer: "view" },
  { module: "User Management",  icon: UserCog,         super_admin: "full", owner: "full", manager: "none",  cashier: "none", viewer: "none" },
  { module: "Activity Log",     icon: Activity,        super_admin: "full", owner: "full", manager: "none",  cashier: "none", viewer: "none" },
  { module: "Settings",         icon: Settings,        super_admin: "full", owner: "full", manager: "view",  cashier: "none", viewer: "none" },
];

function PermBadge({ level }: { level: PermLevel }) {
  if (level === "full") return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600"><Check size={12} /></span>;
  if (level === "view") return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-400"><Eye size={11} /></span>;
  return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-300"><X size={11} /></span>;
}

function RoleBadge({ role }: { role: AppRole }) {
  const def = ROLES.find((r) => r.value === role) ?? ROLES[4];
  const Icon = def.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${def.bg} ${def.color}`}>
      <Icon size={11} /> {def.label}
    </span>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AppUserRow {
  id: string;
  restaurant_id: string;
  email: string;
  name: string;
  role: AppRole;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface UserAssignment {
  id: string;
  restaurant_id: string;
  role: AppRole;
}

interface UserGroup {
  email: string;
  name: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  assignments: UserAssignment[];
  isOwner?: boolean;
}

interface ActivityLog {
  id: string;
  actor_email: string;
  action: string;
  target_label: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  "user.created":        { label: "Added user",       color: "text-green-700",  bg: "bg-green-100",  icon: UserPlus },
  "user.deleted":        { label: "Removed user",     color: "text-red-700",    bg: "bg-red-100",    icon: Trash2 },
  "user.role_changed":   { label: "Changed role",     color: "text-blue-700",   bg: "bg-blue-100",   icon: ShieldCheck },
  "user.activated":      { label: "Activated user",   color: "text-green-700",  bg: "bg-green-100",  icon: ToggleRight },
  "user.deactivated":    { label: "Deactivated user", color: "text-orange-700", bg: "bg-orange-100", icon: ToggleLeft },
  "user.password_reset": { label: "Reset password",   color: "text-purple-700", bg: "bg-purple-100", icon: KeyRound },
  "user.updated":        { label: "Updated user",     color: "text-blue-700",   bg: "bg-blue-100",   icon: Pencil },
};

const EMPTY_FORM = { email: "", name: "", password: "", role: "cashier" as AppRole, notes: "", restaurant_ids: [] as string[] };

// ─── SQL setup helpers ─────────────────────────────────────────────────────────
const SETUP_SQL = `-- 1. Create app_user_roles table
create table if not exists app_user_roles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('super_admin','owner','manager','cashier','viewer')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, email)
);
alter table app_user_roles enable row level security;
drop policy if exists "authenticated_full_access" on app_user_roles;
create policy "authenticated_full_access"
  on app_user_roles for all to authenticated
  using (true) with check (true);

-- 2. Create activity_logs table
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  actor_email text not null,
  action text not null,
  target_label text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table activity_logs enable row level security;
drop policy if exists "authenticated_full_access" on activity_logs;
create policy "authenticated_full_access"
  on activity_logs for all to authenticated
  using (true) with check (true);`;

const MIGRATE_SQL = `-- Add super_admin to role constraint
alter table app_user_roles drop constraint if exists app_user_roles_role_check;
alter table app_user_roles add constraint app_user_roles_role_check
  check (role in ('super_admin','owner','manager','cashier','viewer'));

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  actor_email text not null,
  action text not null,
  target_label text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table activity_logs enable row level security;
drop policy if exists "authenticated_full_access" on activity_logs;
create policy "authenticated_full_access"
  on activity_logs for all to authenticated
  using (true) with check (true);`;

const RLS_FIX_SQL = `-- Run this if you get permission errors on an existing table:
drop policy if exists "authenticated_full_access" on app_user_roles;
alter table app_user_roles enable row level security;
create policy "authenticated_full_access"
  on app_user_roles for all to authenticated
  using (true) with check (true);`;

function isTableMissingError(error: any): boolean {
  return (
    error?.code === "42P01" || error?.code === "PGRST200" ||
    error?.message?.toLowerCase().includes("does not exist") ||
    error?.message?.toLowerCase().includes("relation") ||
    (typeof error?.details === "string" && error.details.toLowerCase().includes("does not exist"))
  );
}

function isPermissionError(error: any): boolean {
  return (
    error?.code === "42501" || error?.code === "PGRST301" ||
    error?.message?.toLowerCase().includes("permission denied") ||
    error?.message?.toLowerCase().includes("new row violates") ||
    error?.message?.toLowerCase().includes("rls") ||
    error?.message?.toLowerCase().includes("row-level security") ||
    error?.hint?.toLowerCase().includes("row-level security")
  );
}

function TableSetupView({ isRLS, showSQL, setShowSQL, showRLSFix, setShowRLSFix, fetchUsers }: {
  isRLS: boolean; showSQL: boolean; setShowSQL: (v: boolean) => void;
  showRLSFix: boolean; setShowRLSFix: (v: boolean) => void; fetchUsers: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      <Header title="Roles &amp; Access" />
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">{isRLS ? "Permission error — RLS policy missing" : "One-time setup required"}</h3>
              <p className="text-sm text-amber-700 mt-1">
                {isRLS ? "The table exists but Row Level Security is blocking writes. Run the SQL below in your Supabase SQL Editor to fix it."
                  : "The app_user_roles table doesn't exist yet. Run the SQL below in your Supabase SQL Editor to set it up."}
              </p>
            </div>
          </div>
          <button onClick={() => setShowSQL(!showSQL)} className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900">
            {showSQL ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showSQL ? "Hide" : "Show"} {isRLS ? "RLS fix" : "setup"} SQL
          </button>
          {showSQL && (
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto leading-relaxed font-mono">{isRLS ? RLS_FIX_SQL : SETUP_SQL}</pre>
              <button onClick={() => { navigator.clipboard.writeText(isRLS ? RLS_FIX_SQL : SETUP_SQL); toast.success("SQL copied!"); }}
                className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors">
                <Copy size={11} /> Copy
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <p className="text-xs text-amber-600 flex-1">Steps: Open Supabase Dashboard &rarr; SQL Editor &rarr; paste &amp; run &rarr; refresh.</p>
            <button onClick={fetchUsers} className="h-8 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shrink-0">Retry</button>
          </div>
        </div>
        {isRLS && (
          <div className="bg-white border border-border rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ChevronDown size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">If the table doesn&apos;t exist at all, use this instead:</span>
            </div>
            <button onClick={() => setShowRLSFix(!showRLSFix)} className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium">
              {showRLSFix ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showRLSFix ? "Hide" : "Show"} full setup SQL
            </button>
            {showRLSFix && (
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto leading-relaxed font-mono">{SETUP_SQL}</pre>
                <button onClick={() => { navigator.clipboard.writeText(SETUP_SQL); toast.success("SQL copied!"); }}
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors">
                  <Copy size={11} /> Copy
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AppUsersPage() {
  const { restaurants } = useRestaurant();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState<"unknown" | "yes" | "missing" | "rls">("unknown");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "">("");
  const [restaurantFilter, setRestaurantFilter] = useState<string>("");
  const [showMatrix, setShowMatrix] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [showRLSFix, setShowRLSFix] = useState(false);
  const [authEmails, setAuthEmails] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showMigrateSQL, setShowMigrateSQL] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserGroup | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch all users (across all restaurants) ─────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await createClient()
      .from("app_user_roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (isTableMissingError(error)) setTableReady("missing");
      else if (isPermissionError(error)) setTableReady("rls");
      else setTableReady("missing");
      setLoading(false);
      return;
    }

    setTableReady("yes");
    const rows: AppUserRow[] = data ?? [];

    // Group by email
    const map = new Map<string, UserGroup>();
    for (const row of rows) {
      const key = row.email.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { email: key, name: row.name, is_active: row.is_active, notes: row.notes, created_at: row.created_at, assignments: [] });
      }
      const g = map.get(key)!;
      g.assignments.push({ id: row.id, restaurant_id: row.restaurant_id, role: row.role });
      // is_active = false if ANY assignment is inactive
      if (!row.is_active) g.is_active = false;
      // keep the earliest created_at
      if (row.created_at < g.created_at) g.created_at = row.created_at;
    }
    const groupList = Array.from(map.values());
    setGroups(groupList);
    setLoading(false);

    // Check which users have a Supabase Auth account
    if (rows.length > 0) {
      const uniqueEmails = [...new Set(rows.map((u) => u.email.toLowerCase()))].join(",");
      fetch(`/api/app-users?emails=${encodeURIComponent(uniqueEmails)}`)
        .then((r) => r.json())
        .then((json) => { if (json.authEmails) setAuthEmails(new Set(json.authEmails as string[])); })
        .catch(() => {});
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        const meta = data.user.user_metadata;
        const name = meta?.full_name ?? meta?.name ?? data.user.email.split("@")[0];
        setCurrentUser({ email: data.user.email, name });
      }
    });
  }, []);

  // ── Activity log ─────────────────────────────────────────────────────────────
  const fetchActivityLogs = async () => {
    setLogsLoading(true);
    const rIds = restaurants.map((r) => r.id);
    const { data } = await createClient()
      .from("activity_logs")
      .select("id, actor_email, action, target_label, details, created_at")
      .in("restaurant_id", rIds.length > 0 ? rIds : ["__none__"])
      .order("created_at", { ascending: false })
      .limit(100);
    setActivityLogs(data ?? []);
    setLogsLoading(false);
  };

  useEffect(() => { if (showActivityLog) fetchActivityLogs(); }, [showActivityLog, restaurants]);

  const logActivity = async (action: string, targetLabel: string, details?: Record<string, any>) => {
    if (!currentUser || restaurants.length === 0) return;
    try {
      await createClient().from("activity_logs").insert({
        restaurant_id: restaurants[0].id,
        actor_email: currentUser.email,
        action, target_label: targetLabel, details: details ?? null,
      });
    } catch { /* silent */ }
  };

  // ── Filtered / stats ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (roleFilter && !g.assignments.some((a) => a.role === roleFilter)) return false;
      if (restaurantFilter && !g.assignments.some((a) => a.restaurant_id === restaurantFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [groups, search, roleFilter, restaurantFilter]);

  // ── Open add / edit ──────────────────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };

  const openEdit = (g: UserGroup) => {
    setEditing(g);
    setForm({
      email: g.email,
      name: g.name,
      role: g.assignments[0]?.role ?? "cashier",
      notes: g.notes ?? "",
      password: "",
      restaurant_ids: g.assignments.map((a) => a.restaurant_id),
    });
    setModalOpen(true);
  };

  const openEditOwner = () => {
    if (!currentUser) return;
    const ownerGroup: UserGroup = { email: currentUser.email, name: currentUser.name, is_active: true, notes: null, created_at: "", assignments: [], isOwner: true };
    setEditing(ownerGroup);
    setForm({ email: currentUser.email, name: currentUser.name, role: "super_admin", notes: "", password: "", restaurant_ids: [] });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(EMPTY_FORM); };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.email.trim()) { toast.error("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Enter a valid email"); return; }
    if (!editing && !form.password.trim()) { toast.error("Password is required"); return; }
    if (!editing && form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!editing && form.restaurant_ids.length === 0) { toast.error("Select at least one restaurant"); return; }
    setSaving(true);

    // ── Editing account owner ────────────────────────────────────────────────
    if (editing?.isOwner) {
      const updates: { data?: { full_name: string }; password?: string } = { data: { full_name: form.name.trim() } };
      if (form.password.trim()) {
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); setSaving(false); return; }
        updates.password = form.password;
      }
      const { error } = await createClient().auth.updateUser(updates);
      setSaving(false);
      if (error) { toast.error("Failed to update: " + error.message); return; }
      setCurrentUser((p) => p ? { ...p, name: form.name.trim() } : p);
      toast.success(form.password.trim() ? "Profile & password updated" : "Profile updated");
      closeModal();
      return;
    }

    if (editing) {
      // ── Update existing user ───────────────────────────────────────────────
      const currentIds = new Set(editing.assignments.map((a) => a.restaurant_id));
      const newIds = new Set(form.restaurant_ids);
      const supabase = createClient();

      // Update / remove existing assignments
      for (const assignment of editing.assignments) {
        if (newIds.has(assignment.restaurant_id)) {
          // Still assigned — update role/name/notes
          await supabase.from("app_user_roles").update({ name: form.name.trim(), role: form.role, notes: form.notes.trim() || null }).eq("id", assignment.id);
        } else {
          // Removed — delete assignment
          await supabase.from("app_user_roles").delete().eq("id", assignment.id);
        }
      }

      // Add new assignments
      for (const rid of form.restaurant_ids) {
        if (!currentIds.has(rid)) {
          await supabase.from("app_user_roles").upsert(
            { restaurant_id: rid, email: editing.email, name: form.name.trim(), role: form.role, notes: form.notes.trim() || null, is_active: true },
            { onConflict: "restaurant_id,email" }
          );
        }
      }

      // Optional password reset via API
      if (form.password.trim() && form.password.length >= 6) {
        const res = await fetch("/api/app-users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.assignments[0]?.id ?? "__none__", email: editing.email, name: form.name.trim(), role: form.role, notes: form.notes.trim() || null, password: form.password }),
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json.error ?? "Failed to reset password"); setSaving(false); return; }
        await logActivity("user.password_reset", form.name.trim());
      }

      await logActivity("user.updated", form.name.trim(), { role: form.role });
      toast.success(form.password.trim() ? "User updated & password reset" : "User updated");

    } else {
      // ── Create new user ────────────────────────────────────────────────────
      // Call POST once per restaurant (API handles auth creation idempotently)
      for (let i = 0; i < form.restaurant_ids.length; i++) {
        const rid = form.restaurant_ids[i];
        const res = await fetch("/api/app-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            role: form.role,
            notes: form.notes.trim() || null,
            restaurant_id: rid,
          }),
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json.error ?? "Failed to create user"); setSaving(false); return; }
      }
      await logActivity("user.created", form.name.trim(), { role: form.role, email: form.email.trim().toLowerCase() });
      toast.success("User created — they can now log in with their email & password");
    }

    setSaving(false);
    closeModal();
    await fetchUsers();
  };

  // ── Toggle active (all assignments for this user) ────────────────────────────
  const toggleActive = async (g: UserGroup) => {
    const newActive = !g.is_active;
    const ids = g.assignments.map((a) => a.id);
    const { error } = await createClient().from("app_user_roles").update({ is_active: newActive }).in("id", ids);
    if (error) { toast.error("Failed to update status"); return; }
    await logActivity(newActive ? "user.activated" : "user.deactivated", g.name);
    toast.success(newActive ? "User activated" : "User deactivated");
    fetchUsers();
  };

  // ── Delete (all assignments for this user) ───────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const ids = confirmDelete.assignments.map((a) => a.id);
    const { error } = await createClient().from("app_user_roles").delete().in("id", ids);
    if (error) { toast.error("Failed to delete"); setDeleting(false); return; }
    await logActivity("user.deleted", confirmDelete.name, { email: confirmDelete.email });
    toast.success("User removed");
    setConfirmDelete(null);
    setDeleting(false);
    fetchUsers();
  };

  // ── Table not ready ──────────────────────────────────────────────────────────
  if (tableReady === "missing" || tableReady === "rls") {
    return (
      <TableSetupView isRLS={tableReady === "rls"} showSQL={showSQL} setShowSQL={setShowSQL}
        showRLSFix={showRLSFix} setShowRLSFix={setShowRLSFix} fetchUsers={fetchUsers} />
    );
  }
  if (tableReady === "unknown") {
    return (
      <div className="flex flex-col h-full bg-background">
        <Header title="Roles & Access" />
        <div className="flex-1 flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <Header title="Roles & Access" hideRestaurantSelector />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* ── Toolbar ── */}
        <div className="bg-white border border-border rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setRoleFilter("")} className={`h-7 px-3 rounded-md text-[12px] font-medium transition-all ${roleFilter === "" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>All</button>
              {ROLES.map((r) => (
                <button key={r.value} onClick={() => setRoleFilter(roleFilter === r.value ? "" : r.value)}
                  className={`h-7 px-3 rounded-md text-[12px] font-medium transition-all ${roleFilter === r.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {restaurants.length > 1 && (
              <select
                value={restaurantFilter ?? "all"}
                onChange={(e) => setRestaurantFilter(e.target.value === "all" ? "" : e.target.value)}
                className="h-8 px-3 rounded-lg border border-gray-200 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#111827] bg-white"
              >
                <option value="all">All Restaurants</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openAdd} className="h-8 px-3 rounded-lg bg-[#111827] hover:bg-black text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors shrink-0">
              <Plus size={14} /> Add User
            </button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…"
                className="h-8 pl-8 pr-3 w-56 rounded-lg border border-gray-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#111827] bg-gray-50" />
            </div>
          </div>
        </div>

        {/* ── Role cards ── */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const count = groups.filter((g) => g.assignments.some((a) => a.role === role.value)).length
              + (role.value === "super_admin" && currentUser && !groups.some((g) => g.email === currentUser.email.toLowerCase()) ? 1 : 0);
            return (
              <div key={role.value} className={`bg-white border ${role.border} rounded-xl p-3 flex items-center gap-2.5`}>
                <div className={`w-7 h-7 rounded-lg ${role.bg} flex items-center justify-center shrink-0`}>
                  <Icon size={13} className={role.color} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${role.color} truncate`}>{role.label}</p>
                  <p className="text-sm font-bold text-gray-900">{count} <span className="text-[10px] font-normal text-gray-400">user{count !== 1 ? "s" : ""}</span></p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Permission Matrix ── */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <button onClick={() => setShowMatrix(!showMatrix)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={15} className="text-purple-600" />
              <span className="text-sm font-semibold text-gray-800">Role Permissions Matrix</span>
              <span className="text-xs text-gray-400">— who can access what</span>
            </div>
            {showMatrix ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>
          {showMatrix && (
            <div className="border-t border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">Module</th>
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      return (
                        <th key={r.value} className="px-4 py-3 text-center">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${r.bg} ${r.color}`}>
                            <Icon size={11} /> {r.label}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {PERMISSIONS.map((row) => {
                    const Icon = row.icon;
                    return (
                      <tr key={row.module} className="hover:bg-gray-50/40">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 text-sm text-gray-700 font-medium"><Icon size={13} className="text-gray-400" /> {row.module}</div>
                        </td>
                        {ROLES.map((r) => <td key={r.value} className="px-4 py-3 text-center"><PermBadge level={row[r.value]} /></td>)}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/60 border-t border-border">
                    <td colSpan={ROLES.length + 1} className="px-5 py-2.5">
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-600"><Check size={9} /></span> Full access</span>
                        <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-400"><Eye size={9} /></span> View only</span>
                        <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-300"><X size={9} /></span> No access</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Users table ── */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-400">Loading users…</div>
          ) : (filtered.length === 0 && !currentUser) ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Users size={20} className="text-gray-400" /></div>
              <p className="text-sm font-medium text-gray-500">{groups.length === 0 ? "No users yet. Click \"Add User\" to get started." : "No users match your filters."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Restaurant & Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Added</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Current logged-in user row */}
                  {currentUser && !groups.some((g) => g.email === currentUser.email.toLowerCase()) && (
                    <tr className="bg-amber-50/40 hover:bg-amber-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {currentUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 text-sm">{currentUser.name}</p>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700"><Zap size={9} /> You</span>
                            </div>
                            <p className="text-xs text-gray-400">{currentUser.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Zap size={11} /> Super Admin · All</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 hidden md:table-cell">—</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><ToggleRight size={13} /> Active</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={openEditOwner} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Edit your profile">
                            <Pencil size={13} />
                          </button>
                          <span className="text-xs text-gray-400 italic">You</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filtered.map((g) => (
                    <tr key={g.email} className={`hover:bg-gray-50/60 transition-colors ${!g.is_active ? "opacity-50" : ""}`}>
                      {/* User */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
                              {!authEmails.has(g.email) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700" title="No login account">
                                  <KeyRound size={9} /> No login
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{g.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Restaurant & Role */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {g.assignments.map((a) => {
                            const restaurant = restaurants.find((r) => r.id === a.restaurant_id);
                            const roleDef = ROLES.find((r) => r.value === a.role);
                            if (!restaurant || !roleDef) return null;
                            return (
                              <span key={a.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleDef.bg} ${roleDef.color} border-transparent`}>
                                <Building2 size={9} />
                                {restaurant.name}
                                <span className="opacity-60 mx-0.5">·</span>
                                {roleDef.label}
                              </span>
                            );
                          })}
                          {g.assignments.length === 0 && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>

                      {/* Added date */}
                      <td className="px-4 py-3.5 text-sm text-gray-500 hidden md:table-cell">
                        {g.created_at ? format(new Date(g.created_at), "dd MMM yyyy") : "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => toggleActive(g)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            g.is_active ? "bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600" : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
                          }`} title={g.is_active ? "Click to deactivate" : "Click to activate"}>
                          {g.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {g.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => setConfirmDelete(g)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Migration banner ── */}
        {showMigrateSQL && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Migration SQL — Super Admin &amp; Activity Log</p>
              <p className="text-xs text-amber-700 mt-0.5">Run this in Supabase SQL Editor if activity log isn't working.</p>
              <div className="relative mt-2">
                <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto font-mono leading-relaxed">{MIGRATE_SQL}</pre>
                <button onClick={() => { navigator.clipboard.writeText(MIGRATE_SQL); toast.success("SQL copied!"); }}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium">
                  <Copy size={10} /> Copy
                </button>
              </div>
            </div>
            <button onClick={() => setShowMigrateSQL(false)} className="text-amber-400 hover:text-amber-600 shrink-0"><X size={14} /></button>
          </div>
        )}

        {/* ── Activity Log ── */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div onClick={() => setShowActivityLog(!showActivityLog)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center"><Zap size={12} className="text-amber-600" /></div>
              <span className="text-sm font-semibold text-gray-800">Activity Log</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><Zap size={8} /> Super Admin</span>
            </div>
            <div className="flex items-center gap-2">
              {showActivityLog && (
                <button onClick={(e) => { e.stopPropagation(); fetchActivityLogs(); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100">
                  <RefreshCw size={11} /> Refresh
                </button>
              )}
              {showActivityLog ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </div>
          </div>
          {showActivityLog && (
            <div className="border-t border-border">
              {logsLoading ? <div className="p-8 text-center text-sm text-gray-400">Loading activity…</div>
                : activityLogs.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2.5"><History size={18} className="text-gray-400" /></div>
                    <p className="text-sm text-gray-500">No activity recorded yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Actions like adding users, changing roles, and more will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {activityLogs.map((log) => {
                      const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, color: "text-gray-700", bg: "bg-gray-100", icon: Activity };
                      const Icon = cfg.icon;
                      return (
                        <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}><Icon size={13} className={cfg.color} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-gray-700">{log.actor_email}</span>
                              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                              {log.target_label && <span className="text-xs text-gray-600 font-semibold">&ldquo;{log.target_label}&rdquo;</span>}
                            </div>
                            {log.details && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {log.details.old_role && log.details.new_role
                                  ? <span className="text-[10px] text-gray-400">{log.details.old_role} → {log.details.new_role}</span>
                                  : log.details.role ? <span className="text-[10px] text-gray-400">Role: {log.details.role}</span> : null}
                                {log.details.email && <span className="text-[10px] text-gray-400">{log.details.email}</span>}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 mt-1">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </div>

      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center"><ShieldCheck size={15} className="text-purple-600" /></div>
                <h2 className="font-semibold text-gray-900">{editing ? "Edit User" : "Add New User"}</h2>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Karim Ahmed"
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="user@restaurant.com" disabled={!!editing}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-400" />
                {editing && <p className="text-xs text-gray-400 mt-1">Email cannot be changed after creation.</p>}
              </div>

              {/* Password */}
              {!editing?.isOwner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {editing ? "Password" : "Password *"}
                    {editing && <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span>}
                  </label>
                  {editing && !authEmails.has(editing.email) && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 mb-2">
                      <KeyRound size={13} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 leading-snug"><span className="font-semibold">Login not set up.</span> Set a password below to activate this user&apos;s login credentials.</p>
                    </div>
                  )}
                  <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editing ? "Enter new password to reset…" : "Min. 6 characters"}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  {!editing && <p className="text-xs text-gray-400 mt-1">This password lets the user sign in to the app.</p>}
                </div>
              )}

              {/* Owner password only */}
              {editing?.isOwner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
                  <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Enter new password to reset…"
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              )}

              {/* Restaurant multi-select — not shown for owner edit */}
              {!editing?.isOwner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {editing ? "Restaurant Access" : "Assign to Restaurants *"}
                  </label>
                  {restaurants.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No restaurants found. Add a restaurant in Settings first.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {restaurants.map((r) => (
                        <label key={r.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer select-none">
                          <input type="checkbox" checked={form.restaurant_ids.includes(r.id)}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              restaurant_ids: e.target.checked ? [...f.restaurant_ids, r.id] : f.restaurant_ids.filter((id) => id !== r.id),
                            }))}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
                          <Building2 size={13} className="text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-700 flex-1">{r.name}</span>
                          {r.type === "outlet" && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">outlet</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Role picker — not shown for owner (locked super_admin) */}
              {!editing?.isOwner && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Role *</label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ROLES.map((role) => {
                      const Icon = role.icon;
                      const active = form.role === role.value;
                      return (
                        <button key={role.value} type="button" onClick={() => setForm((f) => ({ ...f, role: role.value }))}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${active ? `${role.border} ${role.bg}` : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${active ? role.bg : "bg-gray-100"}`}>
                            <Icon size={12} className={active ? role.color : "text-gray-400"} />
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${active ? role.color : "text-gray-700"}`}>{role.label}</p>
                            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{role.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {editing && editing.assignments.length > 1 && (
                    <p className="text-xs text-gray-400 mt-1.5">This role will apply to all selected restaurants.</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {!editing?.isOwner && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Weekend shift cashier" rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl shrink-0">
              <button onClick={closeModal} className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving ? "Saving…" : editing ? "Save Changes" : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0"><Trash2 size={16} className="text-red-500" /></div>
              <div>
                <h3 className="font-semibold text-gray-900">Remove User</h3>
                <p className="text-sm text-gray-500 mt-0.5">This will remove all restaurant access for <strong>{confirmDelete.name}</strong>.</p>
              </div>
            </div>
            {confirmDelete.assignments.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {confirmDelete.assignments.map((a) => {
                  const r = restaurants.find((x) => x.id === a.restaurant_id);
                  return r ? <span key={a.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.name}</span> : null;
                })}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
