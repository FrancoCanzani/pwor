const MAX_TRANSCRIBE_BYTES = 12 * 1024 * 1024;
const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";

const AUDIO_EXT = new Set([
  "webm",
  "weba",
  "m4a",
  "mp3",
  "wav",
  "ogg",
  "opus",
  "aac",
  "flac",
]);

export function isAudioMime(
  mimeType: string | null | undefined,
  filename?: string | null,
): boolean {
  if (mimeType?.toLowerCase().startsWith("audio/")) return true;
  if (!filename) return false;
  const base = filename.split("/").pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return false;
  return AUDIO_EXT.has(base.slice(dot + 1).toLowerCase());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function transcribeAudio(
  env: Env,
  buffer: ArrayBuffer,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (buffer.byteLength > MAX_TRANSCRIBE_BYTES) {
    return { ok: false, error: "audio too large to transcribe" };
  }

  try {
    const result = (await env.AI.run(WHISPER_MODEL, {
      audio: bytesToBase64(new Uint8Array(buffer)),
    })) as { text?: string };
    const text = result.text?.trim() ?? "";
    if (!text) return { ok: false, error: "empty transcript" };
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 500) };
  }
}
