import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function PageEmpty({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty
      className={cn(
        "min-h-[60vh] flex-1 justify-center gap-3 border-0 py-16 text-center",
        className,
      )}
    >
      <EmptyHeader className="items-center gap-1.5">
        {title ? (
          <EmptyTitle className="text-sm font-normal tracking-normal">
            {title}
          </EmptyTitle>
        ) : null}
        {description ? (
          <EmptyDescription className="text-xs text-muted-foreground">
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
