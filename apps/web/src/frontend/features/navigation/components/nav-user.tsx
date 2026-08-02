import { CaretSortIcon, CheckIcon, PlusIcon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
import { cue } from "@lib/sound";
import { workspacesQueryOptions, type Workspace } from "@features/workspaces/api";
import { CreateWorkspaceDialog } from "@features/workspaces/components/create-workspace-dialog";
import { setStoredWorkspaceId } from "@features/workspaces/lib/current-workspace";
import { useCurrentWorkspace } from "@features/workspaces/lib/use-current-workspace";

export type ShellUser = {
  name: string;
  email: string;
  image: string | null;
};

export function NavUser({ user }: { user: ShellUser }) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const label = user.name.trim() || user.email;
  const [createOpen, setCreateOpen] = useState(false);

  const { data: workspaces = [] } = useQuery(workspacesQueryOptions);
  const { id: currentId, name: currentName } = useCurrentWorkspace();
  const workspaceLabel = currentName || "Untitled";

  const selectWorkspace = (id: string) => {
    setStoredWorkspaceId(id);
    void navigate({
      to: "/$workspaceId",
      params: { workspaceId: id },
    });
  };

  async function handleWorkspaceCreated(workspace: Workspace) {
    await queryClient.invalidateQueries({
      queryKey: workspacesQueryOptions.queryKey,
      exact: true,
    });
    selectWorkspace(workspace.id);
  }

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
                {workspaceLabel}
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
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  className="font-normal text-xs"
                  onClick={() => selectWorkspace(workspace.id)}
                >
                  {workspace.id === currentId ? (
                    <CheckIcon className="size-3" />
                  ) : null}
                  <span className="truncate">
                    {workspace.name.trim() || "Untitled"}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                className="font-normal text-xs"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon className="size-3" />
                New workspace
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="font-normal text-xs"
                render={<Link to="/settings" />}
              >
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="font-normal text-xs"
                onClick={() => {
                  cue("whisper");
                  void authClient.signOut();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleWorkspaceCreated}
      />
    </SidebarMenu>
  );
}
