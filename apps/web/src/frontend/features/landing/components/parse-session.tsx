"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  EASE,
  Frame,
  useDelayed,
  useEntered,
  useInView,
  usePrefersReducedMotion,
} from "@features/landing/components/process-motion";
import { STORY } from "@features/landing/components/process-story";

export function ParseSession() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView();
  const entered = useEntered(inView);
  const ready = useDelayed(entered && !reduced, 1400, reduced);

  return (
    <Frame>
      <div
        ref={ref}
        className="grid grid-cols-2 gap-px bg-border"
        aria-live="polite"
      >
        <Pane label="Saved" active={entered}>
          <p className="truncate text-[11px] text-muted-foreground">
            {STORY.url}
          </p>
          <p className="text-[11px] text-muted-foreground motion-safe:animate-pulse">
            Extracting content…
          </p>
          <PageShot filled={false} />
        </Pane>
        <Pane label="Ready" active={ready}>
          <p className="truncate text-[13px]">
            <span className="text-blue-600">{STORY.siteName}</span>
          </p>
          <p className="truncate text-[13px]">{STORY.title}</p>
          <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
            {STORY.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </p>
          <PageShot filled />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {STORY.summary}
          </p>
        </Pane>
      </div>
    </Frame>
  );
}

function Pane({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-background px-3 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div
        className={cn(
          "flex flex-col gap-2 transition-[opacity,transform] duration-500",
          EASE,
          active ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function PageShot({ filled }: { filled: boolean }) {
  if (!filled) {
    return (
      <div className="flex flex-col gap-2 overflow-hidden rounded-md border border-border p-2">
        <Skeleton className="h-10 w-full rounded-sm motion-reduce:animate-none" />
        <Skeleton className="h-1.5 w-16 motion-reduce:animate-none" />
        <Skeleton className="h-1.5 w-24 motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-md border border-border p-2">
      <div className="h-10 rounded-sm bg-foreground/10" />
      <span className="h-1.5 w-16 bg-foreground/25" />
      <span className="h-1.5 w-24 bg-foreground/10" />
    </div>
  );
}
