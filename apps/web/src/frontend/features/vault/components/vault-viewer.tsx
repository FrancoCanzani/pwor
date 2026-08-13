import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { VaultItem } from "@features/vault/api";
import { VaultItemPreview } from "@features/vault/components/vault-item-preview";
import { isSheetPreviewable } from "@features/vault/lib/sheet";

export function VaultViewer({
  item,
  open,
  onOpenChange,
}: {
  item: VaultItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isLinkLike = item.kind === "link";
  const isSheet =
    item.kind === "file" && isSheetPreviewable(item.mimeType, item.title);
  const isSnippet = item.kind === "snippet";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isSnippet}
        className={cn(
          "max-w-[calc(100%-2rem)] overflow-hidden",
          isSheet || isLinkLike ? "gap-2 p-2 sm:max-w-5xl" : "sm:max-w-3xl",
        )}
      >
        <DialogTitle className="sr-only">
          {item.title?.trim() || "Preview"}
        </DialogTitle>
        <VaultItemPreview
          item={item}
          active={open}
          variant="dialog"
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
