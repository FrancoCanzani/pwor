import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageEmpty } from "@components/page-empty";
import { PageHeader } from "@components/page-header";
import {
  deleteInboxItem,
  inboxItemsQueryOptions,
  type InboxItem,
} from "@features/inbox/api";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InboxRow({
  item,
  onDelete,
}: {
  item: InboxItem;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="flex flex-col py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-baseline justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm">
            {item.subject?.trim() || "(no subject)"}
          </span>
          <span className="shrink-0 truncate text-xs text-muted-foreground">
            {item.fromAddress}
          </span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatDate(item.createdAt)}
        </span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {item.body || "(empty)"}
          </p>
          <Button
            type="button"
            variant="ghost"

            className="font-normal text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const { data: items = [] } = useQuery(inboxItemsQueryOptions(workspaceId));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInboxItem(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["inbox", "list"],
      }),
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Inbox"
        description="Emails forwarded into your workspaces."
      />
      {items.length === 0 ? (
        <PageEmpty
          title="Nothing yet"
          description="Forward an email to a workspace's inbox address and it'll show up here."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-dashed divide-border">
          {items.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onDelete={() => deleteMutation.mutate(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
