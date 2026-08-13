import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { useCreateDialog } from "@features/command/create-dialog-context";

export function CaptureButton({ className }: { className?: string }) {
  const { open } = useCreateDialog();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("shrink-0 font-normal", className)}
      onClick={() => open()}
    >
      Capture
      <Kbd>⌘U</Kbd>
    </Button>
  );
}
