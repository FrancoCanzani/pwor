import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { EditorBubble } from "./bubble/menu";
import { cn } from "./cn";
import { PICK_IMAGE_EVENT } from "./lib/pick-image";
import { documentsEqual, isDocumentJSON, type DocumentJSON } from "./document";
import { createEditorExtensions } from "./schema";
import type { DocumentEditorProps } from "./types";

function emitDocument(
  editor: Editor,
  baseline: DocumentJSON,
  onChange: (doc: DocumentJSON) => void,
): DocumentJSON | null {
  const json = editor.getJSON();
  if (!isDocumentJSON(json)) return null;
  if (documentsEqual(json, baseline)) return null;
  onChange(json);
  return json;
}

export function DocumentEditor({
  initialDocument,
  onChange,
  placeholder,
  uploadImage,
  mentions,
  autoFocus = true,
  className,
  editable = true,
}: DocumentEditorProps) {
  const onChangeRef = useRef(onChange);
  const uploadImageRef = useRef(uploadImage);
  const mentionsRef = useRef(mentions);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baselineRef = useRef(initialDocument);
  onChangeRef.current = onChange;
  uploadImageRef.current = uploadImage;
  mentionsRef.current = mentions;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    content: initialDocument,
    extensions: createEditorExtensions({
      placeholder,
      uploadImage: uploadImage
        ? (file) => uploadImageRef.current!(file)
        : undefined,
      mentions: mentions
        ? {
            items: (query) => mentionsRef.current!.items(query),
            onOpen: (item) => mentionsRef.current?.onOpen?.(item),
          }
        : undefined,
    }),
    onUpdate: ({ editor: instance, transaction }) => {
      if (!transaction.docChanged) return;
      const next = emitDocument(
        instance,
        baselineRef.current,
        onChangeRef.current,
      );
      if (next) baselineRef.current = next;
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || !uploadImage) return;
    const dom = editor.view.dom;
    function onPick() {
      fileInputRef.current?.click();
    }
    dom.addEventListener(PICK_IMAGE_EVENT, onPick);
    return () => {
      dom.removeEventListener(PICK_IMAGE_EVENT, onPick);
    };
  }, [editor, uploadImage]);

  async function onFile(files: FileList | null) {
    const upload = uploadImageRef.current;
    const instance = editor;
    if (!upload || !instance || !files) return;
    for (const file of Array.from(files)) {
      try {
        const { src } = await upload(file);
        instance.chain().focus().setImage({ src, alt: file.name }).run();
      } catch {
        // Host surfaces upload failure.
      }
    }
  }

  if (!editor) return <div className={cn("pwor-editor", className)} />;

  return (
    <div className={cn("pwor-editor", className)} data-note-editor="">
      {uploadImage ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => {
            void onFile(event.target.files);
            event.target.value = "";
          }}
        />
      ) : null}
      {editable ? <EditorBubble editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
