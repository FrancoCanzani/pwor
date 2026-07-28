import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useMatch, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageEmpty } from "@components/page-empty";
import {
  createNote,
  deleteNote,
  noteQueryOptions,
  notesQueryOptions,
  type NoteListItem,
} from "@features/notes/api";
import { NotesList } from "@features/notes/components/notes-list";

export function NotesLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const noteMatch = useMatch({
    from: "/_app/notes/$noteId",
    shouldThrow: false,
  });
  const selectedId = noteMatch?.params.noteId;
  const { data: notes = [] } = useQuery(notesQueryOptions);
  const [pendingDelete, setPendingDelete] = useState<NoteListItem | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createNote(""),
    onSuccess: async (note) => {
      await queryClient.invalidateQueries({
        queryKey: notesQueryOptions.queryKey,
        exact: true,
      });
      await navigate({ to: "/notes/$noteId", params: { noteId: note.id } });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: async (_data, deletedId) => {
      setPendingDelete(null);
      queryClient.removeQueries({
        queryKey: noteQueryOptions(deletedId).queryKey,
      });
      const current = queryClient.getQueryData(notesQueryOptions.queryKey) ?? [];
      const remaining = current.filter((item) => item.id !== deletedId);
      queryClient.setQueryData(notesQueryOptions.queryKey, remaining);
      await queryClient.invalidateQueries({
        queryKey: notesQueryOptions.queryKey,
        exact: true,
      });

      if (selectedId === deletedId) {
        if (isMobile || remaining.length === 0) {
          await navigate({ to: "/notes" });
          return;
        }
        const next = remaining[0];
        if (!next) return;
        await navigate({
          to: "/notes/$noteId",
          params: { noteId: next.id },
        });
      }
    },
  });

  const list = (
    <NotesList
      notes={notes}
      selectedId={selectedId}
      createPending={createMutation.isPending}
      onCreate={() => createMutation.mutate()}
      onDelete={setPendingDelete}
    />
  );

  const editor = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {notes.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-8 pt-12">
          <PageEmpty
            title="No notes yet"
            description="Create a note to start writing in markdown."
          />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {selectedId ? editor : list}
        </div>
      ) : (
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
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent size="sm" className="gap-3 p-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-normal">
              Delete note?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {pendingDelete?.title?.trim()
                ? `“${pendingDelete.title.trim()}” will be permanently deleted.`
                : "This note will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-3 -mb-3 p-3">
            <AlertDialogCancel size="sm" className="font-normal">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              variant="destructive"
              className="font-normal"
              disabled={deleteMutation.isPending || !pendingDelete}
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
