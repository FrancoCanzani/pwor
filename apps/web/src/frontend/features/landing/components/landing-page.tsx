import { Link } from "@tanstack/react-router";

import { AsciiLogo } from "@/components/ui/ascii-logo";
import { Button } from "@/components/ui/button";

const CAPTURES = [
  "Pages",
  "Notes",
  "Tweets",
  "PDFs",
  "Images",
  "Files",
] as const;

const FEATURES = [
  {
    name: "Capture first",
    body: "Paste a URL, drop a file, write a note. Everything lands in one inbox. Filing is optional.",
  },
  {
    name: "Objects, not folders",
    body: "A tweet isn’t a bookmark. A boarding pass isn’t a file. They become the person, the trip, the company.",
  },
  {
    name: "Search, don’t organize",
    body: "The homepage is a question, not a pile. You ask. You don’t sort.",
  },
  {
    name: "Notes stay markdown",
    body: "Write in the document. Title and tags live in the frontmatter. Live preview, no toolbar.",
  },
] as const;

const AI_LOGOS = [
  { slug: "openai", name: "OpenAI" },
  { slug: "anthropic", name: "Anthropic" },
  { slug: "claude", name: "Claude" },
  { slug: "google-gemini", name: "Gemini" },
  { slug: "cursor", name: "Cursor" },
  { slug: "mistral", name: "Mistral" },
  { slug: "perplexity", name: "Perplexity" },
  { slug: "grok", name: "Grok" },
] as const;

function logoSrc(slug: string) {
  return `https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${slug}/default.svg`;
}

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-[max(1.5rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] pl-[max(1.5rem,env(safe-area-inset-left))]">
        <Link
          to="/"
          className="text-base leading-none font-normal tracking-tight no-underline"
        >
          pwor
        </Link>
        <Button variant="ghost" size="sm" render={<Link to="/login" />}>
          Sign in
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-16">
        <div className="h-56 w-full sm:h-72">
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

        <h1 className="mt-8 text-3xl leading-[1.15] font-normal tracking-tight">
          Your life, organized itself.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Capture anything. It becomes a person, a trip, a company, a document —
          something you can search, not something you file.
        </p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {CAPTURES.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="mt-8">
          <Button size="lg" render={<Link to="/login" />}>
            Sign in
          </Button>
        </div>

        <ul className="mt-20 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.name}>
              <p className="text-[15px] leading-snug font-normal">
                {feature.name}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>

        <section className="mt-20">
          <h2 className="text-[15px] leading-snug font-normal">
            Any AI, via MCP
          </h2>
          <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
            Claude, Cursor, ChatGPT, or anything that speaks MCP. Pwor is the
            context — your captures, notes, and objects, given to the model you
            already use.
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-5">
            {AI_LOGOS.map((logo) => (
              <li key={logo.slug}>
                <img
                  src={logoSrc(logo.slug)}
                  alt={logo.name}
                  title={logo.name}
                  width={28}
                  height={28}
                  className="size-7 object-contain opacity-50 brightness-0"
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer>
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-[max(1.5rem,env(safe-area-inset-left))] py-4 pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] text-[13px] text-muted-foreground">
          <span>Pwor</span>
          <span className="font-nums">2026</span>
        </div>
      </footer>
    </main>
  );
}
