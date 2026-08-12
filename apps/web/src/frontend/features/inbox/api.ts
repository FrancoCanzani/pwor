import { queryOptions } from "@tanstack/react-query";

import { parseJson } from "@lib/api";

export type UserInbox = {
  address: string;
  token: string;
};

async function fetchUserInbox(): Promise<UserInbox> {
  return parseJson<UserInbox>(await fetch("/api/inbox"));
}

export function userInboxQueryOptions() {
  return queryOptions({
    queryKey: ["inbox", "address"] as const,
    queryFn: fetchUserInbox,
  });
}

export async function regenerateUserInbox(): Promise<UserInbox> {
  return parseJson<UserInbox>(
    await fetch("/api/inbox/regenerate", { method: "POST" }),
  );
}

export async function simulateInboundEmail(): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch("/api/inbox/simulate", { method: "POST" }),
  );
}
