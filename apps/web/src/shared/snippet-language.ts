/** Map file extensions to CodeMirror / display language ids. */
const EXT_TO_LANGUAGE: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  markdown: "markdown",
  vue: "vue",
  svelte: "svelte",
  graphql: "graphql",
  gql: "graphql",
  r: "r",
  lua: "lua",
  dart: "dart",
  scala: "scala",
  zig: "zig",
};

/** File extensions that become code snippets (not notes, not generic files). */
export const SNIPPET_EXTENSIONS = new Set(
  Object.keys(EXT_TO_LANGUAGE).filter(
    (ext) => ext !== "md" && ext !== "markdown",
  ),
);

export function extensionOf(filename: string): string | null {
  const base = filename.includes("/")
    ? filename.slice(filename.lastIndexOf("/") + 1)
    : filename;
  if (!base.includes(".")) return null;
  return base.slice(base.lastIndexOf(".") + 1).toLowerCase();
}

export function languageFromFilename(filename: string): string | null {
  const ext = extensionOf(filename);
  if (!ext) return null;
  return EXT_TO_LANGUAGE[ext] ?? null;
}

export function languageFromMime(
  mimeType: string | null | undefined,
): string | null {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  switch (normalized) {
    case "application/javascript":
    case "text/javascript":
      return "javascript";
    case "application/typescript":
    case "text/typescript":
      return "typescript";
    case "text/x-python":
      return "python";
    case "application/json":
      return "json";
    case "text/css":
      return "css";
    case "text/html":
      return "html";
    case "application/x-sh":
    case "text/x-shellscript":
      return "shell";
    case "text/markdown":
      return "markdown";
    default:
      return null;
  }
}

/** Code files become snippets; markdown is handled separately as notes. */
export function isCodeSnippetFile(
  filename: string,
  mimeType?: string | null,
): boolean {
  const ext = extensionOf(filename);
  if (ext && SNIPPET_EXTENSIONS.has(ext)) return true;
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return (
    normalized === "application/javascript" ||
    normalized === "text/javascript" ||
    normalized === "application/typescript" ||
    normalized === "text/x-python" ||
    normalized === "text/x-rust" ||
    normalized === "text/x-go" ||
    normalized === "application/x-sh"
  );
}

export function isMarkdownFile(
  filename: string,
  mimeType?: string | null,
): boolean {
  const ext = extensionOf(filename);
  if (ext === "md" || ext === "markdown") return true;
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return normalized === "text/markdown";
}
