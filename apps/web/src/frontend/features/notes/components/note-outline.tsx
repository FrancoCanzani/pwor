import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type OutlineHeading = {
  index: number;
  level: 1 | 2 | 3;
  text: string;
  el: HTMLElement;
};

function headingLevel(tag: string): 1 | 2 | 3 | null {
  switch (tag) {
    case "H1":
      return 1;
    case "H2":
      return 2;
    case "H3":
      return 3;
    default:
      return null;
  }
}

function tickClass(level: 1 | 2 | 3): string {
  switch (level) {
    case 1:
      return "w-8";
    case 2:
      return "w-5";
    case 3:
      return "w-3.5";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

function labelPad(level: 1 | 2 | 3): string {
  switch (level) {
    case 1:
      return "pl-2";
    case 2:
      return "pl-3.5";
    case 3:
      return "pl-5";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

function readHeadings(root: HTMLElement): OutlineHeading[] {
  const editor = root.querySelector<HTMLElement>("[data-note-editor] .tiptap");
  if (!editor) return [];
  const next: OutlineHeading[] = [];
  for (const node of editor.querySelectorAll("h1, h2, h3")) {
    if (!(node instanceof HTMLElement)) continue;
    const level = headingLevel(node.tagName);
    if (!level) continue;
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!text) continue;
    next.push({ index: next.length, level, text, el: node });
  }
  return next;
}

function contentOverflows(scroller: HTMLElement): boolean {
  const editor = scroller.querySelector<HTMLElement>("[data-note-editor] .tiptap");
  const last = editor?.lastElementChild;
  if (!(last instanceof HTMLElement)) return false;
  return (
    last.getBoundingClientRect().bottom >
    scroller.getBoundingClientRect().bottom - 32
  );
}

function scrollToHeading(scroller: HTMLElement, heading: HTMLElement) {
  if (!heading.isConnected) return;
  const offset =
    heading.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop -
    20;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({
    top: Math.max(0, offset),
    behavior: reduce ? "auto" : "smooth",
  });
}

function activeIndexOf(
  scroller: HTMLElement,
  headings: OutlineHeading[],
): number {
  if (headings.length === 0) return 0;
  const probe = scroller.getBoundingClientRect().top + 48;
  let current = 0;
  for (const heading of headings) {
    if (!heading.el.isConnected) continue;
    if (heading.el.getBoundingClientRect().top <= probe) {
      current = heading.index;
    }
  }
  return current;
}

export function NoteOutline({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const closeTimer = useRef<number>(0);

  function cancelClose() {
    window.clearTimeout(closeTimer.current);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setHovered(null);
    }, 120);
  }

  useLayoutEffect(() => {
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  const isMobile = useIsMobile();
  const headingsRef = useRef<OutlineHeading[]>([]);
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [active, setActive] = useState(0);
  const [overflows, setOverflows] = useState(false);

  const sync = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const next = readHeadings(scroller);
    headingsRef.current = next;
    setHeadings(next);
    setOverflows(contentOverflows(scroller));
    setActive(activeIndexOf(scroller, next));
  }, [scrollRef]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || isMobile) return;
    sync();
    const onScroll = () => {
      const latest = scrollRef.current;
      if (!latest) return;
      setActive(activeIndexOf(latest, headingsRef.current));
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(sync);
    resize.observe(scroller);
    let mutateTimer = 0;
    const mutate = new MutationObserver(() => {
      window.clearTimeout(mutateTimer);
      mutateTimer = window.setTimeout(sync, 80);
    });
    mutate.observe(scroller, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      resize.disconnect();
      mutate.disconnect();
      window.clearTimeout(mutateTimer);
    };
  }, [isMobile, scrollRef, sync]);

  if (isMobile) return null;
  if (headings.length === 0) return null;
  if (headings.length <= 3 && !overflows) return null;

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden items-center pr-3 md:flex">
      <div
        className="pointer-events-auto relative flex items-center py-6 pl-2"
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <div
          className={cn(
            "absolute right-full top-1/2 z-10 -translate-y-1/2 pr-2",
            open
              ? "visible"
              : "invisible pointer-events-none",
          )}
        >
          <div
            className={cn(
              "w-52 rounded-lg border border-border bg-background/80 p-1 backdrop-blur-xl transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
              open
                ? "translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-1 opacity-0",
              "motion-reduce:translate-x-0 motion-reduce:transition-none",
            )}
          >
            <ul className="max-h-[min(22rem,60vh)] overflow-y-auto">
              {headings.map((heading) => {
                const current = heading.index === active;
                const over = heading.index === hovered;
                return (
                  <li key={heading.index}>
                    <button
                      type="button"
                      className={cn(
                        "w-full truncate rounded-md py-1 pr-2 text-left text-xs font-normal transition-colors duration-100",
                        labelPad(heading.level),
                        current
                          ? "bg-muted text-foreground"
                          : over
                            ? "bg-muted/60 text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                      onMouseEnter={() => setHovered(heading.index)}
                      onMouseLeave={() =>
                        setHovered((value) =>
                          value === heading.index ? null : value,
                        )
                      }
                      onClick={() => {
                        const scroller = scrollRef.current;
                        if (!scroller) return;
                        setActive(heading.index);
                        scrollToHeading(scroller, heading.el);
                      }}
                    >
                      {heading.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <ul className="flex flex-col items-end gap-1 py-2">
          {headings.map((heading) => {
            const current = heading.index === active;
            const over = heading.index === hovered;
            return (
              <li key={heading.index}>
                <button
                  type="button"
                  aria-label={heading.text}
                  className="group/tick flex h-2.5 items-center justify-end"
                  onMouseEnter={() => setHovered(heading.index)}
                  onMouseLeave={() =>
                    setHovered((value) =>
                      value === heading.index ? null : value,
                    )
                  }
                  onClick={() => {
                    const scroller = scrollRef.current;
                    if (!scroller) return;
                    setActive(heading.index);
                    scrollToHeading(scroller, heading.el);
                  }}
                >
                  <span
                    className={cn(
                      "h-0.5 rounded-full transition-[width,background-color] duration-100 ease-out",
                      current || over ? "bg-foreground" : "bg-foreground/25",
                      over && !current && "bg-foreground/70",
                      tickClass(heading.level),
                      over && "scale-x-110",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
