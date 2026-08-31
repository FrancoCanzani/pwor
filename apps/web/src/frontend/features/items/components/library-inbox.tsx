import { getRouteApi } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@features/command/command-palette-context";

const appRoute = getRouteApi("/_app");

export function LibraryInbox({
  edgeToEdge,
  children,
}: {
  edgeToEdge: boolean;
  children: ReactNode;
}) {
  const pad = edgeToEdge ? "px-3" : "px-4";
  const { user } = appRoute.useRouteContext();
  const { open } = useCommandPalette();

  return (
    <>
      <div className={cn("pb-12", pad)}>
        <h1 className="text-center text-2xl leading-none tracking-tight">
          {greeting(user.name)}
        </h1>
        <Button
          type="button"
          variant="outline"
          onClick={() => open()}
          className="mt-6 h-9 w-full justify-start rounded-lg px-2.5 text-sm font-normal text-muted-foreground hover:text-muted-foreground"
        >
          Search or jump to…
          <Kbd className="ml-auto">⌘K</Kbd>
        </Button>
      </div>
      {children}
    </>
  );
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const when =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  const first = name.trim().split(/\s+/)[0];
  return first ? `${when} ${first}` : when;
}
