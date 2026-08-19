import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCaptureComposer } from "@features/command/capture-composer-context";

export function CaptureButton() {
  const { open } = useCaptureComposer();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Capture"
            className="text-muted-foreground"
            onClick={() => open()}
          />
        }
      >
        <Plus />
      </TooltipTrigger>
      <TooltipContent>
        Capture
        <Kbd>⌘U</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
