import type { ReactNode } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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
  const inset = edgeToEdge ? "px-3" : "px-4";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col md:h-12 md:flex-row md:items-center md:gap-2",
        edgeToEdge ? "md:px-3" : "md:px-4",
      )}
    >
      <div className={cn("flex h-12 items-center gap-2 md:contents", inset)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">{leading}</div>
        <SidebarTrigger className="md:hidden" />
        {trailing ? (
          <div className="flex shrink-0 items-center md:order-last">
            {trailing}
          </div>
        ) : null}
      </div>
      {toolbar ? (
        <div
          className={cn(
            "flex items-center justify-end gap-2 pt-3 pb-4 md:shrink-0 md:px-0 md:py-0",
            inset,
          )}
        >
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}
