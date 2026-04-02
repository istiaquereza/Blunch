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
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F9F8F5" }}>
          <Sidebar />
          <main className="flex-1 overflow-hidden md:p-6">
            <div className="bg-[#FAFAFA] md:rounded-2xl overflow-y-auto h-full flex flex-col md:border md:border-gray-200 md:shadow-sm">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </RestaurantProvider>
  );
}
