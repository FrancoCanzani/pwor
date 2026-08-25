import type { ReactNode } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function LibraryHeader({
  leading,
  trailing,
  toolbar,
}: {
  leading: ReactNode;
  trailing?: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col md:h-12 md:flex-row md:items-center md:gap-2 md:px-4">
      <div className="flex h-12 items-center gap-2 px-4 md:contents">
        <div className="flex min-w-0 flex-1 items-center gap-2">{leading}</div>
        <SidebarTrigger className="md:hidden" />
        {trailing ? (
          <div className="flex shrink-0 items-center md:order-last">
            {trailing}
          </div>
        ) : null}
      </div>
      {toolbar ? (
        <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-4 md:shrink-0 md:px-0 md:py-0">
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}
