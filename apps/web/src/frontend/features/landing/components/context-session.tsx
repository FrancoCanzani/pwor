"use client";

import { cn } from "@/lib/utils";
import {
  Frame,
  Swap,
  useDelayed,
  useEntered,
  useInView,
  usePrefersReducedMotion,
} from "@features/landing/components/process-motion";
import { STORY } from "@features/landing/components/process-story";

export function ContextSession() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView();
  const entered = useEntered(inView);
  const showMd = useDelayed(entered && !reduced, 1600, reduced);

  return (
    <Frame>
      <div ref={ref}>
        <Swap
          showAfter={showMd}
          before={<SitePage visible={entered || reduced} />}
          after={<MarkdownPage />}
        />
      </div>
    </Frame>
  );
}

function SitePage({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-4 transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{STORY.host}</p>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-muted-foreground">{STORY.siteKicker}</p>
        <p className="text-[15px] leading-snug">{STORY.title}</p>
        <p className="font-nums text-[11px] text-muted-foreground">
          {STORY.siteWhen}
        </p>
      </div>
      <div className="h-16 rounded-sm bg-foreground/10" />
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
        <p>{STORY.siteLead}</p>
        <p className="text-muted-foreground">{STORY.siteBody}</p>
      </div>
    </div>
  );
}

function MarkdownPage() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <p className="font-nums text-[11px] text-muted-foreground">
        {STORY.mdName}
      </p>
      <p className="text-[15px] leading-snug">
        <span className="text-muted-foreground"># </span>
        {STORY.title}
      </p>
      <p className="text-[13px] leading-relaxed">{STORY.mdLead}</p>
      <div className="flex flex-col gap-0.5 text-[13px] leading-relaxed">
        {STORY.mdList.map((line) => (
          <p key={line}>
            <span className="text-muted-foreground">- </span>
            {line}
          </p>
        ))}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {STORY.mdClose}
      </p>
    </div>
  );
}
