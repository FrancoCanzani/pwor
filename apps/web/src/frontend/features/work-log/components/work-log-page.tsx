import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type SubmitEvent } from "react";

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
import { UserAvatar } from "@/components/user-avatar";
import { PageEmpty } from "@components/page-empty";
import { PageHeader } from "@components/page-header";
import {
  createWorkLog,
  deleteWorkLog,
  draftWorkLog,
  updateWorkLog,
  workLogsQueryOptions,
  type WorkLogListItem,
} from "@features/work-log/api";
import {
  formatDay,
  formatTime,
  isToday,
  localToday,
} from "@features/work-log/lib/day";

function FeedPost({
  item,
  onEdit,
  onDelete,
}: {
  item: WorkLogListItem;
  onEdit: (item: WorkLogListItem) => void;
  onDelete: (item: WorkLogListItem) => void;
}) {
  return (
    <li className="py-6">
      <div className="flex items-start gap-2.5">
        <UserAvatar
          name={item.author.name}
          email={item.author.email}
          image={item.author.image}
          size="xs"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm">
              {item.author.name.trim() || item.author.email}
            </span>
            <span className="text-[11px] font-nums text-muted-foreground">
              {isToday(item.day) ? "today" : formatDay(item.day)}
              {" · "}
              {formatTime(item.createdAt)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">
            {item.body.trim() || "Empty post"}
          </p>
          <div className="mt-3 flex items-center gap-1">
            <Button
              variant="ghost"

              className="h-7 px-2 font-normal"
              onClick={() => onEdit(item)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"

              className="h-7 px-2 font-normal text-destructive hover:text-destructive"
              onClick={() => onDelete(item)}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function WorkLogPage() {
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkLogListItem | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery(workLogsQueryOptions);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: workLogsQueryOptions.queryKey,
    });

  function clearComposer() {
    setBody("");
    setEditingId(null);
  }

  function startEdit(item: WorkLogListItem) {
    setEditingId(item.id);
    setBody(item.body);
    textareaRef.current?.focus();
  }

  const create = useMutation({
    mutationFn: () => createWorkLog(body.trim(), localToday()),
    onSuccess: async () => {
      clearComposer();
      await invalidate();
    },
  });

  const update = useMutation({
    mutationFn: (id: string) => updateWorkLog(id, { body: body.trim() }),
    onSuccess: async () => {
      clearComposer();
      await invalidate();
    },
  });

  const draft = useMutation({
    mutationFn: () => draftWorkLog(localToday()),
    onSuccess: async (entry) => {
      setEditingId(entry.id);
      setBody(entry.body);
      await invalidate();
      textareaRef.current?.focus();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkLog(id),
    onSuccess: async (_, id) => {
      if (editingId === id) clearComposer();
      setPendingDelete(null);
      await invalidate();
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    if (editingId) {
      update.mutate(editingId);
      return;
    }
    create.mutate();
  }

  const busy =
    create.isPending || update.isPending || draft.isPending || remove.isPending;
  const editing = editingId !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <PageHeader
          title="Updates"
          description="About the project."
        />

        {items.length === 0 ? (
          <PageEmpty
            title="No posts yet"
            description="Write an update, or draft one from what you closed and wrote today."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {items.map((item) => (
              <FeedPost
                key={item.id}
                item={item}
                onEdit={startEdit}
                onDelete={setPendingDelete}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 bg-background pt-4 pb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {editing ? (
            <p className="text-[11px] text-muted-foreground">Editing post</p>
          ) : null}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What did you do today…"
            rows={3}
            className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-xs font-normal outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-end gap-2">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={clearComposer}
                disabled={busy}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => draft.mutate()}
                disabled={busy}
              >
                {draft.isPending ? "Drafting…" : "Draft today"}
              </Button>
            )}
            <Button
              type="submit"
              disabled={!body.trim() || busy}
            >
              {editing
                ? update.isPending
                  ? "Saving…"
                  : "Save"
                : create.isPending
                  ? "Posting…"
                  : "Post"}
            </Button>
          </div>
        </form>

        {create.isError || update.isError || draft.isError ? (
          <p className="mt-2 text-xs text-destructive">Could not save post.</p>
        ) : null}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete post?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This post will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending || !pendingDelete}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) remove.mutate(pendingDelete.id);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
