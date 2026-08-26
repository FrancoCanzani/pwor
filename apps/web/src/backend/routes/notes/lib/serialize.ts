export function serializeNote<T extends { pinnedAt: Date | null }>(row: T) {
  const { pinnedAt, ...rest } = row;
  return {
    ...rest,
    pinned: pinnedAt != null,
  };
}
