import { UpdateIcon } from "@radix-ui/react-icons";

export function Loading() {
  return (
    <div className="flex items-center justify-center px-5 pt-10 text-muted-foreground">
      <UpdateIcon className="size-[15px] animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
