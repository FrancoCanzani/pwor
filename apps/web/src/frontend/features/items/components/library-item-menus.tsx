import { type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

export function LibraryItemMenus({
  title,
  deleteDescription,
  pinned,
  externalHref,
  downloadHref,
  onOpen,
  onToggle,
  onPin,
  onDelete,
  children,
}: {
  title: string;
  deleteDescription: string;
  pinned: boolean;
  externalHref: string | null;
  downloadHref: string | null;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  onPin: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  function openExternal() {
    if (!externalHref) return;
    const tab = window.open(externalHref, "_blank");
    if (tab) tab.opener = null;
  }

  return (
    <ContextMenu>
      <AlertDialog>
        {children}
        <ContextMenuContent className="shadow-none">
          <ContextMenuGroup>
            <ContextMenuItem className="font-normal text-xs" onClick={onOpen}>
              Preview
            </ContextMenuItem>
            <ContextMenuItem
              className="font-normal text-xs"
              disabled={!externalHref}
              onClick={openExternal}
            >
              Open original
            </ContextMenuItem>
            {downloadHref ? (
              <ContextMenuItem
                className="font-normal text-xs"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = downloadHref;
                  link.download = "";
                  link.click();
                }}
              >
                Download
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              className="font-normal text-xs"
              onClick={() => onToggle(true)}
            >
              Select
            </ContextMenuItem>
            <ContextMenuItem className="font-normal text-xs" onClick={onPin}>
              {pinned ? "Unpin" : "Pin"}
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <AlertDialogTrigger
              nativeButton={false}
              render={
                <ContextMenuItem
                  variant="destructive"
                  className="font-normal text-xs"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
          </ContextMenuGroup>
        </ContextMenuContent>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}
