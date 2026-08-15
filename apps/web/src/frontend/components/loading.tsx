import { UpdateIcon } from "@radix-ui/react-icons";

export function Loading() {
  return (
    <div className="flex h-full min-h-dvh w-full flex-1 items-center justify-center text-muted-foreground">
      <UpdateIcon className="size-[15px] animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
