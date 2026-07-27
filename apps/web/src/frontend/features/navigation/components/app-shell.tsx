import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  UserMenu,
  type ShellUser,
} from "@features/navigation/components/user-menu";

const shellWidth = "mx-auto w-full max-w-3xl px-5";

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm">
        <div className={cn(shellWidth, "flex items-center gap-6 py-5")}>
          <Link
            to="/"
            className="shrink-0 text-[13px] font-normal tracking-tight text-foreground no-underline"
          >
            Odiseum
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <div className={cn(shellWidth, "pt-10 pb-20")}>{children}</div>
    </>
  );
}
