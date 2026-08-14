import type { ReactNode } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function PageHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-base font-normal tracking-tight">{title}</h1>
        </div>
        {meta ? (
          <div className="shrink-0 text-[11px] font-normal text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
