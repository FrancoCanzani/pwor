import { Cross2Icon } from "@radix-ui/react-icons";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  getCaptureHintSeen,
  getCaptureHintSeenServer,
  markCaptureHintSeen,
  subscribeCaptureHintSeen,
} from "@features/inbox/lib/capture-hint";

export function CaptureHint() {
  const seen = useSyncExternalStore(
    subscribeCaptureHintSeen,
    getCaptureHintSeen,
    getCaptureHintSeenServer,
  );

  if (seen) return null;

  return (
    <div className="group-data-[collapsible=icon]:hidden flex items-center justify-between gap-1 rounded-md bg-background px-2 py-1">
      <p className="flex items-center gap-1 text-[11px] leading-snug text-muted-foreground">
        Paste anywhere to capture. Or
        <Kbd>⌘U</Kbd>
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        className="size-4 text-muted-foreground hover:text-foreground [&_svg]:size-3"
        onClick={markCaptureHintSeen}
      >
        <Cross2Icon />
      </Button>
    </div>
  );
}
