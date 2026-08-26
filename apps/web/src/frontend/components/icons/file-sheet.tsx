import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FileIconProps = {
  className?: string;
};

export function FileSheet({
  className,
  accent,
  children,
}: {
  className?: string;
  accent: string;
  children?: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 75.32 92.604"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <g transform="translate(53.548 -183.975) scale(1.4843)">
        <path
          fill={accent}
          d="M-29.633 123.947c-3.552 0-6.443 2.894-6.443 6.446v49.498c0 3.551 2.891 6.445 6.443 6.445h37.85c3.552 0 6.443-2.893 6.443-6.445v-40.702s.102-1.191-.416-2.351a6.516 6.516 0 0 0-1.275-1.844 1.058 1.058 0 0 0-.006-.008l-9.39-9.21a1.058 1.058 0 0 0-.016-.016s-.802-.764-1.99-1.274c-1.4-.6-2.842-.537-2.842-.537l.021-.002z"
        />
        <path
          fill="#f5f5f5"
          d="M-29.633 126.064h28.38a1.058 1.058 0 0 0 .02 0s1.135.011 1.965.368a5.385 5.385 0 0 1 1.373.869l9.368 9.19s.564.595.838 1.208c.22.495.234 1.4.234 1.4a1.058 1.058 0 0 0-.002.046v40.746a4.294 4.294 0 0 1-4.326 4.328h-37.85a4.294 4.294 0 0 1-4.326-4.328v-49.498a4.294 4.294 0 0 1 4.326-4.328z"
        />
      </g>
      {children}
    </svg>
  );
}
