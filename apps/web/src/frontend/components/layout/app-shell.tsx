import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/layout/providers";
import { SidebarInset } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isSettings = pathname.split("/").filter(Boolean)[0] === "settings";

  return (
    <Providers>
      <AppSidebar />

      <SidebarInset className="min-h-0 overflow-hidden md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-border">
        {isSettings ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
              {children}
            </div>
          </div>
        ) : (
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {children}
          </div>
        )}
      </SidebarInset>
    </Providers>
  );
}
