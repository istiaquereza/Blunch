import {
  LayoutDashboard,
  UtensilsCrossed,
  Package,
  Settings,
  Users,
  TrendingUp,
  ShoppingCart,
  ChefHat,
  FlaskConical,
  Boxes,
  ShoppingBag,
  Warehouse,
  CreditCard,
  FileText,
  ClipboardList,
  UserCog,
  CalendarDays,
  BadgeCheck,
  Banknote,
  History,
  BarChart2,
  ShieldCheck,
  Truck,
  QrCode,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
};

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Food",
    href: "/food",
    icon: UtensilsCrossed,
    children: [
      { title: "Menu", href: "/food/menu", icon: ChefHat },
      { title: "Ingredients", href: "/food/ingredients", icon: FlaskConical },
      { title: "Recipe", href: "/food/recipe", icon: FileText },
    ],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    children: [
      { title: "Assets", href: "/inventory/assets", icon: Boxes },
      { title: "Food Inventory", href: "/inventory/food-inventory", icon: Warehouse },
      { title: "Bazar Requests", href: "/inventory/bazar-requests", icon: ShoppingBag },
      { title: "Inventory History", href: "/inventory/history", icon: History },
    ],
  },
  {
    title: "CRM",
    href: "/crm",
    icon: Users,
  },
  {
    title: "Sells & Expenses",
    href: "/sells-expenses",
    icon: TrendingUp,
    children: [
      { title: "Income & Expenses", href: "/sells-expenses/income-expenses", icon: CreditCard },
      { title: "Daily Sells Report", href: "/sells-expenses/daily-sells", icon: ClipboardList },
    ],
  },
  {
    title: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    children: [
      { title: "New Order", href: "/orders/order", icon: ShoppingCart },
      { title: "Order Details", href: "/orders/order-details", icon: ClipboardList },
      { title: "Customer Order", href: "/customer-order", icon: QrCode },
      { title: "Remote Order", href: "/orders/remote-order", icon: Smartphone },
    ],
  },
  {
    title: "Staff Management",
    href: "/staff",
    icon: UserCog,
    children: [
      { title: "Staff Information", href: "/staff/information", icon: BadgeCheck },
      { title: "Leave Calendar", href: "/staff/leave-calendar", icon: CalendarDays },
      { title: "Staff Payroll", href: "/staff/payroll", icon: Banknote },
      { title: "Vendors", href: "/staff/vendors", icon: Truck },
    ],
  },
  {
    title: "User Access",
    href: "/user-access",
    icon: ShieldCheck,
    children: [
      { title: "Roles & Access", href: "/staff/app-users", icon: ShieldCheck },
    ],
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart2,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
