export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = raw || "Request failed";
    try {
      const body = JSON.parse(raw) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
