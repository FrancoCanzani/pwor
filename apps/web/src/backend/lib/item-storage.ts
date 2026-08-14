/** Upload bytes to the item bucket; returns the byte size for persisting on the item. */
export async function putItemObject(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | Uint8Array | string,
  contentType: string,
): Promise<number> {
  const bytes =
    typeof body === "string"
      ? new TextEncoder().encode(body)
      : body instanceof Uint8Array
        ? body
        : new Uint8Array(body);

  await bucket.put(key, bytes, {
    httpMetadata: { contentType },
  });

  return bytes.byteLength;
}
