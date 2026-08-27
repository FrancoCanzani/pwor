import { cn } from "../cn";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export function EmbedUrlField({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (value: string) => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = inputRef.current?.value ?? "";
    setInvalid(!onSubmit(value));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      inputRef.current?.blur();
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        aria-invalid={invalid}
        onKeyDown={onKeyDown}
        onChange={() => setInvalid(false)}
        className={cn(
          "w-full bg-transparent text-xs font-normal outline-none placeholder:text-muted-foreground",
          invalid ? "text-destructive" : "text-foreground",
        )}
      />
    </form>
  );
}
