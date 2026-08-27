import { Link } from "@tanstack/react-router";

import { CloudflareIcon } from "@/components/icons/cloudflare";
import { AsciiLogo } from "@/components/ui/ascii-logo";
import { Button } from "@/components/ui/button";
import { IngestDiagram } from "@features/landing/components/ingest-diagram";
import { SiteFooter } from "@features/landing/components/site-footer";

const DEPLOY_URL =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/FrancoCanzani/pwor";

const CHANNELS = [
  {
    name: "Clipper",
    body: "Save a page, a selection, or a tweet from the browser.",
  },
  {
    name: "Paste or drop",
    body: "Paste a link, drop a file, or press Mod+U.",
  },
  {
    name: "Email",
    body: "Forward anything to your Pwor address.",
  },
  {
    name: "Feeds",
    body: "Subscribe to a site or a YouTube channel. New posts show up on their own.",
  },
  {
    name: "Notes",
    body: "Things you write yourself.",
  },
] as const;

const TOOLS = [
  {
    name: "Ask",
    body: "What’s in my pile about this?",
  },
  {
    name: "Open a save",
    body: "The page, file, or tweet you kept.",
  },
  {
    name: "Open a note",
    body: "Something you wrote.",
  },
  {
    name: "Save",
    body: "A link or a few sentences, from the chat you’re already in.",
  },
] as const;

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
        <Button variant="secondary" size="sm" render={<Link to="/login" />}>
          Sign in
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
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
            You throw pages, files, notes, and mail into one place. You ask for
            them later. So can the AI you already use.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" render={<Link to="/login" />}>
              Sign in
            </Button>
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

        <section className="mt-20">
          <p className="mb-3 text-center font-mono text-[11px] text-blue-600">
            [ How it works ]
          </p>
          <IngestDiagram />
        </section>

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
              Same pile, over MCP. Cursor or Claude, not another chat inside
              Pwor.
            </p>
          </section>
        </div>

        <section className="mt-16">
          <h2 className="text-[15px] leading-snug font-normal">How it gets in</h2>
          <ul className="mt-6 flex flex-col gap-5">
            {CHANNELS.map((channel) => (
              <li key={channel.name}>
                <p className="text-[13px] leading-snug font-normal">
                  {channel.name}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {channel.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="text-[15px] leading-snug font-normal">
            What your AI can do
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Plug Pwor into Cursor or Claude. Same key as the clipper. It can
            search, open, and save. It cannot empty your pile.
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {TOOLS.map((tool) => (
              <li key={tool.name}>
                <p className="text-[13px] leading-snug font-normal">
                  {tool.name}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {tool.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
