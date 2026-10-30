// components/Providers.tsx
"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: ReactNode }) {
  // In the admin, the bottom-right corner holds the sticky "Хадгалах" bars and
  // row actions; a toast parked there blocked the next click for seconds.
  const isAdmin = /^\/[a-z]{2}\/admin(\/|$)/.test(usePathname() ?? "");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
      <Toaster
        richColors
        position={isAdmin ? "top-center" : "bottom-right"}
        closeButton={isAdmin}
        toastOptions={{ closeButtonAriaLabel: "Хаах" }}
      />
    </ThemeProvider>
  );
}
