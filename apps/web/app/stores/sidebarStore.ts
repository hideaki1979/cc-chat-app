import { create } from "zustand";

interface SidebarState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    setIsSidebarOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
    isSidebarOpen: false, // デフォルトは閉じた状態
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setIsSidebarOpen: (open: boolean) => set({isSidebarOpen: open}),
}));