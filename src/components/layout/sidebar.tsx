"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, type NavItem } from "./nav-config";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSidebar } from "@/contexts/sidebar-context";

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const { closeSidebar } = useSidebar();
  const hasChildren = item.children && item.children.length > 0;
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href));
  const isExpanded = pathname.startsWith(item.href) && hasChildren;
  const [open, setOpen] = useState(isExpanded);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
            isActive
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <item.icon
            size={18}
            className={cn(
              "shrink-0 transition-colors",
              isActive ? "text-orange-400" : "group-hover:text-orange-400"
            )}
          />
          <span className="flex-1 text-left">{item.title}</span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
        {open && (
          <div className="mt-1 ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
            {item.children!.map((child) => (
              <NavLink key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={closeSidebar}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
        isActive
          ? "bg-orange-500 text-white"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <item.icon
        size={18}
        className={cn(
          "shrink-0",
          isActive ? "text-white" : "group-hover:text-orange-400"
        )}
      />
      <span>{item.title}</span>
    </Link>
  );
}

function SidebarContent({ showClose = false }: { showClose?: boolean }) {
  const router = useRouter();
  const { closeSidebar } = useSidebar();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-64 shrink-0 bg-sidebar h-full flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <p className="text-sidebar-foreground font-bold text-sm leading-none">
              Blunch
            </p>
            <p className="text-sidebar-foreground/40 text-xs mt-0.5">
              Restaurant Management
            </p>
          </div>
        </div>
        {showClose && (
          <button
            onClick={closeSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors group"
        >
          <LogOut size={18} className="shrink-0 group-hover:text-orange-400" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export function Sidebar() {
  const { sidebarOpen, closeSidebar } = useSidebar();

  return (
    <>
      {/* Desktop: always-visible sticky sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile: slide-in overlay drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSidebar}
          />
          {/* Drawer */}
          <div className="relative z-10 h-full shadow-2xl">
            <SidebarContent showClose />
          </div>
        </div>
      )}
    </>
  );
}
