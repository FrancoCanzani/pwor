import { useMutation } from "@tanstack/react-query";
import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      setMessage("");
      onOpenChange(false);
      toast.success("Sent");
    },
    onError: () => toast.error("Couldn’t send feedback"),
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || send.isPending) return;
    send.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setMessage("");
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
          </DialogHeader>
          <Textarea
            id="feedback-message"
            aria-label="Message"
            autoFocus
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="A bug, an idea, anything…"
            disabled={send.isPending}
            className="min-h-32 resize-none"
          />
          <DialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!message.trim() || send.isPending}
            >
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
