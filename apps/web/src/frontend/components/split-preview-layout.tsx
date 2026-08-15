import { type ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function SplitPreviewLayout({
  list,
  preview,
  previewOpen,
  overlay,
  persistPreview = false,
  listId,
  previewId,
  listSize = "58%",
  previewSize = "42%",
  listMinSize = "32%",
  previewMinSize = "28%",
  listClassName,
  previewClassName,
}: {
  list: ReactNode;
  preview: ReactNode;
  previewOpen: boolean;
  overlay?: ReactNode;
  persistPreview?: boolean;
  listId: string;
  previewId: string;
  listSize?: string;
  previewSize?: string;
  listMinSize?: string;
  previewMinSize?: string;
  listClassName?: string;
  previewClassName?: string;
}) {
  const isMobile = useIsMobile();
  const showSplit = persistPreview || previewOpen;

  const listPane = (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        previewOpen && isMobile && "hidden",
      )}
    >
      {list}
    </div>
  );

  if (isMobile) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {listPane}
        {previewOpen ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {preview}
          </div>
        ) : null}
        {overlay}
      </div>
    );
  }

  if (!showSplit) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {listPane}
        {overlay}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full min-h-0 overflow-hidden"
      >
        <ResizablePanel
          id={listId}
          defaultSize={listSize}
          minSize={listMinSize}
          className={cn("min-h-0 min-w-0 overflow-hidden", listClassName)}
        >
          {listPane}
        </ResizablePanel>
        <ResizableHandle className="w-px bg-border/40 after:w-px" />
        <ResizablePanel
          id={previewId}
          defaultSize={previewSize}
          minSize={previewMinSize}
          className={cn(
            "min-h-0 min-w-0 overflow-hidden bg-background",
            previewClassName,
          )}
        >
          {preview}
        </ResizablePanel>
      </ResizablePanelGroup>
      {overlay}
    </div>
  );
}
