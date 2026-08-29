"use client";

import { useEffect, useState } from "react";
import { CheckCircledIcon } from "@radix-ui/react-icons";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import {
  EASE,
  Frame,
  Swap,
  useDelayed,
  useEntered,
  useInView,
  usePrefersReducedMotion,
} from "@features/landing/components/process-motion";
import { STORY } from "@features/landing/components/process-story";

export function CaptureSession() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView();
  const entered = useEntered(inView);
  const typed = useTyped(STORY.url, entered, reduced);
  const host = typed.includes(STORY.host);
  const done = typed === STORY.url;
  const pressed = useDelayed(done, 320, reduced);
  const saved = useDelayed(pressed, 480, reduced);

  return (
    <Frame>
      <div ref={ref} className="p-4">
        <Swap
          showAfter={saved}
          before={
            <div
              className={cn(
                "flex flex-col overflow-hidden rounded-xl bg-popover ring-1 ring-foreground/10 transition-[opacity,transform] duration-500",
                EASE,
                entered || reduced
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0",
              )}
            >
              <div className="flex min-h-20 flex-col">
                <p
                  className={cn(
                    "px-3 pt-3 text-[13px] transition-opacity duration-500",
                    EASE,
                    host ? "opacity-100" : "opacity-0",
                  )}
                >
                  {STORY.host}
                </p>
                <p className="px-3 pt-1 pb-3 text-xs text-muted-foreground">
                  {typed}
                  <span
                    aria-hidden
                    className={cn(
                      "ml-px inline-block h-3 w-px translate-y-px bg-foreground",
                      done || reduced
                        ? "opacity-0"
                        : "motion-safe:animate-[pulse_1s_ease-in-out_infinite]",
                    )}
                  />
                </p>
              </div>
              <div className="flex items-center gap-2 border-t bg-muted/50 px-3 py-1.5">
                <span className="text-[11px]">Inbox</span>
                <span className="flex-1" />
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-[background-color,color,transform] duration-150",
                    EASE,
                    pressed && "translate-y-px bg-foreground text-background",
                  )}
                >
                  Capture
                  <Kbd>⌘↩</Kbd>
                </span>
              </div>
            </div>
          }
          after={
            <div className="flex h-full min-h-[7.5rem] items-center justify-center">
              <p className="flex items-center gap-1.5 text-xs">
                <CheckCircledIcon className="size-3.5" />
                Saved to Inbox
              </p>
            </div>
          }
        />
      </div>
    </Frame>
  );
}

function useTyped(text: string, started: boolean, reduced: boolean) {
  const [count, setCount] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) {
      setCount(text.length);
      return;
    }
    if (!started) return;

    setCount(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= text.length) window.clearInterval(id);
    }, 14);

    return () => window.clearInterval(id);
  }, [reduced, started, text]);

  return text.slice(0, count);
}
