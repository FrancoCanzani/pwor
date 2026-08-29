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
  // First row lines up with the sidebar Inbox button (capture group + group padding).
  return (
    <div className={cn("pt-13 md:pt-11", constrain && "mx-auto w-full max-w-4xl")}>
      {children}
    </div>
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
    <div
      className={cn(
        "sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 bg-background/70 backdrop-blur-xl",
        pad,
      )}
    >
      <LayoutSidebarTrigger />
      <div className="min-w-0 max-w-[10rem] sm:max-w-[14rem]">{leading}</div>
      {toolbar ? (
        <div className="ml-auto flex min-w-0 items-center gap-2">{toolbar}</div>
      ) : null}
      {trailing ? (
        <div className={cn("flex shrink-0 items-center", !toolbar && "ml-auto")}>
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
