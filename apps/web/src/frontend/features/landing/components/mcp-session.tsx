"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  EASE,
  useEntered,
  useInView,
  usePrefersReducedMotion,
} from "@features/landing/components/process-motion";

const ASK = "when did apollo 11 launch?";

export function McpSession() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView();
  const entered = useEntered(inView);
  const show = entered || reduced;

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]"
    >
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="flex flex-col gap-3 px-3 pb-3 font-mono text-[12px] leading-relaxed text-[#c0caf5]">
        <Line on={show} delay={0}>
          <p>
            <span className="text-[#565f89]">› </span>
            {ASK}
          </p>
        </Line>
        <Line on={show} delay={120}>
          <p className="text-[#8b8fa3]">
            search <span className="text-[#7dcfff]">apollo 11</span>
            <span className="text-[#565f89]"> · 1</span>
          </p>
        </Line>
        <Line on={show} delay={200}>
          <p className="text-[#8b8fa3]">
            get_item <span className="text-[#7dcfff]">Apollo 11</span>
          </p>
        </Line>
        <Line on={show} delay={320}>
          <p>16 July 1969</p>
        </Line>
      </div>
    </div>
  );
}

function Line({
  on,
  delay,
  children,
}: {
  on: boolean;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-500",
        EASE,
        on ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
      )}
      style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
