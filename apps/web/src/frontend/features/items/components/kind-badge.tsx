import { Badge } from "@/components/ui/badge";
import type { Item } from "@features/items/api";
import { kindLabel } from "@features/items/lib/list";

export function KindBadge({ item }: { item: Item }) {
  return (
    <Badge
      variant="outline"
      className="h-4 rounded-sm px-1 text-[10px] leading-none font-normal capitalize text-muted-foreground"
    >
      {kindLabel(item)}
    </Badge>
  );
}
