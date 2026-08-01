import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function NotFound() {
  return (
    <Empty className="min-h-[calc(100svh-8rem)] items-center justify-center gap-3 border-0 p-6 text-center">
      <EmptyHeader className="items-center gap-1.5">
        <EmptyTitle className="font-normal text-sm tracking-normal">
          Page not found
        </EmptyTitle>
        <EmptyDescription className="text-xs text-muted-foreground">
          This page does not exist or was moved.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button variant="outline" size="sm" render={<Link to="/" />}>
          Go home
        </Button>
      </EmptyContent>
    </Empty>
  );
}
