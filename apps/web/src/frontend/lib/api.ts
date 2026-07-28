export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await res.text().catch(() => "Request failed"));
  }
  return (await res.json()) as T;
}
