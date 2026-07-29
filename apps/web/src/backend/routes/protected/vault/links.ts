export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function fetchLinkMetadata(
  url: string,
): Promise<{ title: string | null }> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OdiseumBot/1.0)" },
      redirect: "follow",
    });
  } catch {
    return { title: null };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return { title: null };
  }

  let title = "";
  const rewriter = new HTMLRewriter().on("title", {
    text(chunk) {
      title += chunk.text;
    },
  });

  await rewriter.transform(response).text();

  const trimmed = title.trim().replace(/\s+/g, " ");
  return { title: trimmed || null };
}
