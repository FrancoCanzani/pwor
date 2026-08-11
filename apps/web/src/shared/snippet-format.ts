const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  python: "Python",
  rust: "Rust",
  go: "Go",
  sql: "SQL",
  shell: "Shell",
  ruby: "Ruby",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  php: "PHP",
  markdown: "Markdown",
  vue: "Vue",
  toml: "TOML",
  graphql: "GraphQL",
};

/** Remove shared leading indentation from pasted source. */
export function dedentCode(content: string): string {
  const normalized = content.replace(/\t/g, "  ").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.trim() === "") start += 1;
  while (end > start && lines[end - 1]?.trim() === "") end -= 1;
  if (start >= end) return "";

  const body = lines.slice(start, end);
  let minIndent = Number.POSITIVE_INFINITY;
  for (const line of body) {
    if (line.trim() === "") continue;
    const match = line.match(/^ +/);
    const indent = match?.[0]?.length ?? 0;
    if (indent < minIndent) minIndent = indent;
  }
  if (!Number.isFinite(minIndent) || minIndent === 0) {
    return body.join("\n");
  }

  return body
    .map((line) => (line.trim() === "" ? "" : line.slice(minIndent)))
    .join("\n");
}

function truncateTitle(value: string, max = 60): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Snippet";
  return trimmed.length > max ? `${trimmed.slice(0, max).trim()}…` : trimmed;
}

function languageFallbackTitle(language: string | null | undefined): string {
  if (!language) return "Snippet";
  const label =
    LANGUAGE_LABELS[language.toLowerCase()] ??
    language.charAt(0).toUpperCase() + language.slice(1);
  return `${label} snippet`;
}

/**
 * Prefer identifiers over raw first-line source (avoids titles like `<Button`).
 */
export function titleFromSnippet(
  content: string,
  language?: string | null,
): string {
  const trimmed = content.trim();
  if (!trimmed) return languageFallbackTitle(language);

  const patterns: RegExp[] = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
    /(?:export\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/,
    /<\s*([A-Z][\w.]*)\b/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const name = match?.[1]?.trim();
    if (name) return truncateTitle(name);
  }

  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
  // Raw markup / braces make poor titles — fall back to language label.
  if (
    !firstLine ||
    /^[{[<#!/`'"0-9]/.test(firstLine) ||
    firstLine.includes("=") ||
    firstLine.includes("(") ||
    firstLine.includes(";")
  ) {
    return languageFallbackTitle(language);
  }

  return truncateTitle(firstLine);
}

export function titleFromText(content: string): string {
  const line = content.trim().split(/\n/)[0] ?? content.trim();
  return line.length > 60 ? `${line.slice(0, 60).trim()}…` : line;
}

export function displayLanguageLabel(language: string | null | undefined): string {
  if (!language) return "plain text";
  return (
    LANGUAGE_LABELS[language.toLowerCase()] ??
    language
  );
}

/** Common languages for the snippet language picker. */
export const SNIPPET_LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "sql", label: "SQL" },
  { value: "shell", label: "Shell" },
  { value: "markdown", label: "Markdown" },
] as const;
