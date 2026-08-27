import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function IngestDiagram() {
  return (
    <Card size="sm" className="w-full">
      <CardContent className="flex flex-col items-center gap-5 py-10 sm:flex-row sm:justify-center sm:gap-6">
        <p className="font-mono text-[12px] leading-none">Drop anything</p>
        <Arrow />
        <p className="font-mono text-[12px] leading-none">Organize in spaces</p>
        <Arrow />
        <Stage label="Ask" detail="You · any AI" />
      </CardContent>
      <CardFooter className="justify-center text-center text-[13px] leading-relaxed font-normal text-muted-foreground">
        Title, summary, tags, markdown. Context you can search. Context any
        model can use.
      </CardFooter>
    </Card>
  );
}

function Stage({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="font-mono text-[12px] leading-none">{label}</p>
      <p className="font-mono text-[11px] leading-none text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden className="font-mono text-[11px] text-blue-600">
      <span className="sm:hidden">↓</span>
      <span className="hidden sm:inline">- - - →</span>
    </span>
  );
}
