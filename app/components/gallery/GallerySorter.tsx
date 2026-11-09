"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges, snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

export type GallerySortItem = {
  id: string;
  title: string;
  image_url: string;
};

type GallerySorterProps<T extends GallerySortItem> = {
  items: T[];
  disabled?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (nextItems: T[], previousItems: T[]) => void;
};

function SortableTile({
  id,
  title,
  imageUrl,
  onClick,
  disabled,
  isSelected,
}: {
  id: string;
  title: string;
  imageUrl: string;
  onClick: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={() => {
        if (isDragging) return;
        onClick();
      }}
      className={`group relative overflow-hidden rounded-lg border bg-white text-left shadow-sm ${
        isDragging ? "opacity-60" : ""
      } ${isSelected ? "ring-2 ring-sky-400" : "border-neutral-200"}`}
      {...attributes}
      {...listeners}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={title || "Untitled"}
        className="h-28 w-full object-cover sm:h-32 md:h-36"
        loading="lazy"
        draggable={false}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1 text-[11px] font-semibold text-white">
        <span className="block truncate">{title || "Untitled"}</span>
      </div>
    </button>
  );
}

export default function GallerySorter<T extends GallerySortItem>({
  items,
  disabled = false,
  selectedId,
  onSelect,
  onReorder,
}: GallerySorterProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const activeItem = activeId
    ? items.find((item) => item.id === activeId) || null
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over || over === active) return;

    const oldIndex = items.findIndex((item) => item.id === active);
    const newIndex = items.findIndex((item) => item.id === over);
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(items, oldIndex, newIndex), items);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[snapCenterToCursor, restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <SortableTile
              key={item.id}
              id={item.id}
              title={item.title}
              imageUrl={item.image_url}
              disabled={disabled}
              isSelected={selectedId === item.id}
              onClick={() => onSelect(item.id)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeItem.image_url}
              alt={activeItem.title || "Untitled"}
              className="h-28 w-36 object-cover sm:h-32 sm:w-44"
              draggable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
