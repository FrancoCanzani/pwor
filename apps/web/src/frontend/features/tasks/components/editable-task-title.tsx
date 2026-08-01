import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Task } from "@features/tasks/api";

export function EditableTaskTitle({
  task,
  onSave,
  className,
}: {
  task: Task;
  onSave: (title: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(task.title);
  }, [task.title]);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  function commit() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === task.title) {
      setValue(task.title);
      return;
    }
    onSave(next);
  }

  function cancel() {
    setValue(task.title);
    setEditing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "h-auto rounded-sm border-border px-1.5 py-0.5 text-sm font-normal shadow-none",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "min-w-0 truncate text-left text-sm font-normal leading-snug",
        task.status === "done" && "text-muted-foreground line-through",
        task.status === "dismissed" && "text-muted-foreground",
        className,
      )}
      onDoubleClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        setEditing(true);
      }}
      onPointerDown={(event) => {
        // Allow double-click; don't start a drag from the title control.
        if (event.detail > 1) event.stopPropagation();
      }}
      title="Double-click to edit"
    >
      {task.title}
    </button>
  );
}
