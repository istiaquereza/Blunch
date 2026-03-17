import { Sidebar } from "@/components/layout/sidebar";
import { RestaurantProvider } from "@/contexts/restaurant-context";
import { SidebarProvider } from "@/contexts/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RestaurantProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </SidebarProvider>
    </RestaurantProvider>
  );
}
