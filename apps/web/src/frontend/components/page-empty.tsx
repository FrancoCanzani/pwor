import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function PageEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    // `flex-1` centers it in a flex column that has height; the min-height is
    // the fallback for pages that just flow.
    <Empty className="min-h-[60vh] flex-1 justify-center gap-3 border-0 py-16 text-center">
      <EmptyHeader className="items-center gap-1.5">
        <EmptyTitle className="text-sm font-normal tracking-normal">
          {title}
        </EmptyTitle>
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
