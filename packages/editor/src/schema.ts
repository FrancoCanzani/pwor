import { Extension, type AnyExtension, type Editor } from "@tiptap/core";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import UniqueID from "@tiptap/extension-unique-id";
import StarterKit from "@tiptap/starter-kit";
import { Tweet } from "./embed/tweet";
import { Youtube } from "./embed/youtube";
import { EditorLink } from "./link/mark";
import { mentionClickPlugin } from "./mention/click";
import { Mention } from "./mention/node";
import { MentionSuggestion } from "./mention/suggestion";
import { Callout } from "./nodes/callout";
import { EditorImage } from "./nodes/image";
import { PasteHandler } from "./paste/extension";
import { SlashCommand } from "./slash/extension";
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
  "horizontalRule",
  "image",
  "callout",
  "youtube",
  "tweet",
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
    EditorLink.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Callout,
    Mention,
    EditorImage.configure({ inline: false }),
    Youtube,
    Tweet,
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
    PasteHandler,
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
