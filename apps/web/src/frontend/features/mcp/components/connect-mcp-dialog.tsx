import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createMcpKey,
  mcpConnectPrompt,
  mcpKeysQueryOptions,
  mcpUrl,
  type CreatedMcpKey,
} from "@features/mcp/api";

export function ConnectMcpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const url = mcpUrl();

  const copyPrompt = useMutation({
    mutationFn: async (existing: CreatedMcpKey | undefined) => {
      if (existing) return existing;
      const created = await createMcpKey();
      await queryClient.invalidateQueries({
        queryKey: mcpKeysQueryOptions().queryKey,
      });
      return created;
    },
    onSuccess: async (created) => {
      await navigator.clipboard.writeText(mcpConnectPrompt(url, created.key));
      toast.success("Copied");
    },
    onError: () => toast.error("Couldn’t create a key"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) copyPrompt.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect any AI</DialogTitle>
          <DialogDescription>
            Pwor is memory for the model you already use. Cursor, Claude,
            Codex, or anything that speaks MCP. Not another chat in here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-xs">
          <p>
            It can search what you saved, open a save, and put new things in.
            It cannot delete.
          </p>
          <p className="text-muted-foreground">
            Copy the prompt and paste it into Cursor, Claude, or any agent that
            can add an MCP server. It will connect itself.
          </p>
          <div className="flex flex-col gap-1">
            <div className="text-muted-foreground">URL</div>
            <button
              type="button"
              className="min-w-0 break-all text-left hover:underline"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Copied");
              }}
            >
              {url}
            </button>
          </div>
        </div>
        <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
          <Button
            type="button"
            className="font-normal"
            disabled={copyPrompt.isPending}
            onClick={() => copyPrompt.mutate(copyPrompt.data)}
          >
            {copyPrompt.isPending ? "Copying…" : "Copy prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
