import type { ReactNode } from "react";

import { LayoutSidebarTrigger } from "@/components/layout/layout-sidebar-trigger";
import { cn } from "@/lib/utils";

export function ContentColumn({
  constrain = true,
  children,
}: {
  constrain?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(constrain && "mx-auto w-full max-w-4xl")}>{children}</div>
  );
}

export function LibraryHeader({
  leading,
  trailing,
  toolbar,
  edgeToEdge = false,
}: {
  leading: ReactNode;
  trailing?: ReactNode;
  toolbar?: ReactNode;
  edgeToEdge?: boolean;
}) {
  const pad = edgeToEdge ? "px-3" : "px-4";

  return (
    <div className="flex shrink-0 flex-col">
      <div className={cn("flex h-12 items-center gap-2", pad)}>
        <LayoutSidebarTrigger />
        <div className="min-w-0 flex-1">{leading}</div>
        {trailing ? (
          <div className="flex shrink-0 items-center">{trailing}</div>
        ) : null}
      </div>
      {toolbar ? (
        <ContentColumn constrain={!edgeToEdge}>
          <div className={cn("flex items-center gap-2 pt-8 pb-2", pad)}>
            {toolbar}
          </div>
        </ContentColumn>
      ) : null}
    </div>
  );
}
