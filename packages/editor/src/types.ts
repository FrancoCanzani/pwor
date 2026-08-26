import type { DocumentJSON } from "./document";

export type MentionItem = {
  id: string;
  label: string;
};

export type MentionSource = {
  items: (query: string) => readonly MentionItem[] | Promise<readonly MentionItem[]>;
  onOpen?: (item: MentionItem) => void;
};

export type UploadImage = (file: File) => Promise<{ src: string }>;

export type DocumentEditorProps = {
  initialDocument: DocumentJSON;
  onChange: (doc: DocumentJSON) => void;
  placeholder?: string;
  uploadImage?: UploadImage;
  mentions?: MentionSource;
  autoFocus?: boolean;
  className?: string;
  editable?: boolean;
};
