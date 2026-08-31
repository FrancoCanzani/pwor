import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { ExternalLink, Link2, Pencil, Unlink } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";
import { openHref } from "../link/click";
import { displayHref, normalizeHref } from "../link/href";

const ICON = "size-3";
const SHOW_MS = 280;
const HIDE_MS = 150;

function applyHref(editor: Editor, value: string): boolean {
  const href = normalizeHref(value);
  if (href === null) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return true;
  }
  return editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

function selectLinkAt(editor: Editor, pos: number) {
  editor.chain().focus().setTextSelection(pos).extendMarkRange("link").run();
}

export function useResetOnSelection(editor: Editor, reset: () => void) {
  const selection = useEditorState({
    editor,
    selector: (ctx) => {
      const { from, to } = ctx.editor.state.selection;
      return `${from}:${to}`;
    },
  });
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    resetRef.current();
  }, [selection]);
}

function IconButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-sm font-normal text-foreground hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground",
        active ? "bg-muted" : "bg-transparent",
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function LinkForm({
  value,
  onChange,
  onApply,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onApply();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }

  return (
    <form
      className="flex w-56 gap-1 rounded-md border border-border bg-background p-1"
      onSubmit={submit}
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="https://"
        className="h-6 min-w-0 flex-1 bg-transparent px-1 text-xs outline-none"
      />
      <button
        type="submit"
        className="h-6 px-1.5 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground"
      >
        Apply
      </button>
    </form>
  );
}

export function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const active = editor.isActive("link");
  useResetOnSelection(editor, () => {
    setOpen(false);
    setValue("");
  });

  function apply() {
    if (!applyHref(editor, value)) return;
    setOpen(false);
  }

  return (
    <div className="relative">
      <IconButton
        active={active || open}
        label="Link"
        onClick={() => {
          setValue(
            typeof editor.getAttributes("link").href === "string"
              ? editor.getAttributes("link").href
              : "",
          );
          setOpen((current) => !current);
        }}
      >
        <Link2 className={ICON} />
      </IconButton>
      {open ? (
        <div className="absolute top-full left-0 z-10 mt-1">
          <LinkForm
            value={value}
            onChange={setValue}
            onApply={apply}
            onCancel={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function LinkChip({
  editor,
  href,
  pos,
  onClose,
}: {
  editor: Editor;
  href: string;
  pos: number;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(href);

  function apply() {
    selectLinkAt(editor, pos);
    if (!applyHref(editor, value)) return;
    setEditing(false);
    onClose();
  }

  if (editing) {
    return (
      <LinkForm
        value={value}
        onChange={setValue}
        onApply={apply}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="max-w-48 truncate px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (href.length > 0) openHref(href);
        }}
      >
        {href.length > 0 ? displayHref(href) : "Link"}
      </button>
      <IconButton
        label="Edit link"
        onClick={() => {
          selectLinkAt(editor, pos);
          setValue(href);
          setEditing(true);
        }}
      >
        <Pencil className={ICON} />
      </IconButton>
      <IconButton
        label="Remove link"
        onClick={() => {
          selectLinkAt(editor, pos);
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          onClose();
        }}
      >
        <Unlink className={ICON} />
      </IconButton>
      {href.length > 0 ? (
        <IconButton label="Open link" onClick={() => openHref(href)}>
          <ExternalLink className={ICON} />
        </IconButton>
      ) : null}
    </div>
  );
}

type HoverTarget = {
  href: string;
  pos: number;
  rect: DOMRect;
};

export function LinkHoverPreview({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);

  function clearTimers() {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }

  function hide() {
    clearTimers();
    anchorRef.current = null;
    setTarget(null);
  }

  useEffect(() => {
    const dom = editor.view.dom;

    function scheduleShow(anchor: HTMLAnchorElement) {
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => {
        if (editor.isDestroyed) return;
        const href = anchor.getAttribute("href") ?? "";
        let pos = 0;
        try {
          pos = editor.view.posAtDOM(anchor, 0);
        } catch {
          return;
        }
        anchorRef.current = anchor;
        setTarget({ href, pos, rect: anchor.getBoundingClientRect() });
      }, SHOW_MS);
    }

    function scheduleHide() {
      window.clearTimeout(showTimer.current);
      hideTimer.current = window.setTimeout(() => {
        anchorRef.current = null;
        setTarget(null);
      }, HIDE_MS);
    }

    function onOver(event: MouseEvent) {
      const node = event.target;
      if (!(node instanceof Element)) return;
      if (chipRef.current?.contains(node)) {
        window.clearTimeout(hideTimer.current);
        return;
      }
      const anchor = node.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && dom.contains(anchor)) {
        scheduleShow(anchor);
      }
    }

    function onOut(event: MouseEvent) {
      const related = event.relatedTarget;
      if (related instanceof Node && chipRef.current?.contains(related)) return;
      const node = event.target;
      if (node instanceof Element && node.closest("a[href]")) scheduleHide();
    }

    dom.addEventListener("mouseover", onOver);
    dom.addEventListener("mouseout", onOut);
    return () => {
      clearTimers();
      dom.removeEventListener("mouseover", onOver);
      dom.removeEventListener("mouseout", onOut);
    };
  }, [editor]);

  const shown = target !== null;

  useEffect(() => {
    if (!shown) return;
    function sync() {
      const el = anchorRef.current;
      if (!el?.isConnected) {
        anchorRef.current = null;
        setTarget(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setTarget((current) =>
        current ? { ...current, rect } : current,
      );
    }
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [shown]);

  if (!target) return null;

  return createPortal(
    <div
      ref={chipRef}
      className="z-50 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5"
      style={{
        position: "fixed",
        top: target.rect.bottom + 6,
        left: target.rect.left,
      }}
      onMouseEnter={() => window.clearTimeout(hideTimer.current)}
      onMouseLeave={hide}
    >
      <LinkChip
        editor={editor}
        href={target.href}
        pos={target.pos}
        onClose={hide}
      />
    </div>,
    document.body,
  );
}

export { IconButton, ICON };
