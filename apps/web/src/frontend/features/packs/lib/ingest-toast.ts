import { toast } from "sonner";

import {
  createPackTextSource,
  createPackUrlSource,
  uploadPackSource,
  type PackSource,
  type PackSourceDetail,
  type SourceParseStatus,
} from "@features/packs/api";
import { parseJson } from "@lib/api";

const TERMINAL: SourceParseStatus[] = ["ready", "failed", "skipped"];

async function fetchSource(
  packId: string,
  sourceId: string,
): Promise<PackSourceDetail> {
  return parseJson<PackSourceDetail>(
    await fetch(`/api/packs/${packId}/sources/${sourceId}`),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilParsed(
  packId: string,
  sourceId: string,
  onTick?: (status: SourceParseStatus) => void,
): Promise<PackSourceDetail> {
  const started = Date.now();
  const timeoutMs = 120_000;

  while (Date.now() - started < timeoutMs) {
    const source = await fetchSource(packId, sourceId);
    onTick?.(source.parseStatus);
    if (TERMINAL.includes(source.parseStatus)) return source;
    await sleep(1200);
  }

  throw new Error("Timed out waiting for parse");
}

function labelOf(source: PackSource, fallback: string) {
  return source.title || source.filename || fallback;
}

function finishToast(
  toastId: string | number,
  source: PackSourceDetail,
  fallback: string,
) {
  const name = labelOf(source, fallback);
  if (source.parseStatus === "ready") {
    toast.success(`${name} ready`, { id: toastId, duration: 4000 });
    return;
  }
  if (source.parseStatus === "skipped") {
    toast.message(`${name} skipped`, {
      id: toastId,
      description: source.parseError ?? "Unsupported format",
      duration: 5000,
    });
    return;
  }
  toast.error(`${name} failed`, {
    id: toastId,
    description: source.parseError ?? "Parse failed",
    duration: 6000,
  });
}

/** One toast that advances: uploading → parsing → ready/failed. */
export async function ingestWithToast(
  packId: string,
  label: string,
  start: () => Promise<PackSource>,
  phases: { start: string; parsing: string },
): Promise<PackSourceDetail | PackSource> {
  const toastId = toast.loading(phases.start);

  try {
    const created = await start();
    const name = labelOf(created, label);

    if (TERMINAL.includes(created.parseStatus)) {
      finishToast(toastId, created as PackSourceDetail, label);
      return created;
    }

    toast.loading(`${phases.parsing} ${name}…`, { id: toastId });
    const parsed = await waitUntilParsed(packId, created.id, (status) => {
      if (status === "pending") {
        toast.loading(`${phases.parsing} ${name}…`, { id: toastId });
      }
    });
    finishToast(toastId, parsed, label);
    return parsed;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : `Failed: ${label}`, {
      id: toastId,
      duration: 6000,
    });
    throw err;
  }
}

export function ingestFileWithToast(packId: string, file: File) {
  return ingestWithToast(
    packId,
    file.name,
    () => uploadPackSource(packId, file),
    { start: `Uploading ${file.name}…`, parsing: "Parsing" },
  );
}

export function ingestUrlWithToast(packId: string, url: string) {
  return ingestWithToast(
    packId,
    url,
    () => createPackUrlSource(packId, { url }),
    { start: "Fetching URL…", parsing: "Parsing" },
  );
}

export function ingestTextWithToast(packId: string, content: string) {
  return ingestWithToast(
    packId,
    "Text",
    () => createPackTextSource(packId, { content }),
    { start: "Saving text…", parsing: "Parsing" },
  );
}
