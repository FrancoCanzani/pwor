import {
  Cross2Icon,
  DotsHorizontalIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notesQueryOptions, updateNoteProject } from "@features/notes/api";
import {
  createTask,
  updateTaskProject,
  updateTaskStatus,
  type Task,
} from "@features/tasks/api";
import { TaskRow } from "@features/tasks/components/task-row";
import {
  updateVaultItemProject,
  vaultItemsQueryOptions,
} from "@features/vault/api";
import {
  createWorkspaceInbox,
  deleteWorkspace,
  deleteWorkspaceInbox,
  updateWorkspace,
  workspaceQueryOptions,
  workspacesQueryOptions,
} from "@features/workspaces/api";

const INBOUND_EMAIL_DOMAIN = "inbound.odiseum.app";

function SectionHeader({
  label,
  count,
  addLabel,
  addDisabled,
  addItems,
  onAdd,
}: {
  label: string;
  count: number;
  addLabel?: string;
  addDisabled?: boolean;
  addItems?: { id: string; label: string }[];
  onAdd?: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-normal text-muted-foreground">
        {label}
        {count > 0 ? (
          <span className="ml-1.5 tabular-nums">{count}</span>
        ) : null}
      </h2>
      {addItems && onAdd ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={addDisabled}
                aria-label={addLabel}
              />
            }
          >
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {addItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="font-normal text-xs"
                onClick={() => onAdd(item.id)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workspace, error } = useQuery(
    workspaceQueryOptions(workspaceId),
  );
  const { data: allNotes = [] } = useQuery(notesQueryOptions());
  const { data: allVaultItems = [] } = useQuery(vaultItemsQueryOptions());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setDescription(workspace.description ?? "");
  }, [workspace?.id]);

  const invalidateWorkspace = () =>
    queryClient.invalidateQueries({
      queryKey: workspaceQueryOptions(workspaceId).queryKey,
    });

  const saveMutation = useMutation({
    mutationFn: (patch: { name?: string; description?: string | null }) =>
      updateWorkspace(workspaceId, patch),
    onSuccess: async () => {
      await invalidateWorkspace();
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryOptions.queryKey,
        exact: true,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspacesQueryOptions.queryKey,
        exact: true,
      });
      await navigate({ to: "/" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (title: string) => createTask(title, null, workspaceId),
    onSuccess: async () => {
      setTaskTitle("");
      await invalidateWorkspace();
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTaskStatus(id, done ? "done" : "open"),
    onSuccess: invalidateWorkspace,
  });

  const unlinkTaskMutation = useMutation({
    mutationFn: (id: string) => updateTaskProject(id, null),
    onSuccess: async () => {
      await invalidateWorkspace();
      await queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    },
  });

  const linkNoteMutation = useMutation({
    mutationFn: (id: string) => updateNoteProject(id, workspaceId),
    onSuccess: async () => {
      await invalidateWorkspace();
      await queryClient.invalidateQueries({
        queryKey: ["notes", "list"],
      });
    },
  });

  const unlinkNoteMutation = useMutation({
    mutationFn: (id: string) => updateNoteProject(id, null),
    onSuccess: async () => {
      await invalidateWorkspace();
      await queryClient.invalidateQueries({
        queryKey: ["notes", "list"],
      });
    },
  });

  const linkVaultItemMutation = useMutation({
    mutationFn: (id: string) => updateVaultItemProject(id, workspaceId),
    onSuccess: async () => {
      await invalidateWorkspace();
      await queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    },
  });

  const unlinkVaultItemMutation = useMutation({
    mutationFn: (id: string) => updateVaultItemProject(id, null),
    onSuccess: async () => {
      await invalidateWorkspace();
      await queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    },
  });

  const createInboxMutation = useMutation({
    mutationFn: () => createWorkspaceInbox(workspaceId),
    onSuccess: invalidateWorkspace,
  });

  const deleteInboxMutation = useMutation({
    mutationFn: (inboxId: string) => deleteWorkspaceInbox(workspaceId, inboxId),
    onSuccess: invalidateWorkspace,
  });

  function handleTaskSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = taskTitle.trim();
    if (!title || createTaskMutation.isPending) return;
    createTaskMutation.mutate(title);
  }

  function copyAddress(address: string) {
    void navigator.clipboard.writeText(address);
    toast.success("Copied");
  }

  if (!workspace) {
    if (error) {
      return <p className="text-xs text-destructive">Workspace not found.</p>;
    }
    return null;
  }

  const unlinkedNotes = allNotes.filter((n) => n.workspaceId === null);
  const unlinkedVaultItems = allVaultItems.filter(
    (v) => v.workspaceId === null,
  );
  const openTasks = workspace.tasks.filter(
    (t: Task) => t.status !== "dismissed",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== workspace.name) {
                saveMutation.mutate({ name: name.trim() });
              }
            }}
            placeholder="Workspace name"
            className="h-auto border-0 px-0 py-0 text-base leading-none font-normal shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <DotsHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (workspace.description ?? "")) {
              saveMutation.mutate({ description: description || null });
            }
          }}
          placeholder="Add a description…"
          rows={1}
          className="min-h-0 resize-none border-0 px-0 py-0 text-xs leading-relaxed text-muted-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
        />
      </div>

      <section className="flex flex-col gap-2">
        <SectionHeader label="Tasks" count={openTasks.length} />
        <form onSubmit={handleTaskSubmit} className="flex items-center gap-2">
          <Input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Add a task…"
            className="h-7 text-xs font-normal"
          />
          <Button
            type="submit"
            size="sm"
            className="h-7 font-normal"
            disabled={!taskTitle.trim() || createTaskMutation.isPending}
          >
            Add
          </Button>
        </form>
        {openTasks.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {openTasks.map((task) => (
              <li key={task.id} className="group flex items-center gap-2">
                <div className="flex-1">
                  <TaskRow
                    task={task}
                    onToggle={(done) =>
                      toggleTaskMutation.mutate({ id: task.id, done })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                  onClick={() => unlinkTaskMutation.mutate(task.id)}
                  aria-label="Remove from workspace"
                >
                  <Cross2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader
          label="Notes"
          count={workspace.notes.length}
          addLabel="Add existing note"
          addDisabled={unlinkedNotes.length === 0}
          addItems={unlinkedNotes.map((n) => ({
            id: n.id,
            label: n.title?.trim() || "Untitled",
          }))}
          onAdd={(id) => linkNoteMutation.mutate(id)}
        />
        {workspace.notes.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {workspace.notes.map((n) => (
              <li
                key={n.id}
                className="group flex items-center justify-between gap-2 py-1.5"
              >
                <Link
                  to="/$workspaceId/notes/$noteId"
                  params={{ workspaceId, noteId: n.id }}
                  className="truncate text-sm"
                >
                  {n.title?.trim() || "Untitled"}
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                  onClick={() => unlinkNoteMutation.mutate(n.id)}
                  aria-label="Remove from workspace"
                >
                  <Cross2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader
          label="Vault"
          count={workspace.vaultItems.length}
          addLabel="Add existing vault item"
          addDisabled={unlinkedVaultItems.length === 0}
          addItems={unlinkedVaultItems.map((v) => ({
            id: v.id,
            label: v.title?.trim() || "Untitled",
          }))}
          onAdd={(id) => linkVaultItemMutation.mutate(id)}
        />
        {workspace.vaultItems.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {workspace.vaultItems.map((v) => (
              <li
                key={v.id}
                className="group flex items-center justify-between gap-2 py-1.5"
              >
                <Link
                  to="/$workspaceId/vault"
                  params={{ workspaceId }}
                  className="truncate text-sm"
                >
                  {v.title?.trim() || "Untitled"}
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                  onClick={() => unlinkVaultItemMutation.mutate(v.id)}
                  aria-label="Remove from workspace"
                >
                  <Cross2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-normal text-muted-foreground">
            Inboxes
            {workspace.inboxes.length > 0 ? (
              <span className="ml-1.5 tabular-nums">
                {workspace.inboxes.length}
              </span>
            ) : null}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Add inbox"
            disabled={createInboxMutation.isPending}
            onClick={() => createInboxMutation.mutate()}
          >
            <PlusIcon />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Forward email to an address below and it lands in this workspace.
        </p>
        {workspace.inboxes.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {workspace.inboxes.map((inbox) => {
              const address = `${inbox.token}@${INBOUND_EMAIL_DOMAIN}`;
              return (
                <li
                  key={inbox.id}
                  className="group flex items-center justify-between gap-2 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => copyAddress(address)}
                    className="truncate text-left font-mono text-xs"
                  >
                    {address}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                    onClick={() => deleteInboxMutation.mutate(inbox.id)}
                    aria-label="Remove inbox"
                  >
                    <Cross2Icon />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent size="sm" className="gap-3 p-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-normal">
              Delete workspace?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              “{workspace.name}” will be deleted. Linked tasks, notes, and
              vault items are kept, just unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-3 -mb-3 p-3">
            <AlertDialogCancel size="sm" className="font-normal">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              variant="destructive"
              className="font-normal"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
