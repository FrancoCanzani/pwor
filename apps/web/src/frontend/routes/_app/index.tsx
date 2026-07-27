import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { PageEmpty } from "@components/page-empty";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});

function HomePage() {
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="flex flex-col gap-12 pt-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-base font-normal tracking-tight">
          What are you looking for?
        </h1>
        <form onSubmit={handleSubmit}>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your life…"
            autoFocus
            className="h-10 font-normal"
          />
        </form>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-normal text-muted-foreground">Recent</h2>
        <PageEmpty
          title="Nothing here yet"
          description="Throw something in — emails, files, screenshots, voice notes. Objects will appear as the AI connects them."
        />
      </section>
    </div>
  );
}
