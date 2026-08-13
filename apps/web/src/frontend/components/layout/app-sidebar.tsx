import { Link } from "@tanstack/react-router";

import { CaptureHint } from "@/components/layout/capture-hint";
import { NavUser } from "@/components/layout/nav-user";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 flex-row items-center gap-0 px-4 py-0">
        <Link
          to="/"
          className="font-pixel text-base leading-none font-normal tracking-tight text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden"
        >
          Pwor
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <CaptureHint />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
