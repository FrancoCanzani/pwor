const BYTE_SIZE_META = "byteSize";

/** Read a vault object's byte length, backfilling R2 metadata when size is missing. */
export async function vaultObjectByteSize(
  bucket: R2Bucket,
  key: string,
): Promise<number> {
  const head = await bucket.head(key);
  if (!head) return 0;

  const fromMeta = Number(head.customMetadata?.[BYTE_SIZE_META]);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  if (head.size > 0) return head.size;

  // Older uploads (stream puts) often report size 0 in local R2 — measure once
  // and persist on the object so later lists stay cheap.
  const object = await bucket.get(key);
  if (!object) return 0;

  const buffer = await object.arrayBuffer();
  const size = buffer.byteLength;
  if (size <= 0) return 0;

  await bucket.put(key, buffer, {
    httpMetadata: object.httpMetadata,
    customMetadata: {
      ...object.customMetadata,
      [BYTE_SIZE_META]: String(size),
    },
  });

  return size;
}

/** Upload bytes to the vault bucket with a durable size in custom metadata. */
export async function putVaultObject(
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
  const size = bytes.byteLength;

  await bucket.put(key, bytes, {
    httpMetadata: { contentType },
    customMetadata: { [BYTE_SIZE_META]: String(size) },
  });

  return size;
}
