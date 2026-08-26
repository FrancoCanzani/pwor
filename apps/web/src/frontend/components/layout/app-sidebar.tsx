import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";

import { CaptureHint } from "@/components/layout/capture-hint";
import { NavUser } from "@/components/layout/nav-user";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CaptureButton } from "@features/command/components/capture-button";
import { useCommandPalette } from "@features/command/command-palette-context";

export function AppSidebar() {
  const { open: openPalette } = useCommandPalette();

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="h-12 flex-row items-center justify-between gap-1 px-4 py-0">
        <div className="flex min-w-0 items-center gap-1">
          <Link
            to="/"
            className="text-base leading-none font-normal tracking-tight text-sidebar-foreground no-underline"
          >
            Pwor
          </Link>
          <SidebarTrigger className="text-muted-foreground" />
        </div>
        <div className="flex items-center">
          <CaptureButton />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Search"
                  className="text-muted-foreground"
                  onClick={() => openPalette()}
                />
              }
            >
              <MagnifyingGlassIcon />
            </TooltipTrigger>
            <TooltipContent>
              Search
              <Kbd>⌘K</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
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
