import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-28 w-full max-w-2xl border-t border-border pt-8 pb-12">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-foreground">Pwor</span>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Capture for humans. Memory for any AI.
          </p>
        </div>
        <nav className="flex shrink-0 items-center gap-4 text-[12px] text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span className="font-nums">2026</span>
        </nav>
      </div>
    </footer>
  );
}
