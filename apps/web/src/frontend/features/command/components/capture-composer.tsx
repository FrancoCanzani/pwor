import { Dialog } from "@base-ui/react/dialog";
import { CaretDownIcon, Cross2Icon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { CaptureDraft } from "@features/command/capture-composer-context";
import {
  captureHost,
  captureRequest,
  cycleDestination,
  destinationFromKey,
  destinationKey,
  destinationLabel,
  isCaptureUrl,
  type CaptureDestination,
} from "@features/command/lib/capture";
import { useCaptureFeedback } from "@features/command/lib/use-capture-feedback";
import { captureItemInput, uploadItem, type Item } from "@features/items/api";
import {
  RecordButton,
  RecordingMeter,
  useAudioRecorder,
} from "@features/items/components/audio-recorder";
import { SpacePic } from "@features/spaces/components/space-pic";
import { workspacesQueryOptions } from "@features/workspaces/api";

export function CaptureComposer({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CaptureDraft | null;
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dest, setDest] = useState<CaptureDestination>({ kind: "inbox" });
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);
  const consumedDraft = useRef<CaptureDraft | null>(null);
  const { workspaceId: routeWorkspaceId } = useParams({ strict: false });
  const { data: spaces = [] } = useQuery(workspacesQueryOptions);
  const { notifySaved, invalidateItems, savedLabel } = useCaptureFeedback();

  const spaceIds = spaces.map((space) => space.id);
  const saveFilesRef = useRef<(queued: File[]) => void>(() => {});

  const {
    recording,
    paused,
    stream,
    start,
    pause,
    resume,
    commit,
    discard,
    elapsedRef,
  } = useAudioRecorder({
    onRecorded: (file) => saveFilesRef.current([file]),
  });

  useEffect(() => {
    if (!open) {
      setInput("");
      setFiles([]);
      setClipboardUrl(null);
      setDragging(false);
      discard();
      consumedDraft.current = null;
      busyRef.current = false;
      return;
    }

    setDest(
      routeWorkspaceId
        ? { kind: "space", id: routeWorkspaceId }
        : { kind: "inbox" },
    );
  }, [discard, open, routeWorkspaceId]);

  useEffect(() => {
    if (!open || !draft || consumedDraft.current === draft) return;
    consumedDraft.current = draft;
    if (draft.input) {
      setInput(draft.input);
      setClipboardUrl(null);
    }
    if (draft.files?.length) {
      setFiles((current) => [...current, ...draft.files!]);
    }
  }, [draft, open]);

  useEffect(() => {
    if (!open || draft?.input) return;
    let cancelled = false;
    void navigator.clipboard
      .readText()
      .then((text) => {
        if (cancelled || !isCaptureUrl(text)) return;
        setClipboardUrl((current) => current ?? text.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draft?.input, open]);

  const host = captureHost(input);
  const suggestion =
    clipboardUrl && !input.trim() && files.length === 0 ? clipboardUrl : null;
  const canSave = Boolean(input.trim() || files.length > 0 || suggestion);

  function addFiles(list: File[]) {
    if (list.length === 0) return;
    setFiles((current) => [...current, ...list]);
  }

  async function commitTextAndFiles(text: string, queued: File[]) {
    if (busyRef.current) return;
    if (!text && queued.length === 0) return;
    busyRef.current = true;
    onOpenChange(false);
    const request = captureRequest(dest);
    const fileWorkspace = request.autoSpace ? null : request.workspaceId;
    const created: Item[] = [];
    try {
      if (text) {
        created.push(
          await captureItemInput(text, request.workspaceId, {
            autoSpace: request.autoSpace,
          }),
        );
      }
      for (const file of queued) {
        created.push(await uploadItem(file, fileWorkspace));
      }
      await invalidateItems();
      notifySaved(savedLabel(created, destinationLabel(dest, spaces), spaces), created);
    } catch {
      toast.error("Couldn’t capture");
    } finally {
      busyRef.current = false;
    }
  }

  saveFilesRef.current = (queued) => {
    void commitTextAndFiles("", queued);
  };

  function save() {
    if (recording) {
      commit();
      return;
    }
    const text = input.trim() || suggestion || "";
    void commitTextAndFiles(text, files);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Tab") {
      event.preventDefault();
      setDest((current) =>
        cycleDestination(current, spaceIds, event.shiftKey ? -1 : 1),
      );
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !recording &&
      !input.includes("\n")
    ) {
      event.preventDefault();
      save();
    }
  }

  function onTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Backspace") return;
    if (input.length > 0) return;
    if (event.currentTarget.selectionStart !== 0) return;
    if (files.length === 0) return;
    event.preventDefault();
    setFiles((current) => current.slice(0, -1));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = Array.from(event.clipboardData.files ?? []);
    if (pasted.length === 0) return;
    event.preventDefault();
    addFiles(pasted);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) discard();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-lg",
            dragging && "ring-foreground/30",
          )}
          onKeyDown={onKeyDown}
          onDragEnter={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) {
              return;
            }
            setDragging(false);
          }}
          onDrop={onDrop}
          onPaste={onPaste}
        >
          <Dialog.Title className="sr-only">Capture</Dialog.Title>

          {recording ? (
            <RecordingMeter
              elapsedRef={elapsedRef}
              stream={stream}
              paused={paused}
              onTogglePause={() => {
                if (paused) resume();
                else pause();
              }}
              onDiscard={discard}
            />
          ) : (
            <div className="flex min-h-24 flex-col">
              {host ? (
                <p className="px-3 pt-3 text-[13px]">{host}</p>
              ) : null}
              <textarea
                ref={textareaRef}
                autoFocus
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (event.target.value) setClipboardUrl(null);
                }}
                onKeyDown={onTextareaKeyDown}
                placeholder="Paste a link, dump a thought, or drop a file"
                className={cn(
                  "min-h-24 w-full flex-1 resize-none bg-transparent px-3 py-3 text-[13px] font-normal outline-none placeholder:text-muted-foreground",
                  host && "min-h-0 pt-1 text-xs text-muted-foreground",
                )}
              />
              {files.length > 0 ? (
                <ul className="flex flex-wrap gap-1 px-3 pb-2">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex max-w-full items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px]"
                    >
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        className="text-muted-foreground hover:text-foreground [&_svg]:size-3"
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((_, item) => item !== index),
                          )
                        }
                      >
                        <Cross2Icon />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {suggestion ? (
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 pb-2 text-left text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setInput(suggestion);
                    setClipboardUrl(null);
                    textareaRef.current?.focus();
                  }}
                >
                  Save clipboard
                  <span className="min-w-0 truncate">
                    {captureHost(suggestion) ?? suggestion}
                  </span>
                </button>
              ) : null}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1.5">
            <DestinationMenu
              dest={dest}
              spaces={spaces}
              onChange={setDest}
            />
            <div className="flex-1" />
            {recording ? null : (
              <RecordButton onClick={() => void start()} />
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="font-normal"
              disabled={!canSave && !recording}
              onClick={save}
            >
              Capture
              <Kbd>⌘↩</Kbd>
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DestinationMenu({
  dest,
  spaces,
  onChange,
}: {
  dest: CaptureDestination;
  spaces: { id: string; name: string; shader?: string | null }[];
  onChange: (dest: CaptureDestination) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="max-w-40 font-normal"
          />
        }
      >
        {dest.kind === "space" ? (
          <SpacePic
            shaderId={spaces.find((space) => space.id === dest.id)?.shader}
            className="size-3.5"
          />
        ) : null}
        <span className="min-w-0 truncate">
          {destinationLabel(dest, spaces)}
        </span>
        <CaretDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-40 shadow-none">
        <DropdownMenuRadioGroup
          value={destinationKey(dest)}
          onValueChange={(value) => {
            if (typeof value !== "string") return;
            onChange(destinationFromKey(value));
          }}
        >
          <DropdownMenuRadioItem value="inbox" className="font-normal text-xs">
            Inbox
          </DropdownMenuRadioItem>
          {spaces.length > 0 ? (
            <DropdownMenuRadioItem value="auto" className="font-normal text-xs">
              File for me
            </DropdownMenuRadioItem>
          ) : null}
          {spaces.length > 0 ? <DropdownMenuSeparator /> : null}
          {spaces.map((space) => (
            <DropdownMenuRadioItem
              key={space.id}
              value={space.id}
              className="font-normal text-xs"
            >
              <SpacePic shaderId={space.shader} className="size-3.5" />
              <span className="truncate">{space.name.trim() || "Untitled"}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
