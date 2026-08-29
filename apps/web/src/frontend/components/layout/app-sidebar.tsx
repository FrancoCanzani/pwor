import { Link } from "@tanstack/react-router";

import { NavUser } from "@/components/layout/nav-user";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="h-12 flex-row items-center justify-between gap-1 px-2 py-0">
        <div className="flex min-w-0 items-center px-2">
          <Link
            to="/"
            className="text-base leading-none font-normal tracking-tight text-sidebar-foreground no-underline"
          >
            Pwor
          </Link>
        </div>
        <SidebarTrigger className="text-muted-foreground" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
