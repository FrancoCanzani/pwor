import { inArray, lte, or } from "drizzle-orm";

import { createDb } from "../../../db";
import { extensionPairing } from "../../../db/schema";

export async function purgeStalePairings(env: Env): Promise<void> {
  const db = createDb(env.DB);
  await db
    .delete(extensionPairing)
    .where(
      or(
        lte(extensionPairing.expiresAt, new Date()),
        inArray(extensionPairing.status, ["consumed", "expired"]),
      ),
    );
}
