const GENERATED_AUDIO_NAME =
  /^voice\.(webm|weba|m4a|mp3|mp4|wav|ogg|opus|aac|flac)$/i;

export function isGeneratedAudioFilename(name: string): boolean {
  return GENERATED_AUDIO_NAME.test(name.trim());
}

export function isPlaceholderAudioTitle(
  title: string | null | undefined,
): boolean {
  const value = title?.trim() ?? "";
  if (!value) return true;
  if (value.toLowerCase() === "voice memo") return true;
  return isGeneratedAudioFilename(value);
}
