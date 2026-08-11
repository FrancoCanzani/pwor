/** File extensions that become code snippets (not notes, not generic files). */
export const SNIPPET_EXTENSIONS = new Set([
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cpp",
  "cc",
  "cxx",
  "hpp",
  "cs",
  "php",
  "sql",
  "sh",
  "bash",
  "zsh",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "xml",
  "json",
  "yaml",
  "yml",
  "toml",
  "vue",
  "svelte",
  "graphql",
  "gql",
  "r",
  "lua",
  "dart",
  "scala",
  "zig",
]);

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

export function fileExtension(filename: string): string | null {
  if (!filename.includes(".")) return null;
  return filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
}

export function languageFromFilename(filename: string): string | null {
  const ext = fileExtension(filename);
  if (!ext) return null;
  return EXT_TO_LANGUAGE[ext] ?? null;
}

export function isCodeSnippetFile(file: File): boolean {
  const ext = fileExtension(file.name);
  return Boolean(ext && SNIPPET_EXTENSIONS.has(ext));
}

export function isMarkdownFile(file: File): boolean {
  return (
    file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")
  );
}
