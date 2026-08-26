import { Extension, type AnyExtension, type Editor } from "@tiptap/core";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table/kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import UniqueID from "@tiptap/extension-unique-id";
import StarterKit from "@tiptap/starter-kit";
import { Callout } from "./extensions/callout";
import { EditorImage } from "./extensions/image";
import { Mention } from "./extensions/mention";
import { mentionClickPlugin } from "./extensions/mention-click";
import { MentionSuggestion } from "./extensions/mention-suggestion";
import { SlashCommand } from "./extensions/slash-command";
import type { MentionSource, UploadImage } from "./types";

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const UNIQUE_ID_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "horizontalRule",
  "image",
  "callout",
];

function isImageFile(file: File): boolean {
  return IMAGE_MIMES.includes(file.type);
}

async function insertUploadedImages(
  editor: Editor,
  files: File[],
  pos: number | null,
  uploadImage: UploadImage,
): Promise<void> {
  let cursor = pos;
  for (const file of files) {
    if (!isImageFile(file)) continue;
    try {
      const { src } = await uploadImage(file);
      const content = { type: "image" as const, attrs: { src, alt: file.name } };
      if (cursor == null) {
        editor.chain().focus().insertContent(content).run();
      } else {
        editor.chain().focus().insertContentAt(cursor, content).run();
        cursor += 1;
      }
    } catch {
      // Host surfaces upload failure.
    }
  }
}

export type SchemaOptions = {
  placeholder?: string;
  uploadImage?: UploadImage;
  mentions?: MentionSource;
};

export function createDocumentSchema(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
      underline: false,
      dropcursor: {
        color: "color-mix(in oklch, var(--foreground) 35%, transparent)",
        width: 2,
      },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    TableKit.configure({
      table: { resizable: false },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Callout,
    Mention,
    EditorImage.configure({ inline: false }),
    UniqueID.configure({
      attributeName: "blockId",
      types: UNIQUE_ID_TYPES,
      generateID: () => crypto.randomUUID(),
    }),
  ];
}

export function createEditorExtensions(options: SchemaOptions = {}): AnyExtension[] {
  const { placeholder, uploadImage, mentions } = options;

  const extensions: AnyExtension[] = [
    ...createDocumentSchema(),
    Placeholder.configure({
      placeholder: placeholder ?? "Type '/' for commands",
      showOnlyCurrent: true,
    }),
    SlashCommand.configure({ canUpload: Boolean(uploadImage) }),
  ];

  if (mentions) {
    extensions.push(
      MentionSuggestion.configure({ source: mentions }),
      Extension.create({
        name: "mentionClick",
        addProseMirrorPlugins() {
          return [mentionClickPlugin(mentions)];
        },
      }),
    );
  }

  if (uploadImage) {
    extensions.push(
      FileHandler.configure({
        allowedMimeTypes: IMAGE_MIMES,
        onPaste: (editor, files) => {
          void insertUploadedImages(editor, files, null, uploadImage);
        },
        onDrop: (editor, files, pos) => {
          void insertUploadedImages(editor, files, pos, uploadImage);
        },
      }),
    );
  }

  return extensions;
}
