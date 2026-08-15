// Same SOH/STX markers as FTS5 highlight() — they never appear in real text.
const MARK_OPEN = "\u0001";
const MARK_CLOSE = "\u0002";

export function MarkedText({ text }: { text: string }) {
  if (!text.includes(MARK_OPEN)) return <>{text}</>;

  const parts = text.split(MARK_OPEN);
  return (
    <>
      {parts.map((part, index) => {
        if (index === 0) return <span key={index}>{part}</span>;
        const [match, ...rest] = part.split(MARK_CLOSE);
        return (
          <span key={index}>
            <mark className="rounded-sm bg-foreground/15 text-foreground">
              {match}
            </mark>
            {rest.join(MARK_CLOSE)}
          </span>
        );
      })}
    </>
  );
}
