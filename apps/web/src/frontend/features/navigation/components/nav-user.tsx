import { Link } from "@tanstack/react-router";
import { ChevronsUpDownIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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

export function NavUser({ user }: { user: ShellUser }) {
  const { isMobile } = useSidebar();
  const label = user.name.trim() || user.email;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="font-normal data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <UserAvatar
                name={user.name}
                email={user.email}
                image={user.image}
                size="sm"
              />
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="truncate font-normal">{label}</span>
                <span className="truncate text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-48 rounded-none"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1.5 py-1.5 text-left text-xs">
                <UserAvatar
                  name={user.name}
                  email={user.email}
                  image={user.image}
                  size="sm"
                />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-normal">{label}</span>
                  <span className="truncate text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="font-normal text-xs">
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="font-normal text-xs"
                onClick={() => void authClient.signOut()}
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
