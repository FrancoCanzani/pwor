import { CaretSortIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
import { FeedbackDialog } from "@features/feedback/components/feedback-dialog";
import { userInboxQueryOptions } from "@features/inbox/api";
import { ConnectMcpDialog } from "@features/mcp/components/connect-mcp-dialog";
import { authClient } from "@lib/auth-client";
import { clearSession } from "@lib/session";

export type ShellUser = {
  name: string;
  email: string;
  image: string | null;
};

const routeApi = getRouteApi("/_app");

export function NavUser() {
  const { user } = routeApi.useRouteContext();
  const { isMobile } = useSidebar();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inbox = useQuery(userInboxQueryOptions());
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const label = user.name.trim() || user.email;
  const address = inbox.data?.address;

  return (
    <>
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
                {address ? (
                  <span className="truncate text-muted-foreground">
                    {address}
                  </span>
                ) : null}
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
                <DropdownMenuItem
                  className="font-normal text-xs"
                  onClick={() => setMcpOpen(true)}
                >
                  Connect AI
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="font-normal text-xs"
                  onClick={() => setFeedbackOpen(true)}
                >
                  Feedback
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                  onClick={() => {
                    void (async () => {
                      const { error } = await authClient.signOut();
                      if (error) return;
                      await clearSession(queryClient);
                      await navigate({ to: "/" });
                    })();
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <ConnectMcpDialog open={mcpOpen} onOpenChange={setMcpOpen} />
    </>
  );
}
