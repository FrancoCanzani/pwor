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
import { eventRangeDays } from "@features/calendar/lib/month";

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
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("");
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      const { start, end } = eventRangeDays(event);
      setDate(format(start, "yyyy-MM-dd"));
      setEndDate(
        event.allDay &&
          event.endAt &&
          format(end, "yyyy-MM-dd") !== format(start, "yyyy-MM-dd")
          ? format(end, "yyyy-MM-dd")
          : "",
      );
      setTime(event.allDay ? "" : format(new Date(event.startAt), "HH:mm"));
    } else {
      setTitle("");
      setDate(format(defaultDate ? new Date(defaultDate) : new Date(), "yyyy-MM-dd"));
      setEndDate("");
      setTime("");
    }
  }, [open, event, defaultDate]);

  const allDay = time === "";

  function buildPayload(): {
    title: string;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
  } {
    if (allDay && endDate && endDate !== date) {
      const startDay = date <= endDate ? date : endDate;
      const endDay = date <= endDate ? endDate : date;
      return {
        title: title.trim(),
        startAt: new Date(`${startDay}T12:00`).toISOString(),
        endAt: new Date(`${endDay}T12:00`).toISOString(),
        allDay: true,
      };
    }
    return {
      title: title.trim(),
      startAt: new Date(`${date}T${time || "12:00"}`).toISOString(),
      endAt: null,
      allDay,
    };
  }

  const create = useMutation({
    mutationFn: () =>
      createEvent({ ...buildPayload(), workspaceId }),
    onSuccess: (created) => {
      onCreated(created);
      onOpenChange(false);
    },
  });

  const save = useMutation({
    mutationFn: () => updateEvent(event!.id, buildPayload()),
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
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="event-start-date"
              className="text-xs text-muted-foreground"
            >
              Start date
            </label>
            <div className="flex gap-2">
              <Input
                id="event-start-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={pending}
                className="min-w-0 flex-1"
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  if (e.target.value !== "") setEndDate("");
                }}
                disabled={pending}
                className="w-28 shrink-0"
                aria-label="Time"
              />
            </div>
          </div>
          {allDay ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="event-end-date"
                className="text-xs text-muted-foreground"
              >
                End date
              </label>
              <Input
                id="event-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={pending}
                className="min-w-0 w-full"
                min={date || undefined}
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {allDay
              ? "Leave end empty for a single day. Empty time = all day."
              : "Empty time = all day."}
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
