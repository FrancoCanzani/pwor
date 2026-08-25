import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/layout/providers";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const segments = pathname.split("/").filter(Boolean);
  const isSettings = segments[0] === "settings";
  const isFlush = !isSettings;

  return (
    <Providers>
      <AppSidebar />

      <SidebarInset className={cn(isFlush && "h-full min-h-0 overflow-hidden")}>
        {isFlush ? (
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
            {children}
          </div>
        )}
      </SidebarInset>
    </Providers>
  );
}
