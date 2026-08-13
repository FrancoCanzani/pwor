const STORAGE_KEY = "pwor:capture-hint-seen";
const EVENT = "pwor:capture-hint-seen";

export function markCaptureHintSeen() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
  window.localStorage.setItem(STORAGE_KEY, "1");
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeCaptureHintSeen(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getCaptureHintSeen() {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function getCaptureHintSeenServer() {
  return true;
}
