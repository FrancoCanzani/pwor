import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateDialog } from "@features/command/create-dialog-context";

/** Opens the shared create dialog in capture mode, scoped to a vault category. */
export function VaultNewButton({
  categoryId,
  className,
}: {
  categoryId?: string | null;
  className?: string;
}) {
  const { open } = useCreateDialog();

  return (
    <Button
      type="button"
      variant="new"
      className={cn(
        "h-auto px-1.5 py-1 text-xs leading-none font-normal",
        className,
      )}
      onClick={() => open({ mode: "capture", categoryId: categoryId ?? null })}
    >
      New
    </Button>
  );
}
