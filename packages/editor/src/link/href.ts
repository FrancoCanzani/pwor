export function normalizeHref(value: string): string | null {
  const href = value.trim();
  if (href.length === 0) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  return `https://${href}`;
}

export function displayHref(href: string): string {
  return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
