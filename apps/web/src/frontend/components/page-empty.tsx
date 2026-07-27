import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function PageEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Empty className="min-h-48 flex-none items-center justify-center gap-2 rounded-none border-0 border-dashed py-16 text-center">
      <EmptyHeader className="items-center gap-1.5">
        <EmptyTitle className="font-normal text-sm tracking-normal">
          {title}
        </EmptyTitle>
        {description ? (
          <EmptyDescription className="text-xs text-muted-foreground">
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  );
}
