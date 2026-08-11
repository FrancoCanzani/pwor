import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  updateVaultItem,
  vaultFileTextQueryOptions,
  vaultItemQueryOptions,
  vaultSheetQueryOptions,
  type VaultItem,
  type VaultItemDetail,
} from "@features/vault/api";
import { PdfViewer } from "@features/vault/components/pdf-viewer";
import { SheetViewer } from "@features/vault/components/sheet-viewer";
import { SnippetViewer } from "@features/vault/components/snippet-viewer";
import { isTextPreviewable } from "@features/vault/lib/preview";
import { isSheetPreviewable } from "@features/vault/lib/sheet";
import { inferLanguageFromContent } from "@shared/infer-language";
import {
  dedentCode,
  isRawCodeTitle,
  titleFromSnippet,
} from "@shared/snippet-format";

const SNIPPET_SAVE_MS = 500;

function TextPreview({
  content,
  downloadUrl,
}: {
  content: string | null;
  downloadUrl?: string;
}) {
  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <div className="flex shrink-0 justify-end gap-2">
        {downloadUrl ? (
          <Button variant="outline" render={<a href={downloadUrl} download />}>
            Download
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={!content}
          onClick={() => {
            if (!content) return;
            void navigator.clipboard.writeText(content);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {content !== null ? (
          <pre className="whitespace-pre-wrap text-sm text-foreground">
            {content}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function LinkPreview({
  item,
  content,
}: {
  item: VaultItem;
  content: string | null;
}) {
  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-auto">
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-muted-foreground underline"
        >
          {item.url}
        </a>
      ) : null}
      {item.summary ? (
        <p className="text-sm text-foreground">{item.summary}</p>
      ) : null}
      {item.tags && item.tags.length > 0 ? (
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </p>
      ) : null}
      {content ? (
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
          {content}
        </pre>
      ) : null}
    </div>
  );
}

export function VaultViewer({
  item,
  open,
  onOpenChange,
}: {
  item: VaultItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isTextItem = item.kind === "text";
  const isSnippet = item.kind === "snippet";
  const isLinkLike = item.kind === "link";
  const fileUrl = `/api/vault/${item.id}/file`;
  const isImage = item.mimeType?.startsWith("image/") ?? false;
  const isPdf = item.mimeType === "application/pdf";
  const isSheet =
    item.kind === "file" && isSheetPreviewable(item.mimeType, item.title);
  const isTextFile =
    item.kind === "file" &&
    !isSheet &&
    isTextPreviewable(item.mimeType, item.title);

  const { data: detail, isPending: detailPending } = useQuery({
    ...vaultItemQueryOptions(item.id),
    enabled: open && (isTextItem || isLinkLike || isSnippet),
  });

  const { data: fileText, isPending: textPending } = useQuery({
    ...vaultFileTextQueryOptions(item.id),
    enabled: open && isTextFile,
  });

  const {
    data: workbook,
    isError: sheetError,
    isPending: sheetPending,
  } = useQuery({
    ...vaultSheetQueryOptions(item.id),
    enabled: open && isSheet,
  });

  const textContent =
    isTextItem
      ? (detail?.content?.trim() || null)
      : isSnippet
        ? (detail?.content ?? null)
        : isLinkLike
          ? (detail?.content?.trim() ||
            detail?.extractedMarkdown?.trim() ||
            null)
          : (fileText ?? null);

  const displayItem = detail
    ? {
        ...item,
        title: detail.title ?? item.title,
        summary: detail.summary ?? item.summary,
        tags: detail.tags ?? item.tags,
        url: detail.url ?? item.url,
        language: detail.language ?? item.language,
      }
    : item;

  const [titleDraft, setTitleDraft] = useState("");
  const [snippetContent, setSnippetContent] = useState<string | null>(null);
  const [snippetLanguage, setSnippetLanguage] = useState<string | null>(null);
  const savedTitleRef = useRef("");
  const savedContentRef = useRef("");
  const savedLanguageRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const repairedIdRef = useRef<string | null>(null);

  const saveSnippet = useMutation({
    mutationFn: (patch: {
      title?: string | null;
      content?: string;
      language?: string | null;
    }) => updateVaultItem(item.id, patch),
    onSuccess: (updated) => {
      savedTitleRef.current = updated.title ?? "";
      savedContentRef.current = updated.content ?? "";
      savedLanguageRef.current = updated.language;
      dirtyRef.current = false;
      queryClient.setQueryData(
        vaultItemQueryOptions(item.id).queryKey,
        (current: VaultItemDetail | undefined) =>
          current
            ? {
                ...current,
                ...updated,
                content: updated.content ?? current.content,
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["vault", "items"] });
    },
    onError: () => toast.error("Couldn’t save snippet"),
  });
  const saveSnippetMutate = saveSnippet.mutate;
  const saveSnippetMutateRef = useRef(saveSnippetMutate);
  saveSnippetMutateRef.current = saveSnippetMutate;

  useEffect(() => {
    if (!open || !isSnippet) {
      dirtyRef.current = false;
      repairedIdRef.current = null;
      setSnippetContent(null);
      return;
    }
    if (detailPending || textContent === null) return;
    if (dirtyRef.current) return;

    const normalizedContent = dedentCode(textContent);
    const inferredLanguage = inferLanguageFromContent(normalizedContent);
    const storedLanguage = displayItem.language;
    let nextLanguage = storedLanguage ?? inferredLanguage;
    if (inferredLanguage) {
      if (!storedLanguage) {
        nextLanguage = inferredLanguage;
      } else if (
        storedLanguage === "html" &&
        (inferredLanguage === "jsx" || inferredLanguage === "tsx")
      ) {
        nextLanguage = inferredLanguage;
      } else if (
        storedLanguage === "javascript" &&
        inferredLanguage === "jsx"
      ) {
        nextLanguage = inferredLanguage;
      } else if (
        storedLanguage === "typescript" &&
        inferredLanguage === "tsx"
      ) {
        nextLanguage = inferredLanguage;
      }
    }

    const storedTitle = displayItem.title ?? "";
    const nextTitle = isRawCodeTitle(storedTitle, normalizedContent)
      ? titleFromSnippet(normalizedContent, nextLanguage)
      : storedTitle;

    setTitleDraft(nextTitle);
    setSnippetContent(normalizedContent);
    setSnippetLanguage(nextLanguage);
    savedTitleRef.current = nextTitle;
    savedContentRef.current = normalizedContent;
    savedLanguageRef.current = nextLanguage;

    if (repairedIdRef.current === item.id) return;
    repairedIdRef.current = item.id;

    const patch: {
      title?: string | null;
      content?: string;
      language?: string | null;
    } = {};
    if (nextTitle !== storedTitle) patch.title = nextTitle;
    if (normalizedContent !== textContent) patch.content = normalizedContent;
    if (nextLanguage !== storedLanguage) patch.language = nextLanguage;
    if (Object.keys(patch).length > 0) {
      saveSnippetMutateRef.current(patch);
    }
  }, [
    open,
    isSnippet,
    detailPending,
    item.id,
    displayItem.title,
    displayItem.language,
    textContent,
  ]);

  function scheduleSnippetSave(next: {
    title?: string;
    content?: string;
    language?: string | null;
  }) {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const title = next.title ?? titleDraft;
      const content = next.content ?? snippetContent ?? "";
      const language =
        next.language !== undefined ? next.language : snippetLanguage;
      const patch: {
        title?: string | null;
        content?: string;
        language?: string | null;
      } = {};
      if (title !== savedTitleRef.current) {
        patch.title = title.trim() || "Snippet";
      }
      if (content !== savedContentRef.current) {
        patch.content = content;
      }
      if (language !== savedLanguageRef.current) {
        patch.language = language;
      }
      if (Object.keys(patch).length === 0) {
        dirtyRef.current = false;
        return;
      }
      saveSnippet.mutate(patch);
    }, SNIPPET_SAVE_MS);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const showLoading =
    ((isTextItem || isLinkLike || isSnippet) && detailPending) ||
    (isTextFile && textPending) ||
    (isSheet && sheetPending && !sheetError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[calc(100%-2rem)] overflow-hidden",
          isSheet ? "gap-2 p-2 sm:max-w-5xl" : "sm:max-w-3xl",
        )}
      >
        <DialogHeader className="min-w-0">
          {isSnippet ? (
            <>
              <DialogTitle className="sr-only">
                {titleDraft.trim() || "Snippet"}
              </DialogTitle>
              <Input
                value={titleDraft}
                onChange={(event) => {
                  const next = event.target.value;
                  setTitleDraft(next);
                  scheduleSnippetSave({ title: next });
                }}
                onBlur={() => {
                  const next = titleDraft.trim() || "Snippet";
                  if (next !== titleDraft) setTitleDraft(next);
                  scheduleSnippetSave({ title: next });
                }}
                placeholder="Snippet title"
                className="h-8 pr-8 text-sm font-normal"
                aria-label="Snippet title"
              />
            </>
          ) : (
            <DialogTitle className="truncate pr-8">
              {displayItem.title ?? "Untitled"}
            </DialogTitle>
          )}
        </DialogHeader>

        {showLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : isSnippet ? (
          snippetContent !== null ? (
            <SnippetViewer
              content={snippetContent}
              language={snippetLanguage}
              onContentChange={(next) => {
                setSnippetContent(next);
                scheduleSnippetSave({ content: next });
              }}
              onLanguageChange={(next) => {
                setSnippetLanguage(next);
                scheduleSnippetSave({ language: next });
              }}
            />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )
        ) : isLinkLike ? (
          <LinkPreview item={displayItem} content={textContent} />
        ) : isTextItem || isTextFile ? (
          <TextPreview
            content={textContent}
            downloadUrl={isTextFile ? fileUrl : undefined}
          />
        ) : isSheet ? (
          sheetError ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">
                Couldn't preview this sheet.{" "}
                <a href={fileUrl} download className="underline">
                  Download it instead
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="h-[70vh] min-w-0 overflow-hidden">
              <SheetViewer
                key={item.id}
                workbook={workbook}
                downloadUrl={fileUrl}
              />
            </div>
          )
        ) : isPdf ? (
          <PdfViewer key={item.id} fileUrl={fileUrl} />
        ) : isImage ? (
          <div className="flex h-[70vh] items-center justify-center overflow-auto">
            <img
              src={fileUrl}
              alt={item.title ?? "Vault file"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-[40vh] flex-col items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No preview available for this file.{" "}
              <a href={fileUrl} download className="underline">
                Download it instead
              </a>
              .
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
