import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createMcpKey,
  mcpCursorConfig,
  mcpKeysQueryOptions,
  mcpUrl,
  revokeMcpKey,
} from "@features/mcp/api";

function formatLinkedDate(value: string): string {
  const date = new Date(value);
  if (!isValid(date)) return "";
  return format(date, "MMM d, yyyy");
}

export function McpSettings() {
  const queryClient = useQueryClient();
  const keys = useQuery(mcpKeysQueryOptions());
  const url = mcpUrl();

  const create = useMutation({
    mutationFn: () => createMcpKey(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: mcpKeysQueryOptions().queryKey,
      });
    },
    onError: () => toast.error("Couldn’t create a key"),
  });

  const revoke = useMutation({
    mutationFn: revokeMcpKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: mcpKeysQueryOptions().queryKey,
      });
    },
    onError: () => toast.error("Couldn’t revoke key"),
  });

  const created = create.data;

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-[13px] font-normal tracking-tight">AI</h2>
      <p className="text-xs text-muted-foreground">
        Give this to Cursor or Claude. It can search, open, and save. It cannot
        delete anything.
      </p>
      <div className="flex flex-col gap-1 text-xs">
        <div className="text-muted-foreground">URL</div>
        <button
          type="button"
          className="min-w-0 truncate text-left hover:underline"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success("Copied");
          }}
        >
          {url}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="font-normal"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Creating…" : "Create key"}
        </Button>
      </div>
      {created ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Copy this now. You won’t see the full key again.
          </p>
          <button
            type="button"
            className="min-w-0 truncate text-left font-nums text-xs hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(created.key);
              toast.success("Copied");
            }}
          >
            {created.key}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="font-normal"
            onClick={() => {
              void navigator.clipboard.writeText(
                mcpCursorConfig(url, created.key),
              );
              toast.success("Copied Cursor config");
            }}
          >
            Copy Cursor config
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-1">
        {(keys.data ?? []).map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs last:border-b-0"
          >
            <div className="min-w-0">
              <div className="truncate">{key.name}</div>
              <div className="font-nums text-muted-foreground">
                {key.start ? `${key.start}… · ` : null}
                Created {formatLinkedDate(key.createdAt)}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(key.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
