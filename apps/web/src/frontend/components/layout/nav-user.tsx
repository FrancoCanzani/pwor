import { CaretSortIcon } from "@radix-ui/react-icons";
import { getRouteApi, Link } from "@tanstack/react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@lib/auth-client";

export type ShellUser = {
  name: string;
  email: string;
  image: string | null;
};

const routeApi = getRouteApi("/_app");

export function NavUser() {
  const { user } = routeApi.useRouteContext();
  const { isMobile } = useSidebar();
  const label = user.name.trim() || user.email;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="font-normal data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate font-normal">{label}</span>
              <span className="truncate text-muted-foreground">
                {user.email}
              </span>
            </div>
            <CaretSortIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-48"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="font-normal text-xs"
                render={<Link to="/settings" />}
              >
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="font-normal text-xs"
                onClick={() => {
                  void authClient.signOut();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
