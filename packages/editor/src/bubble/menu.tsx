import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Quote,
  SquareCode,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { cn } from "../cn";
import { ICON, IconButton, LinkControl, LinkHoverPreview, useResetOnSelection } from "./link";

type BlockType = {
  name: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const blockTypes: BlockType[] = [
  {
    name: "paragraph",
    label: "Text",
    icon: Pilcrow,
    isActive: (editor) => editor.isActive("paragraph") && !editor.isActive("listItem") && !editor.isActive("taskItem"),
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    name: "heading1",
    label: "Heading 1",
    icon: Heading1,
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: "heading2",
    label: "Heading 2",
    icon: Heading2,
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: "heading3",
    label: "Heading 3",
    icon: Heading3,
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    name: "bulletList",
    label: "Bullet list",
    icon: List,
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    name: "orderedList",
    label: "Numbered list",
    icon: ListOrdered,
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "taskList",
    label: "To-do",
    icon: ListTodo,
    isActive: (editor) => editor.isActive("taskList"),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    name: "blockquote",
    label: "Quote",
    icon: Quote,
    isActive: (editor) => editor.isActive("blockquote"),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    name: "codeBlock",
    label: "Code",
    icon: SquareCode,
    isActive: (editor) => editor.isActive("codeBlock"),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

const marks = [
  {
    name: "bold",
    icon: Bold,
    isActive: (editor: Editor) => editor.isActive("bold"),
    run: (editor: Editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    icon: Italic,
    isActive: (editor: Editor) => editor.isActive("italic"),
    run: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    name: "underline",
    icon: Underline,
    isActive: (editor: Editor) => editor.isActive("underline"),
    run: (editor: Editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    icon: Strikethrough,
    isActive: (editor: Editor) => editor.isActive("strike"),
    run: (editor: Editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    name: "code",
    icon: Code,
    isActive: (editor: Editor) => editor.isActive("code"),
    run: (editor: Editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    name: "highlight",
    icon: Highlighter,
    isActive: (editor: Editor) => editor.isActive("highlight"),
    run: (editor: Editor) => editor.chain().focus().toggleHighlight().run(),
  },
] as const;

const menuChrome =
  "z-50 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5";

function preserveSelection(event: { target: EventTarget; preventDefault: () => void }) {
  if (event.target instanceof HTMLInputElement) return;
  event.preventDefault();
}

function BlockTypeMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  useResetOnSelection(editor, () => setOpen(false));
  const current =
    blockTypes.find((type) => type.isActive(editor)) ?? blockTypes[0]!;
  const CurrentIcon = current.icon;

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-6 items-center gap-1 rounded-sm px-1 text-xs font-normal hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentIcon className={ICON} />
        <span>{current.label}</span>
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-10 mt-1 min-w-36 rounded-md border border-border bg-background py-1">
          {blockTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.name}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1 text-left text-xs font-normal hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground",
                  type.isActive(editor) ? "bg-muted" : "bg-transparent",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  type.run(editor);
                  setOpen(false);
                }}
              >
                <Icon className={cn(ICON, "text-muted-foreground")} />
                {type.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function shouldShowSelection({ editor }: { editor: Editor }): boolean {
  if (editor.isDestroyed || !editor.isEditable) return false;
  const { selection } = editor.state;
  if (selection.empty) return false;
  if (editor.isActive("image")) return false;
  if (editor.isActive("youtube")) return false;
  if (editor.isActive("tweet")) return false;
  return true;
}

export function EditorBubble({ editor }: { editor: Editor }) {
  const marksState = useEditorState({
    editor,
    selector: (ctx) =>
      Object.fromEntries(marks.map((mark) => [mark.name, mark.isActive(ctx.editor)])),
  });

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={shouldShowSelection}
        options={{ placement: "top", offset: 8 }}
        className={menuChrome}
        onMouseDown={preserveSelection}
      >
        <BlockTypeMenu editor={editor} />
        <span className="mx-0.5 h-4 w-px bg-border" />
        {marks.map((mark) => {
          const Icon = mark.icon;
          return (
            <IconButton
              key={mark.name}
              label={mark.name}
              active={Boolean(marksState[mark.name])}
              onClick={() => mark.run(editor)}
            >
              <Icon className={ICON} />
            </IconButton>
          );
        })}
        <span className="mx-0.5 h-4 w-px bg-border" />
        <LinkControl editor={editor} />
      </BubbleMenu>
      <LinkHoverPreview editor={editor} />
    </>
  );
}
