export function DragChip({ title }: { title: string }) {
  return (
    <div className="max-w-[200px] truncate rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-normal shadow-md">
      {title}
    </div>
  );
}
