const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "yaml",
  "yml",
  "toml",
  "log",
  "css",
  "html",
  "htm",
  "js",
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "cjs",
  "sql",
  "env",
  "ini",
  "cfg",
  "conf",
  "sh",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "swift",
  "kt",
]);

const TEXT_APPLICATION_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-javascript",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/sql",
  "application/x-sh",
  "application/x-httpd-php",
]);

/** Whether a vault file can be shown as plain text in the viewer. */
export function isTextPreviewable(
  mimeType: string | null,
  title: string | null,
): boolean {
  if (mimeType) {
    if (mimeType.startsWith("text/")) return true;
    if (TEXT_APPLICATION_TYPES.has(mimeType)) return true;
  }
  if (title) {
    const ext = title.includes(".")
      ? title.slice(title.lastIndexOf(".") + 1).toLowerCase()
      : null;
    if (ext && TEXT_EXTENSIONS.has(ext)) return true;
  }
  return false;
}
