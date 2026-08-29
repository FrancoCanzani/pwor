"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function useInView() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.55, rootMargin: "0px 0px -32% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node]);

  return { ref: setNode, inView };
}

export function useEntered(inView: boolean) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (inView) setEntered(true);
  }, [inView]);

  return entered;
}

export function useDelayed(started: boolean, ms: number, reduced: boolean) {
  const [on, setOn] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setOn(true);
      return;
    }
    if (!started) return;
    const id = window.setTimeout(() => setOn(true), ms);
    return () => window.clearTimeout(id);
  }, [ms, reduced, started]);

  return on;
}

export const EASE = "ease-[cubic-bezier(0.23,1,0.32,1)]";

export function Swap({
  showAfter,
  before,
  after,
}: {
  showAfter: boolean;
  before: ReactNode;
  after: ReactNode;
}) {
  return (
    <div className="grid">
      <div
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,transform] duration-500",
          EASE,
          showAfter
            ? "pointer-events-none -translate-y-1.5 opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        {before}
      </div>
      <div
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,transform] duration-500",
          EASE,
          showAfter
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1.5 opacity-0",
        )}
      >
        {after}
      </div>
    </div>
  );
}

export function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-background",
        className,
      )}
    >
      {children}
    </div>
  );
}
