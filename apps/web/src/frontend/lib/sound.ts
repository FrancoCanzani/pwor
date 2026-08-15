import { bind, play, setVolume, type SoundName } from "cuelume";

const DEFAULT_VOLUME = 0.5;

let started = false;

export function startSound() {
  if (started || typeof document === "undefined") return;
  started = true;
  setVolume(DEFAULT_VOLUME);
  bind();
}

export function cue(name: SoundName, volume?: number) {
  if (volume == null) {
    play(name);
    return;
  }
  play(name, { volume });
}
