import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteAuthButton } from "@features/landing/components/site-auth-button";
import { SiteFooter } from "@features/landing/components/site-footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-background px-6">
      <header className="flex items-center justify-between pt-5">
        <Link
          to="/"
          className="text-base leading-none font-normal tracking-tight no-underline"
        >
          pwor
        </Link>
        <SiteAuthButton />
      </header>

      <article className="mx-auto flex w-full max-w-2xl flex-1 flex-col pt-16">
        <h1 className="text-2xl leading-tight font-normal tracking-tight">
          {title}
        </h1>
        <p className="mt-2 font-nums text-[12px] text-muted-foreground">
          Draft · {updated}
        </p>
        <div className="mt-10 flex flex-col gap-8 text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] leading-snug font-normal text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
