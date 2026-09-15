/**
 * Verhindert den iOS/Safari Focus-Zoom als zusätzliche Absicherung zur
 * globalen 16px-Regel. Die Zoomsperre gilt nur solange ein bearbeitbares
 * Feld fokussiert ist; unmittelbar danach wird der ursprüngliche, frei
 * zoombare Viewport wiederhergestellt.
 */
const LOCKED_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

function isMobileOrTouchViewport() {
  return (
    window.matchMedia("(max-width: 1024px)").matches ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

function isEditableFormElement(target: EventTarget | null): target is HTMLElement {
  // Kein instanceof: Safari-WebViews können Ereignisse aus einem anderen
  // Window-Kontext liefern, in dem HTMLElement nicht identisch ist.
  if (
    !target ||
    typeof (target as Element).matches !== "function"
  )
    return false;

  return (target as Element).matches(
    'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]), textarea, select, [contenteditable="true"]'
  );
}

/** Installs one document-level focus guard; safe to call more than once. */
export function installMobileFocusViewportGuard() {
  if (typeof document === "undefined") return;
  if (document.documentElement.dataset.mobileFocusViewportGuard === "installed")
    return;

  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) return;

  document.documentElement.dataset.mobileFocusViewportGuard = "installed";
  const originalContent = viewport.content;
  let restoreTimer: number | null = null;

  const cancelRestore = () => {
    if (restoreTimer !== null) {
      window.clearTimeout(restoreTimer);
      restoreTimer = null;
    }
  };

  const lockViewport = () => {
    if (!isMobileOrTouchViewport()) return;
    cancelRestore();
    viewport.content = LOCKED_VIEWPORT_CONTENT;
  };

  const restoreViewportWhenFocusLeaves = () => {
    cancelRestore();
    restoreTimer = window.setTimeout(() => {
      restoreTimer = null;
      if (!isEditableFormElement(document.activeElement)) {
        viewport.content = originalContent;
      }
    }, 0);
  };

  document.addEventListener("focusin", event => {
    if (isEditableFormElement(event.target)) lockViewport();
  });
  // iOS zoomt nach der Pointer-Interaktion, aber vor dem sichtbaren Caret.
  // Capture aktiviert die Schutzregel deshalb bereits vor dem nativen Fokus.
  document.addEventListener(
    "pointerdown",
    event => {
      if (isEditableFormElement(event.target)) lockViewport();
    },
    { capture: true }
  );
  document.addEventListener("focusout", event => {
    if (isEditableFormElement(event.target)) restoreViewportWhenFocusLeaves();
  });
  // Safari liefert programmgesteuerte Blur-Ereignisse in einzelnen WebViews
  // zuverlässiger im Capture-Phase-Pfad als als bubbling focusout.
  document.addEventListener(
    "blur",
    event => {
      if (isEditableFormElement(event.target)) restoreViewportWhenFocusLeaves();
    },
    { capture: true }
  );
}
