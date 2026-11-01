"use client";

import { create } from "zustand";

/**
 * Open state of the trip-advisor chat, shared so the phone's bottom action
 * bar can open the same panel the desktop's floating button does.
 */
export const useAdvisorChat = create<{ open: boolean; setOpen: (open: boolean) => void; toggle: () => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
