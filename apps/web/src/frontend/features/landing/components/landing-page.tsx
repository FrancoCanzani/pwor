import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CloudflareIcon } from "@/components/icons/cloudflare";
import { AsciiLogo } from "@/components/ui/ascii-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CaptureSession } from "@features/landing/components/capture-session";
import { ContextSession } from "@features/landing/components/context-session";
import { McpSession } from "@features/landing/components/mcp-session";
import { ParseSession } from "@features/landing/components/parse-session";
import { SiteAuthButton } from "@features/landing/components/site-auth-button";
import { SiteFooter } from "@features/landing/components/site-footer";

const DEPLOY_URL =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/FrancoCanzani/pwor";

export function LandingPage() {
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

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          <div className="flex flex-col items-center text-center">
            <div className="h-44 w-full sm:h-56">
              <AsciiLogo
                text="pwor"
                theme="light"
                color="#111111"
                backgroundColor="transparent"
                fit={0.88}
                cellSize={8}
                cellGap={1}
                threshold={0.18}
                label="Pwor"
              />
            </div>

            <h1 className="mt-6 text-3xl leading-[1.15] font-normal tracking-tight">
              Dump anything in. Find it later.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              You throw pages, files, notes, and mail into one place. You ask
              for them later. So can the AI you already use.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <SiteAuthButton size="lg" variant="default" />
              <Button
                size="lg"
                className="bg-[#F6821F] text-white hover:bg-[#E57512] hover:text-white active:bg-[#E57512] active:text-white focus-visible:border-[#F6821F] focus-visible:ring-[#F6821F]/40"
                render={
                  <a href={DEPLOY_URL} target="_blank" rel="noreferrer" />
                }
              >
                <CloudflareIcon data-icon="inline-start" />
                Self host in CF
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-10 sm:grid-cols-2">
            <section>
              <h2 className="text-[15px] leading-snug font-normal">You</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Clip, paste, drop, forward, write. Filing is optional. Inbox is
                whatever you haven’t put in a folder yet.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] leading-snug font-normal">Your AI</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Cursor or Claude, over MCP. Not another chat inside Pwor.
              </p>
            </section>
          </div>
        </div>

        <Beat
          title="Paste"
          body="Paste a link, drop a file, or press ⌘U. Clipper, mail, and notes land the same way. It goes to Inbox until you put it in a space."
        >
          <CaptureSession />
        </Beat>

        <Beat
          title="Parse"
          body="A URL is not context. Pwor pulls the page, takes a screenshot, and writes a title, summary, and tags. The save sits as the link until that’s done."
          flip
        >
          <ParseSession />
        </Beat>

        <Beat
          title="Context"
          body="The page as markdown. That’s what you search. That’s what the model reads."
        >
          <ContextSession />
        </Beat>

        <Beat
          title="Any AI"
          body="Cursor or Claude, over MCP. Same key as the clipper. It can search, open, and save. It cannot delete anything."
          flip
        >
          <McpSession />
        </Beat>
      </div>

      <SiteFooter />
    </main>
  );
}

function Beat({
  title,
  body,
  flip = false,
  children,
}: {
  title: string;
  body: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mt-20 grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
      <div className={cn("flex flex-col gap-2", flip && "sm:order-2")}>
        <h2 className="text-[15px] leading-snug font-normal">{title}</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
      <div className={cn(flip && "sm:order-1")}>{children}</div>
    </section>
  );
}
