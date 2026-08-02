import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileIcon, Link2Icon, MagicWandIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  generateTaskFromInbox,
  type InboxItem,
} from "@features/inbox/api";
import { tasksBySourceQueryOptions } from "@features/tasks/api";
import {
  TASK_STATUS_ICON,
  TASK_STATUS_ICON_COLOR,
  TASK_STATUS_LABEL,
} from "@features/tasks/lib/status";
import { vaultItemsByInboxItemQueryOptions } from "@features/vault/api";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InboxItemSheet({
  item,
  onOpenChange,
}: {
  item: InboxItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    ...tasksBySourceQueryOptions("inbox_item", item?.id ?? ""),
    enabled: !!item,
  });

  const documentsQuery = useQuery({
    ...vaultItemsByInboxItemQueryOptions(item?.id ?? ""),
    enabled: !!item,
  });

  const generateTaskMutation = useMutation({
    mutationFn: (id: string) => generateTaskFromInbox(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    },
  });

  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent>
        {item ? (
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader>
              <SheetTitle>{item.subject?.trim() || "(no subject)"}</SheetTitle>
              <SheetDescription>
                {item.fromAddress} · {formatDate(item.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {item.body || "(empty)"}
              </p>

              <div className="mt-6 flex flex-col gap-2 border-t border-border/60 pt-4">
                <h3 className="text-xs font-normal text-muted-foreground">
                  Documents
                </h3>
                {documentsQuery.data?.length ? (
                  <ul className="flex flex-col gap-1">
                    {documentsQuery.data.map((doc) => (
                      <li key={doc.id}>
                        <a
                          href={
                            doc.kind === "file"
                              ? `/api/vault/${doc.id}/file`
                              : (doc.url ?? "#")
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-sm text-foreground hover:underline"
                        >
                          {doc.kind === "link" ? (
                            <Link2Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">
                            {doc.title || "Untitled"}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground/70">
                    No attachments.
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-2 border-t border-border/60 pt-4 pb-4">
                <h3 className="text-xs font-normal text-muted-foreground">
                  Tasks
                </h3>
                {tasksQuery.data?.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {tasksQuery.data.map((task) => {
                      const StatusIcon = TASK_STATUS_ICON[task.status];
                      return (
                        <li
                          key={task.id}
                          className="flex items-center gap-1.5 text-sm"
                        >
                          <StatusIcon
                            className={`size-3.5 shrink-0 ${TASK_STATUS_ICON_COLOR[task.status]}`}
                          />
                          <span className="truncate">{task.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {TASK_STATUS_LABEL[task.status]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground/70">
                    No tasks yet.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit"
                  disabled={generateTaskMutation.isPending}
                  onClick={() => generateTaskMutation.mutate(item.id)}
                >
                  <MagicWandIcon data-icon="inline-start" />
                  {generateTaskMutation.isPending
                    ? "Generating…"
                    : "Generate task"}
                </Button>
                {generateTaskMutation.isError ? (
                  <p className="text-xs text-destructive">
                    Could not generate a task from this email.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
