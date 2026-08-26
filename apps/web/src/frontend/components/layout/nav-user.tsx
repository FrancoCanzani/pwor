import { CaretSortIcon } from "@radix-ui/react-icons";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const label = user.name.trim() || user.email;

  useEffect(() => {
    setMounted(true);
  }, []);

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
              {mounted ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="font-normal text-xs">
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={theme ?? "system"}
                        onValueChange={(value) => {
                          if (typeof value === "string") setTheme(value);
                        }}
                      >
                        <DropdownMenuRadioItem
                          value="system"
                          className="font-normal text-xs"
                        >
                          System
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem
                          value="light"
                          className="font-normal text-xs"
                        >
                          Light
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem
                          value="dark"
                          className="font-normal text-xs"
                        >
                          Dark
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ) : null}
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
