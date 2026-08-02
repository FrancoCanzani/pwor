export function DragChip({ title }: { title: string }) {
  return (
    <div className="flex max-w-[240px] items-center gap-2 rounded-full border border-border/80 bg-background px-3.5 py-2 shadow-sm">
      <span className="size-1.5 shrink-0 rounded-full bg-foreground/40" />
      <span className="truncate text-xs font-normal text-foreground">
        {title}
      </span>
    </div>
  );
}
