import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Item } from "@features/items/api";
import { ItemPreview } from "@features/items/components/item-preview";
import { isSheetPreviewable } from "@features/items/lib/sheet";

export function ItemViewer({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isLinkLike = item.kind === "link";
  const isSheet =
    item.kind === "file" && isSheetPreviewable(item.mimeType, item.title);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "max-w-[calc(100%-2rem)] overflow-hidden",
          isSheet || isLinkLike ? "gap-2 p-2 sm:max-w-5xl" : "sm:max-w-3xl",
        )}
      >
        <DialogTitle className="sr-only">
          {item.title?.trim() || "Preview"}
        </DialogTitle>
        <ItemPreview
          item={item}
          active={open}
          variant="dialog"
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
