/**
 * Heuristic language id from pasted source. Prefer filename/mime when available.
 * Ids align with `@codemirror/language-data` names/aliases (e.g. jsx, tsx, shell).
 */
export function inferLanguageFromContent(content: string): string | null {
  const sample = content.slice(0, 6_000);
  const trimmed = sample.trim();
  if (!trimmed) return null;

  if (/^#!.*\b(bash|sh|zsh|fish)\b/m.test(trimmed)) return "shell";
  if (/^\s*\{[\s\S]*\}\s*$/.test(trimmed) && /"[^"]+"\s*:/.test(trimmed)) {
    return "json";
  }
  if (
    /^\s*[-\w.]+\s*:\s*\S+/m.test(trimmed) &&
    !/[{;()]/.test(trimmed) &&
    trimmed.split("\n").length >= 2
  ) {
    return "yaml";
  }

  const hasJsxTag =
    /<\/?[A-Z][\w.]*\b[^>]*>/.test(trimmed) ||
    /<\/?(?:Fragment|Suspense|StrictMode)\b/.test(trimmed) ||
    /\bclassName\s*=/.test(trimmed) ||
    /\b(?:return\s*\(\s*)?<[A-Za-z][\w.]*[\s/>]/.test(trimmed);

  if (hasJsxTag) {
    if (
      /\b(interface|type)\s+\w+|:\s*(string|number|boolean|unknown|React\.)\b|import\s+type\b|\bas\s+const\b/.test(
        sample,
      )
    ) {
      return "tsx";
    }
    return "jsx";
  }

  if (/<\/?[a-zA-Z][\w:-]*\b[^>]*>/.test(trimmed)) return "html";
  if (/@(media|import|keyframes)\b|^\s*[\w.#-]+\s*\{/m.test(trimmed)) {
    return "css";
  }
  if (
    /\b(interface|type)\s+\w+|:\s*(string|number|boolean|unknown)\b|import\s+type\b|\bas\s+const\b/.test(
      sample,
    )
  ) {
    return "typescript";
  }
  if (/\b(def |elif |self\.|None\b|True\b|False\b|import\s+\w+)/.test(sample)) {
    return "python";
  }
  if (/\b(fn\s+\w+|let\s+mut\b|impl\s+|pub\s+(fn|struct|enum)\b)/.test(sample)) {
    return "rust";
  }
  if (/\b(func\s+\w+|package\s+main\b|:=)/.test(sample)) return "go";
  if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(sample)) {
    return "sql";
  }
  if (
    /\b(const|let|var|function|=>|import\s+.+from)\b/.test(sample) &&
    /[{};]/.test(sample)
  ) {
    return "javascript";
  }
  if (/^\s*(export\s+)?(async\s+)?function\b/m.test(sample)) {
    return "javascript";
  }

  return null;
}

/** True when pasted text looks like source rather than prose. */
export function looksLikeCode(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  const lines = trimmed.split("\n");
  if (lines.length < 2 && !/^[{<[#!]/.test(trimmed)) return false;
  if (inferLanguageFromContent(trimmed)) return true;
  const codey =
    (trimmed.match(/[{};=<>]/g)?.length ?? 0) +
    (trimmed.match(/\b(function|const|let|var|def|class|import|return)\b/g)
      ?.length ?? 0);
  return codey >= 4 && lines.length >= 2;
}
