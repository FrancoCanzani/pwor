import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  NavUser,
  type ShellUser,
} from "@features/navigation/components/nav-user";

const navItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/tasks", label: "Tasks", exact: false },
  { to: "/notes", label: "Notes", exact: false },
  { to: "/vault", label: "Vault", exact: false },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isNotes = pathname === "/notes" || pathname.startsWith("/notes/");

  return (
    <TooltipProvider>
      <SidebarProvider
        className={cn(isNotes && "h-svh min-h-0 overflow-hidden")}
      >
        <Sidebar collapsible="icon">
          <SidebarHeader className="h-12 flex-row items-center gap-0 p-0 px-3">
            <Link
              to="/"
              className="font-pixel text-base leading-none font-normal tracking-tight text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden"
            >
              Odiseum
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {navItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.to
                      : pathname === item.to ||
                        pathname.startsWith(`${item.to}/`);

                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          render={<Link to={item.to} />}
                          isActive={isActive}
                          tooltip={item.label}
                          size="sm"
                          className="font-normal"
                        >
                          {item.label}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <NavUser user={user} />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset
          className={cn(isNotes && "h-full min-h-0 overflow-hidden")}
        >
          <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1 md:hidden">
            <SidebarTrigger />
            <span className="font-pixel text-base leading-none tracking-tight">
              Odiseum
            </span>
          </div>
          {isNotes ? (
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
              {children}
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
