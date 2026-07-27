import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { notesQueryOptions } from "@features/notes/api";

export const Route = createFileRoute("/_app/notes/")({
  component: NotesIndex,
});

function NotesIndex() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: notes = [], isLoading } = useQuery(notesQueryOptions);

  useEffect(() => {
    if (isMobile || isLoading) return;
    const latest = notes[0];
    if (!latest) return;
    void navigate({
      to: "/notes/$noteId",
      params: { noteId: latest.id },
      replace: true,
    });
  }, [isMobile, isLoading, notes, navigate]);

  return null;
}
