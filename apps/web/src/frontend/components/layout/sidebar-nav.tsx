import { CaretRightIcon, PlusIcon } from "@radix-ui/react-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useCaptureComposer } from "@features/command/capture-composer-context";
import { useCommandPalette } from "@features/command/command-palette-context";
import {
  inboxItemsInfiniteQueryOptions,
  itemsMoveKey,
  updateItems,
} from "@features/items/api";
import { usePworItemDrop } from "@features/items/lib/drag";
import { notesMoveKey, updateNotes } from "@features/notes/api";
import { spacesQueryOptions, type Space } from "@features/spaces/api";
import { CreateSpaceDialog } from "@features/spaces/components/create-space-dialog";
import { setStoredSpaceId } from "@features/spaces/lib/current-space";

function NavSection({
  name,
  addLabel,
  onAdd,
  children,
}: {
  name: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen className="group/section">
      <SidebarGroup className="pt-1">
        <div className="group/header flex h-8 items-center rounded-md px-2 hover:bg-sidebar-accent">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-normal text-muted-foreground hover:text-foreground">
            <span className="truncate">{name}</span>
            <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform in-data-open:rotate-90" />
          </CollapsibleTrigger>
          <button
            type="button"
            aria-label={addLabel}
            className="flex opacity-0 text-muted-foreground group-hover/header:opacity-100 group-focus-within/header:opacity-100 hover:text-foreground [&>svg]:size-3"
            onClick={onAdd}
          >
            <PlusIcon />
          </button>
        </div>
        <CollapsibleContent>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function invalidateMoved(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["item", "items"] }),
    queryClient.invalidateQueries({ queryKey: ["notes"] }),
    queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  ]);
}

function movedToast(count: number, destination: string) {
  toast.success(
    count > 1 ? `Moved ${count} to ${destination}` : `Moved to ${destination}`,
  );
}

export function SidebarNav() {
  const { open: openCapture } = useCaptureComposer();
  const { open: openSearch } = useCommandPalette();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: spaces = [] } = useQuery(spacesQueryOptions);
  const { data: inboxList } = useInfiniteQuery(
    inboxItemsInfiniteQueryOptions(),
  );
  const inboxCount = inboxList?.pages[0]?.total ?? 0;

  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { spaceId: routeSpaceId } = useParams({
    strict: false,
  });
  const isInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");
  const isNotes = pathname === "/notes" || pathname.startsWith("/notes/");

  async function handleCreated(space: { id: string }) {
    setStoredSpaceId(space.id);
    setCreateSpaceOpen(false);
    await queryClient.invalidateQueries({
      queryKey: spacesQueryOptions.queryKey,
      exact: true,
    });
    await navigate({
      to: "/spaces/$spaceId",
      params: { spaceId: space.id },
      search: { item: undefined },
    });
  }

  return (
    <>
      <SidebarGroup>
        <ButtonGroup className="w-full" aria-label="Capture and search">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => openCapture()}
          >
            Capture
            <Kbd>⌘U</Kbd>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => openSearch()}
          >
            Search
            <Kbd>⌘K</Kbd>
          </Button>
        </ButtonGroup>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <InboxRow inboxCount={inboxCount} isActive={isInbox} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <NotesRow isActive={isNotes} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <NavSection
        name="Spaces"
        addLabel="New space"
        onAdd={() => setCreateSpaceOpen(true)}
      >
        <SidebarMenu className="max-h-72 gap-0.5 overflow-y-auto">
          {spaces.map((space) => (
            <SpaceRow
              key={space.id}
              space={space}
              isActive={space.id === routeSpaceId}
            />
          ))}
        </SidebarMenu>
      </NavSection>

      <CreateSpaceDialog
        open={createSpaceOpen}
        onOpenChange={setCreateSpaceOpen}
        onCreated={handleCreated}
      />
    </>
  );
}

function InboxRow({
  inboxCount,
  isActive,
}: {
  inboxCount: number;
  isActive: boolean;
}) {
  const queryClient = useQueryClient();

  const moveItems = useMutation({
    mutationKey: itemsMoveKey,
    mutationFn: (vars: { ids: string[]; spaceId: string | null }) =>
      updateItems(vars.ids, { spaceId: vars.spaceId }),
    onSuccess: (_result, vars) => movedToast(vars.ids.length, "Inbox"),
    onError: () => toast.error("Couldn’t move item"),
    onSettled: () => invalidateMoved(queryClient),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.kind === "item" && item.fromSpaceId !== null,
    onDrop: (item) => moveItems.mutate({ ids: item.ids, spaceId: null }),
  });

  return (
    <SidebarMenuItem
      {...dropProps}
      className={cn("rounded-md", isOver && "bg-sidebar-accent")}
    >
      <SidebarMenuButton
        isActive={isActive}
        render={<Link to="/inbox" />}
        className="font-normal"
      >
        <span className="min-w-0 truncate">Inbox</span>
        {inboxCount > 0 ? (
          <span className="ml-auto flex size-6 shrink-0 items-center justify-end font-nums text-xs text-muted-foreground">
            {inboxCount}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NotesRow({ isActive }: { isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={<Link to="/notes" />}
        className="font-normal"
      >
        <span className="min-w-0 truncate">Notes</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SpaceRow({ space, isActive }: { space: Space; isActive: boolean }) {
  const queryClient = useQueryClient();
  const label = space.name.trim() || "Untitled";

  const moveItems = useMutation({
    mutationKey: itemsMoveKey,
    mutationFn: (vars: { ids: string[]; spaceId: string | null }) =>
      updateItems(vars.ids, { spaceId: vars.spaceId }),
    onSuccess: (_result, vars) => movedToast(vars.ids.length, label),
    onError: () => toast.error("Couldn’t move item"),
    onSettled: () => invalidateMoved(queryClient),
  });

  const moveNotes = useMutation({
    mutationKey: notesMoveKey,
    mutationFn: (vars: { ids: string[]; spaceId: string | null }) =>
      updateNotes(vars.ids, { spaceId: vars.spaceId }),
    onSuccess: (_result, vars) => movedToast(vars.ids.length, label),
    onError: () => toast.error("Couldn’t move item"),
    onSettled: () => invalidateMoved(queryClient),
  });

  const { isOver, dropProps } = usePworItemDrop({
    canDrop: (item) => item.fromSpaceId !== space.id,
    onDrop: (item) => {
      const vars = { ids: item.ids, spaceId: space.id };
      switch (item.kind) {
        case "item":
          moveItems.mutate(vars);
          return;
        case "note":
          moveNotes.mutate(vars);
          return;
        default: {
          const _exhaustive: never = item.kind;
          return _exhaustive;
        }
      }
    },
  });

  return (
    <SidebarMenuItem
      {...dropProps}
      className={cn(isOver && "bg-sidebar-accent")}
    >
      <SidebarMenuButton
        isActive={isActive}
        className="font-normal"
        tooltip={label}
        render={
          <Link
            to="/spaces/$spaceId"
            params={{ spaceId: space.id }}
            search={{ item: undefined }}
          />
        }
      >
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
