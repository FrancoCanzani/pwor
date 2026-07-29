import { Link, type ErrorComponentProps } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Something went wrong. Try again.";

  return (
    <Empty className="min-h-[calc(100svh-8rem)] items-center justify-center gap-3 rounded-none border-0 p-6 text-center">
      <EmptyHeader className="items-center gap-1.5">
        <EmptyTitle className="font-normal text-sm tracking-normal">
          Something went wrong
        </EmptyTitle>
        <EmptyDescription className="text-xs text-muted-foreground">
          {message}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" size="sm" render={<Link to="/" />}>
          Go home
        </Button>
      </EmptyContent>
    </Empty>
  );
}
