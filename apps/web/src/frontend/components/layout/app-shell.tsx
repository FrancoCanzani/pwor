import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Providers } from "@/components/layout/providers";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
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
        <div className="flex h-12 shrink-0 items-center gap-2 px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-pixel text-base leading-none tracking-tight">
            Pwor
          </span>
        </div>
        {isFlush ? (
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
            {children}
          </div>
        )}
      </SidebarInset>
    </Providers>
  );
}
