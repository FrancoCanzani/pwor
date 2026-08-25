import { cn } from "@/lib/utils";

function spaceInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    const initials = (first + second).toUpperCase();
    return initials || "?";
  }
  return trimmed.slice(0, 1).toUpperCase() || "?";
}

export function SpacePic({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[9px] leading-none text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {spaceInitial(name ?? "")}
    </span>
  );
}
