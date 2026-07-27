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
import {
  NavUser,
  type ShellUser,
} from "@features/navigation/components/nav-user";

const navItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/settings", label: "Settings", exact: false },
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

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="gap-3 px-3 py-4">
            <Link
              to="/"
              className="px-1 font-pixel text-[13px] font-normal tracking-tight text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden"
            >
              Odiseum
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.to
                      : pathname === item.to ||
                        pathname.startsWith(`${item.to}/`);

                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          size="sm"
                          className="font-normal"
                        >
                          <Link to={item.to}>{item.label}</Link>
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

        <SidebarInset>
          <div className="flex items-center gap-2 px-4 pt-3 md:hidden">
            <SidebarTrigger />
            <span className="font-pixel text-[13px] tracking-tight">
              Odiseum
            </span>
          </div>
          <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-20">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
