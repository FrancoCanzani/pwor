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
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 flex-row items-center justify-between gap-1 px-4 py-0 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
        <Link
          to="/"
          className="text-base leading-none font-normal tracking-tight text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden"
        >
          Pwor
        </Link>
        <div className="flex items-center group-data-[collapsible=icon]:flex-col">
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
