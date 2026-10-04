import { GripHorizontal } from "lucide-react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type KlemmiGuideCardProps = {
  children: ReactNode;
  ariaLabel?: string;
  /** Hält die Erklärung sichtbar, wenn ein Ziel am unteren rechten Rand liegt. */
  position?: "bottom-right" | "top-left";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Nicht-modale Klemmi-Sprechblase mit einem klaren Greifpunkt.
 * Die Position gilt nur für den aktuellen geöffneten Guide und wird beim
 * nächsten Öffnen bewusst wieder auf die vertraute Standardposition gesetzt.
 */
export function KlemmiGuideCard({
  children,
  ariaLabel = "Klemmi Schritt-für-Schritt-Anleitung",
  position = "bottom-right",
}: KlemmiGuideCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    const card = cardRef.current;
    if (!card || typeof window === "undefined") return;

    const rect = card.getBoundingClientRect();
    const padding = 8;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
      minX: offset.x + padding - rect.left,
      maxX: offset.x + window.innerWidth - padding - rect.right,
      minY: offset.y + padding - rect.top,
      maxY: offset.y + window.innerHeight - padding - rect.bottom,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    setOffset({
      x: clamp(
        dragState.startOffsetX + event.clientX - dragState.startClientX,
        dragState.minX,
        dragState.maxX
      ),
      y: clamp(
        dragState.startOffsetY + event.clientY - dragState.startClientY,
        dragState.minY,
        dragState.maxY
      ),
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      ref={cardRef}
      aria-live="polite"
      aria-label={ariaLabel}
      data-klemmi-draggable-card
      data-klemmi-dragging={isDragging ? "true" : "false"}
      className={
        position === "top-left"
          ? "klemmi-guide-card pointer-events-auto fixed inset-x-3 top-3 bottom-auto overflow-visible rounded-2xl border border-blue-200 bg-white p-3 text-slate-950 shadow-2xl sm:inset-x-auto sm:top-5 sm:right-auto sm:left-5 sm:w-[min(25rem,calc(100vw-2.5rem))] sm:p-4"
          : "klemmi-guide-card pointer-events-auto fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] overflow-visible rounded-2xl border border-blue-200 bg-white p-3 text-slate-950 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(25rem,calc(100vw-2.5rem))] sm:p-4"
      }
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      <div
        title="Zum Verschieben ziehen"
        data-klemmi-drag-handle
        className="klemmi-guide-drag-handle"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripHorizontal className="size-4" aria-hidden="true" />
        <span>Klemmi-Fenster verschieben</span>
      </div>
      {children}
    </section>
  );
}
