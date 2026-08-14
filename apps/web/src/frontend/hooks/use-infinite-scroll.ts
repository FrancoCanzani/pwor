import { useEffect, useRef } from "react";

/**
 * Ref for a bottom-of-list sentinel element; calls onReach when it nears the
 * viewport. Pair with useInfiniteQuery's fetchNextPage.
 */
export function useInfiniteScrollSentinel(
  onReach: () => void,
  enabled: boolean,
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onReachRef = useRef(onReach);

  useEffect(() => {
    onReachRef.current = onReach;
  }, [onReach]);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onReachRef.current();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
