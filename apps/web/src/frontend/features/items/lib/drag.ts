import { useRef, useState, type DragEvent } from "react";

export const PWOR_ITEM_DRAG_TYPE = "application/x-pwor-item";

export type PworItemDrag = {
  kind: "item" | "note";
  ids: string[];
  title: string;
  meta: string;
  fromWorkspaceId: string | null;
};

let activeDrag: PworItemDrag | null = null;

export function getActivePworItemDrag() {
  return activeDrag;
}

export function endPworItemDrag() {
  activeDrag = null;
}

export function isPworItemDrag(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types.includes(PWOR_ITEM_DRAG_TYPE));
}

export function readPworItemDrag(event: DragEvent): PworItemDrag | null {
  const raw = event.dataTransfer?.getData(PWOR_ITEM_DRAG_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PworItemDrag & { id?: string };
    if (parsed.kind !== "item" && parsed.kind !== "note") return null;
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.filter((id) => typeof id === "string" && id.length > 0)
      : typeof parsed.id === "string" && parsed.id.length > 0
        ? [parsed.id]
        : [];
    if (ids.length === 0) return null;
    return { ...parsed, ids };
  } catch {
    return null;
  }
}

export function setPworItemDrag(event: DragEvent, item: PworItemDrag) {
  if (item.ids.length === 0) return;
  activeDrag = item;
  event.dataTransfer.setData(PWOR_ITEM_DRAG_TYPE, JSON.stringify(item));
  event.dataTransfer.effectAllowed = "move";
  setDragPreview(event);
}

export function usePworItemDrop({
  canDrop,
  onDrop,
}: {
  canDrop: (item: PworItemDrag) => boolean;
  onDrop: (item: PworItemDrag) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const depthRef = useRef(0);

  function reset() {
    depthRef.current = 0;
    setIsOver(false);
  }

  function incoming(event: DragEvent): PworItemDrag | null {
    if (!isPworItemDrag(event)) return null;
    const item = getActivePworItemDrag();
    if (!item || !canDrop(item)) return null;
    return item;
  }

  return {
    isOver,
    dropProps: {
      onDragEnter: (event: DragEvent) => {
        if (!incoming(event)) return;
        event.preventDefault();
        depthRef.current += 1;
        setIsOver(true);
      },
      onDragOver: (event: DragEvent) => {
        if (!incoming(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDragLeave: () => {
        depthRef.current = Math.max(0, depthRef.current - 1);
        if (depthRef.current === 0) setIsOver(false);
      },
      onDrop: (event: DragEvent) => {
        const item = readPworItemDrag(event) ?? incoming(event);
        reset();
        if (!item || !canDrop(item)) return;
        event.preventDefault();
        onDrop(item);
      },
    },
  };
}

function setDragPreview(event: DragEvent) {
  const source = event.currentTarget;
  if (!(source instanceof HTMLElement) || !event.dataTransfer) return;

  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("id");
  ghost.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "absolute",
    top: "-10000px",
    left: "0",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    opacity: "1",
  });

  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(
    ghost,
    event.clientX - rect.left,
    event.clientY - rect.top,
  );

  const cleanup = () => {
    ghost.remove();
    window.removeEventListener("dragend", cleanup);
  };
  window.addEventListener("dragend", cleanup, { once: true });
}
