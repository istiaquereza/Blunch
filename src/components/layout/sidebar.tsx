"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, type NavItem } from "./nav-config";
import { useSidebar } from "@/contexts/sidebar-context";

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const { closeSidebar } = useSidebar();
  const hasChildren = item.children && item.children.length > 0;
  const isActive = hasChildren
    ? pathname === item.href
    : pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
  const isExpanded = (pathname === item.href || pathname.startsWith(item.href + "/")) && hasChildren;
  const [open, setOpen] = useState(isExpanded);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
            isActive
              ? "bg-gray-900 text-white"
              : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <item.icon
            size={18}
            className={cn(
              "shrink-0 transition-colors",
              isActive ? "text-white" : "group-hover:text-sidebar-foreground"
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
          ? "bg-gray-900 text-white"
          : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <item.icon
        size={18}
        className={cn(
          "shrink-0",
          isActive ? "text-white" : "group-hover:text-sidebar-foreground"
        )}
      />
      <span>{item.title}</span>
    </Link>
  );
}

function SidebarContent({ showClose = false }: { showClose?: boolean }) {
  const { closeSidebar } = useSidebar();

  return (
    <aside className="w-64 shrink-0 bg-sidebar h-full flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border flex items-center justify-between">
        <p
          className="text-3xl leading-none tracking-tight select-none"
          style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 600, color: "#C2C3C7" }}
        >
          Blunch<span style={{ color: "#F97316" }}>.</span>
        </p>
        {showClose && (
          <button
            onClick={closeSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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

      {/* Footer */}
      <div className="px-5 py-3 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 text-center">
          Made with <span style={{ color: "#F97316" }}>♥</span> from <span className="font-medium">gridlab</span>
        </p>
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
