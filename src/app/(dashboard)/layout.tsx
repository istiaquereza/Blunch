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
        <div className="flex h-screen overflow-hidden bg-zinc-100">
          <Sidebar />
          <main className="flex-1 overflow-hidden p-6">
            <div className="bg-[#FAFAFA] rounded-2xl overflow-y-auto h-full flex flex-col">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </RestaurantProvider>
  );
}
