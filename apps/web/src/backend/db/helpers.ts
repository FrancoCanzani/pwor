import { and, eq, type AnyColumn } from "drizzle-orm";

/** Scopes a row lookup to a specific owner, e.g. `.where(ownedBy(table.id, id, table.userId, userId))`. */
export function ownedBy(
  idColumn: AnyColumn,
  id: string,
  userIdColumn: AnyColumn,
  userId: string,
) {
  return and(eq(idColumn, id), eq(userIdColumn, userId));
}
