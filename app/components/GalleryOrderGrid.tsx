"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { updateGalleryOrderAction } from "@/app/actions/gallery";

type Painting = {
  id: string;
  title: string;
  image_url: string;
};

type Props = {
  paintings: Painting[];
};

function moveItem<T>(list: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("button, a, input, textarea, select, label"));
}

export default function GalleryOrderGrid({ paintings }: Props) {
  const [items, setItems] = useState(paintings);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const itemsRef = useRef(items);
  const initialOrder = useRef<string[]>([]);
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const previousPositions = useRef<Map<string, DOMRect>>(new Map());
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const lastDragTargetRef = useRef<string | null>(null);

  useEffect(() => {
    setItems(paintings);
  }, [paintings]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();
    for (const item of items) {
      const el = itemRefs.current.get(item.id);
      if (!el) continue;
      nextPositions.set(item.id, el.getBoundingClientRect());
    }

    if (previousPositions.current.size) {
      for (const [id, nextRect] of nextPositions.entries()) {
        const prevRect = previousPositions.current.get(id);
        if (!prevRect) continue;
        const dx = prevRect.left - nextRect.left;
        const dy = prevRect.top - nextRect.top;
        if (!dx && !dy) continue;
        const el = itemRefs.current.get(id);
        if (!el) continue;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 200ms cubic-bezier(0.2, 0, 0.2, 1)";
          el.style.transform = "";
        });
      }
    }

    previousPositions.current = nextPositions;
  }, [items]);

  useEffect(() => {
    if (!draggingId) return;
    const onPointerMove = (event: PointerEvent) => {
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      if (dragRafRef.current !== null) return;
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null;
        if (!dragPointerRef.current) return;
        const { x, y } = dragPointerRef.current;

        const element = document.elementFromPoint(x, y);
        const target = element?.closest?.(
          "[data-painting-id]",
        ) as HTMLElement | null;
        const targetId = target?.dataset?.paintingId || null;
        if (!targetId || targetId === draggingId) return;
        if (lastDragTargetRef.current === targetId) return;
        lastDragTargetRef.current = targetId;
        setDragOverId(targetId);
        setItems((prev) => {
          const fromIndex = prev.findIndex((p) => p.id === draggingId);
          const toIndex = prev.findIndex((p) => p.id === targetId);
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex)
            return prev;
          return moveItem(prev, fromIndex, toIndex);
        });
      });
    };

    const onPointerUp = () => {
      const finalOrder = itemsRef.current.map((item) => item.id);
      setDraggingId(null);
      setDragOverId(null);
      lastDragTargetRef.current = null;
      dragPointerRef.current = null;
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (initialOrder.current.join("|") !== finalOrder.join("|")) {
        setSaving(true);
        setMessage(null);
        updateGalleryOrderAction({ orderedIds: finalOrder })
          .then(() => {
            setMessage("Gallery order updated.");
            setTimeout(() => setMessage(null), 2000);
          })
          .catch((err) => setMessage((err as Error).message))
          .finally(() => setSaving(false));
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [draggingId]);

  const handleToggle = (event: React.MouseEvent | React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-stop-toggle="true"]')) return;
    setIsOpen((open) => !open);
  };

  return (
    <div
      className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm cursor-pointer"
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onClick={handleToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          if (event.currentTarget !== event.target) return;
          event.preventDefault();
          handleToggle(event);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-lg font-semibold text-neutral-900">
          Gallery Order
        </div>
      </div>

      {isOpen && (
        <div
          className="mt-4 space-y-3 cursor-default"
          data-stop-toggle="true"
          onClick={(event) => event.stopPropagation()}
        >
          {message ? (
            <p className="text-sm text-neutral-600">{message}</p>
          ) : null}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((painting) => (
              <div
                key={painting.id}
                ref={(el) => itemRefs.current.set(painting.id, el)}
                data-painting-id={painting.id}
                onPointerDown={(event) => {
                  if (
                    event.button !== 0 ||
                    saving ||
                    isInteractiveTarget(event.target)
                  )
                    return;
                  event.preventDefault();
                  if (event.currentTarget instanceof HTMLElement) {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }
                  initialOrder.current = items.map((item) => item.id);
                  setDraggingId(painting.id);
                  setDragOverId(painting.id);
                  lastDragTargetRef.current = painting.id;
                  document.body.style.cursor = "grabbing";
                  document.body.style.userSelect = "none";
                }}
                onDragStart={(event) => event.preventDefault()}
                className={`group relative overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow ${
                  dragOverId === painting.id ? "ring-2 ring-sky-300" : ""
                } ${draggingId === painting.id ? "shadow-lg opacity-90" : ""} ${
                  saving
                    ? "pointer-events-none opacity-70"
                    : "cursor-grab active:cursor-grabbing"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={painting.image_url}
                  alt={painting.title || "Untitled painting"}
                  className="h-32 w-full object-cover sm:h-36 md:h-40"
                  loading="lazy"
                  draggable={false}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1 text-[11px] font-semibold text-white">
                  <span className="block truncate">
                    {painting.title || "Untitled"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {saving ? (
            <p className="text-xs text-neutral-500">Saving order…</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
