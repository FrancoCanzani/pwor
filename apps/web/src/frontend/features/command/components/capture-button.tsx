import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useCaptureComposer } from "@features/command/capture-composer-context";
import { useCommandPalette } from "@features/command/command-palette-context";

const segment =
  "h-full flex-1 gap-1 rounded-none border-0 bg-transparent px-2 text-background shadow-none hover:bg-white/10 hover:text-background active:bg-white/10 active:text-background";

const shortcut = "bg-white/15 text-background";

export function CaptureButton() {
  const { open: openCapture } = useCaptureComposer();
  const { open: openSearch } = useCommandPalette();

  return (
    <div className="flex h-8 w-full overflow-hidden rounded-lg bg-gradient-to-b from-foreground/80 to-foreground shadow-[0_1px_2px_rgb(0_0_0/0.28),inset_0_1px_0_rgb(255_255_255/0.16)]">
      <Button
        type="button"
        variant="ghost"
        className={segment}
        onClick={() => openCapture()}
      >
        Capture
        <Kbd className={shortcut}>⌘U</Kbd>
      </Button>
      <span className="w-px shrink-0 self-stretch bg-white/20" />
      <Button
        type="button"
        variant="ghost"
        className={segment}
        onClick={() => openSearch()}
      >
        Search
        <Kbd className={shortcut}>⌘K</Kbd>
      </Button>
    </div>
  );
}
