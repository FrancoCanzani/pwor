import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageEmpty } from "@components/page-empty";
import { PageHeader } from "@components/page-header";
import {
  retryVaultItem,
  vaultItemsQueryOptions,
  type VaultItem,
} from "@features/vault/api";

function fileKindLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

function VaultRow({ item }: { item: VaultItem }) {
  const queryClient = useQueryClient();
  const isText = item.mimeType.startsWith("text/");

  const retry = useMutation({
    mutationFn: () => retryVaultItem(item.id),
    onSuccess: () => {
      toast.success(`Retrying ${item.title ?? "item"}…`);
      queryClient.invalidateQueries({
        queryKey: vaultItemsQueryOptions.queryKey,
      });
    },
    onError: () => toast.error("Retry failed"),
  });

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm">{item.title ?? "Untitled"}</span>
          <span className="text-xs text-muted-foreground">
            {fileKindLabel(item.mimeType)}
            {item.type ? ` · ${item.type}` : ""}
          </span>
        </div>
        {item.status === "failed" && item.error && !isText ? (
          <span className="text-xs text-destructive">{item.error}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">
          {item.status}
        </span>
        {item.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            className="font-normal"
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function VaultPage() {
  const { data: items = [], isLoading } = useQuery(vaultItemsQueryOptions);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Vault"
        description="Passports, IDs, contracts, and other documents. Drop a file anywhere to add one."
      />

      {isLoading ? null : items.length === 0 ? (
        <PageEmpty
          title="Nothing in the vault yet"
          description="Drop a file anywhere on the app to add it."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-dashed divide-border">
          {items.map((item) => (
            <VaultRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
