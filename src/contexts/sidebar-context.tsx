"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarOpen: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar: () => setSidebarOpen((v) => !v),
        closeSidebar: () => setSidebarOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
