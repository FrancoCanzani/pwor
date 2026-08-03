import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PageEmpty } from "@components/page-empty";
import { PageHeader } from "@components/page-header";
import {
  deleteInboxItem,
  inboxItemsQueryOptions,
  simulateInboundEmail,
  type InboxItem,
} from "@features/inbox/api";
import { InboxItemSheet } from "@features/inbox/components/inbox-item-sheet";

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
  onOpen,
  onDelete,
}: {
  item: InboxItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 items-baseline gap-2 text-left"
      >
        <span className="truncate text-sm">
          {item.subject?.trim() || "(no subject)"}
        </span>
        <span className="shrink-0 truncate text-xs text-muted-foreground">
          {item.fromAddress}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs font-nums text-muted-foreground">
          {formatDate(item.createdAt)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="font-normal text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const { data: items = [] } = useQuery(inboxItemsQueryOptions(workspaceId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInboxItem(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["inbox", "list"],
      }),
  });

  const simulateMutation = useMutation({
    mutationFn: () => simulateInboundEmail(workspaceId),
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
        meta={
          import.meta.env.DEV ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={simulateMutation.isPending}
              onClick={() => simulateMutation.mutate()}
            >
              {simulateMutation.isPending ? "Simulating…" : "Simulate email"}
            </Button>
          ) : undefined
        }
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
              onOpen={() => setSelectedId(item.id)}
              onDelete={() => deleteMutation.mutate(item.id)}
            />
          ))}
        </ul>
      )}
      <InboxItemSheet
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}
