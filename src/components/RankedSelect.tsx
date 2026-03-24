"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  maxSelect: number;
  selected: string[];
  onChange: (rank: string[]) => void;
};

function SortableItem({ id, label, rank }: { id: string; label: string; rank: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="w-full text-left px-5 py-4 rounded-xl border-2 border-brand bg-brand-light text-sm flex items-center gap-3 touch-none cursor-grab active:cursor-grabbing"
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-brand"
      >
        {rank}
      </span>
      <span className="flex-1">{label}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400 flex-shrink-0">
        <path d="M4 6H12M4 10H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function RankedSelect({ options, maxSelect, selected, onChange }: Props) {
  const [mode, setMode] = useState<"select" | "reorder">(
    selected.length > 0 && selected.length >= maxSelect && !selected.includes("none") ? "reorder" : "select"
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleSelect = (val: string) => {
    if (val === "none") { onChange(["none"]); return; }
    let next: string[];
    if (selected.includes(val)) { next = selected.filter((v) => v !== val); }
    else {
      next = selected.filter((v) => v !== "none");
      if (next.length >= maxSelect) return;
      next.push(val);
    }
    onChange(next);
    if (next.length === maxSelect && !next.includes("none")) setMode("reorder");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selected.indexOf(active.id as string);
      const newIndex = selected.indexOf(over.id as string);
      onChange(arrayMove(selected, oldIndex, newIndex));
    }
  };

  if (mode === "select" || selected.length < maxSelect || selected.includes("none")) {
    return (
      <div className="space-y-3">
        {options.map((opt) => {
          const rankIdx = selected.indexOf(opt.value);
          const isSelected = rankIdx >= 0;
          const disabled = !isSelected && opt.value !== "none" && selected.filter((v) => v !== "none").length >= maxSelect;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={disabled}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-sm ${
                isSelected
                  ? "border-brand bg-brand-light"
                  : disabled
                  ? "border-gray-100 bg-gray-50 text-gray-400"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="flex items-center gap-3">
                {isSelected ? (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-brand"
                  >
                    {rankIdx + 1}
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
                )}
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const selectedOptions = selected.map((val) => options.find((o) => o.value === val)!).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">ドラッグして順番を変更できます</p>
        <button
          onClick={() => setMode("select")}
          className="text-xs px-4 py-2 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          選び直す
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={selected} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {selectedOptions.map((opt, idx) => (
              <SortableItem key={opt.value} id={opt.value} label={opt.label} rank={idx + 1} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
