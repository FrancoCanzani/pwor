import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  useMatch,
  useNavigate,
  useParams,
} from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageEmpty } from "@components/page-empty";
import {
  createNote,
  noteQueryOptions,
  notesQueryOptions,
  type NoteListItem,
} from "@features/notes/api";
import { NotesList } from "@features/notes/components/notes-list";
import { EMPTY_NOTE_BODY } from "../../../../shared/note-frontmatter";

export function NotesLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });
  const noteMatch = useMatch({
    from: "/_app/$workspaceId/notes/$noteId/",
    shouldThrow: false,
  });
  const selectedId = noteMatch?.params.noteId;
  const { data: notes = [] } = useQuery(notesQueryOptions(workspaceId));

  const createMutation = useMutation({
    mutationFn: () => createNote(EMPTY_NOTE_BODY, null, workspaceId),
    onSuccess: (note) => {
      queryClient.setQueryData(noteQueryOptions(note.id).queryKey, note);
      queryClient.setQueryData(
        notesQueryOptions(workspaceId).queryKey,
        (current: NoteListItem[] | undefined) => {
          const item: NoteListItem = {
            id: note.id,
            title: note.title,
            workspaceId: note.workspaceId,
            updatedAt: note.updatedAt,
            createdAt: note.createdAt,
          };
          if (!current) return [item];
          return [item, ...current.filter((row) => row.id !== note.id)];
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
      void navigate({
        to: "/$workspaceId/notes/$noteId",
        params: { workspaceId, noteId: note.id },
      });
    },
  });

  async function handleNoteDeleted(note: NoteListItem) {
    queryClient.removeQueries({
      queryKey: noteQueryOptions(note.id).queryKey,
    });
    const listKey = notesQueryOptions(workspaceId).queryKey;
    const remaining = (
      queryClient.getQueryData<NoteListItem[]>(listKey) ?? []
    ).filter((item) => item.id !== note.id);
    queryClient.setQueryData(listKey, remaining);
    await queryClient.invalidateQueries({ queryKey: ["notes", "list"] });

    if (selectedId !== note.id) return;

    if (isMobile || remaining.length === 0) {
      await navigate({ to: "/$workspaceId/notes", params: { workspaceId } });
      return;
    }
    const next = remaining[0];
    if (!next) return;
    await navigate({
      to: "/$workspaceId/notes/$noteId",
      params: { workspaceId, noteId: next.id },
    });
  }

  const list = (
    <NotesList
      notes={notes}
      selectedId={selectedId}
      createPending={createMutation.isPending}
      onCreate={() => createMutation.mutate()}
      onDeleted={handleNoteDeleted}
    />
  );

  const editor = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <Outlet />
    </div>
  );

  // With no notes the list has nothing to show, so the aside would only repeat
  // the empty state next to it. Drop it and let the empty own the full pane.
  if (notes.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-8">
        <PageEmpty
          title="No notes yet"
          description="Create a note to start writing in markdown."
          action={
            <Button
              variant="new"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "New note"}
            </Button>
          }
        />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {selectedId ? editor : list}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 overflow-hidden"
    >
      <ResizablePanel
        id="notes-aside"
        defaultSize={224}
        minSize={180}
        maxSize={420}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {list}
      </ResizablePanel>

      <ResizableHandle className="w-px bg-border/40 after:w-px" />

      <ResizablePanel
        id="notes-editor"
        defaultSize="70%"
        minSize="40%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        {editor}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
