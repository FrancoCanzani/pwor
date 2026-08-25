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
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2",
        edgeToEdge ? "px-3" : "px-4",
      )}
    >
      <SidebarTrigger className="size-4 shrink-0 p-0 md:hidden [&_svg]:size-3" />
      <div className="flex min-w-0 flex-1 items-center gap-2">{leading}</div>
      {toolbar ? (
        <div className="flex min-w-0 shrink items-center justify-end gap-2">
          {toolbar}
        </div>
      ) : null}
      {trailing ? (
        <div className="flex shrink-0 items-center">{trailing}</div>
      ) : null}
    </div>
  );
}
