import type { Editor, Range } from "@tiptap/core";
import { PICK_IMAGE_EVENT } from "../constants";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
  Square,
  Table2,
} from "lucide-react";
import type { ComponentType } from "react";

export type SlashItem = {
  name: string;
  label: string;
  aliases: string[];
  icon: ComponentType<{ className?: string }>;
  group: "turn into" | "insert";
  run: (editor: Editor, range: Range) => void;
};

function apply(editor: Editor, range: Range, run: (chain: ReturnType<Editor["chain"]>) => void) {
  const chain = editor.chain().focus().deleteRange(range);
  run(chain);
  chain.run();
}

export function slashItems(canUpload: boolean): SlashItem[] {
  const items: SlashItem[] = [
    {
      name: "paragraph",
      label: "Text",
      aliases: ["p", "plain"],
      icon: Pilcrow,
      group: "turn into",
      run: (editor, range) => apply(editor, range, (chain) => chain.setParagraph()),
    },
    {
      name: "heading1",
      label: "Heading 1",
      aliases: ["h1", "title"],
      icon: Heading1,
      group: "turn into",
      run: (editor, range) =>
        apply(editor, range, (chain) => chain.toggleHeading({ level: 1 })),
    },
    {
      name: "heading2",
      label: "Heading 2",
      aliases: ["h2"],
      icon: Heading2,
      group: "turn into",
      run: (editor, range) =>
        apply(editor, range, (chain) => chain.toggleHeading({ level: 2 })),
    },
    {
      name: "heading3",
      label: "Heading 3",
      aliases: ["h3"],
      icon: Heading3,
      group: "turn into",
      run: (editor, range) =>
        apply(editor, range, (chain) => chain.toggleHeading({ level: 3 })),
    },
    {
      name: "bulletList",
      label: "Bullet list",
      aliases: ["ul", "list"],
      icon: List,
      group: "turn into",
      run: (editor, range) => apply(editor, range, (chain) => chain.toggleBulletList()),
    },
    {
      name: "orderedList",
      label: "Numbered list",
      aliases: ["ol", "numbered"],
      icon: ListOrdered,
      group: "turn into",
      run: (editor, range) => apply(editor, range, (chain) => chain.toggleOrderedList()),
    },
    {
      name: "taskList",
      label: "To-do",
      aliases: ["todo", "task", "checkbox"],
      icon: ListTodo,
      group: "turn into",
      run: (editor, range) => apply(editor, range, (chain) => chain.toggleTaskList()),
    },
    {
      name: "blockquote",
      label: "Quote",
      aliases: ["quote"],
      icon: Quote,
      group: "turn into",
      run: (editor, range) => apply(editor, range, (chain) => chain.toggleBlockquote()),
    },
    {
      name: "codeBlock",
      label: "Code",
      aliases: ["code", "fence"],
      icon: Code2,
      group: "turn into",
      run: (editor, range) => apply(editor, range, (chain) => chain.toggleCodeBlock()),
    },
    {
      name: "callout",
      label: "Callout",
      aliases: ["aside", "note", "tip", "warning"],
      icon: Square,
      group: "insert",
      run: (editor, range) => apply(editor, range, (chain) => chain.setCallout("note")),
    },
    {
      name: "table",
      label: "Table",
      aliases: ["grid"],
      icon: Table2,
      group: "insert",
      run: (editor, range) =>
        apply(editor, range, (chain) =>
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
        ),
    },
    {
      name: "separator",
      label: "Divider",
      aliases: ["hr", "rule", "line"],
      icon: Minus,
      group: "insert",
      run: (editor, range) => apply(editor, range, (chain) => chain.setHorizontalRule()),
    },
  ];

  if (canUpload) {
    items.push({
      name: "image",
      label: "Image",
      aliases: ["img", "photo", "picture"],
      icon: ImageIcon,
      group: "insert",
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        editor.view.dom.dispatchEvent(new CustomEvent(PICK_IMAGE_EVENT));
      },
    });
  }

  return items;
}

export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.aliases.some((alias) => alias.includes(q)),
  );
}
