import { useMutation } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  type CalendarEvent,
} from "@features/calendar/api";

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  onCreated,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  defaultDate: string | null;
  onCreated: (event: CalendarEvent) => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setDate(format(new Date(event.startAt), "yyyy-MM-dd"));
      setTime(event.allDay ? "" : format(new Date(event.startAt), "HH:mm"));
    } else {
      setTitle("");
      setDate(format(defaultDate ? new Date(defaultDate) : new Date(), "yyyy-MM-dd"));
      setTime("");
    }
  }, [open, event, defaultDate]);

  function buildStart(): { startAt: string; allDay: boolean } {
    const startAt = new Date(`${date}T${time || "12:00"}`);
    return { startAt: startAt.toISOString(), allDay: time === "" };
  }

  const create = useMutation({
    mutationFn: () =>
      createEvent({ title: title.trim(), ...buildStart(), workspaceId }),
    onSuccess: (created) => {
      onCreated(created);
      onOpenChange(false);
    },
  });

  const save = useMutation({
    mutationFn: () =>
      updateEvent(event!.id, { title: title.trim(), ...buildStart() }),
    onSuccess: (saved) => {
      onSaved(saved);
      onOpenChange(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteEvent(event!.id),
    onSuccess: () => {
      onDeleted(event!.id);
      onOpenChange(false);
    },
  });

  const pending = create.isPending || save.isPending || remove.isPending;

  function handleSubmit(submitEvent: SubmitEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!title.trim() || !date || pending) return;
    if (event) save.mutate();
    else create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's happening?"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
              className="flex-1"
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={pending}
              className="w-28"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave the time empty for an all-day event.
          </p>
          {create.isError || save.isError || remove.isError ? (
            <p className="text-xs text-destructive">Couldn’t save event.</p>
          ) : null}
          <DialogFooter className="-mx-0 -mb-0 flex-row justify-between border-0 bg-transparent p-0">
            {event ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => remove.mutate()}
                disabled={pending}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || !date || pending}>
                {event ? "Save" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
