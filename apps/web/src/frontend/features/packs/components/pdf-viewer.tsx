import { useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const FRAME_PADDING = 12;

export function PdfViewer({
  fileUrl,
  className,
}: {
  fileUrl: string;
  className?: string;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);

  // Measure the non-scrolling shell so page width never feeds back into
  // ResizeObserver via scrollbar gutters (that loop stacked dialog frames).
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const syncWidth = () => {
      const next = Math.max(
        0,
        Math.floor(shell.clientWidth - FRAME_PADDING * 2),
      );
      if (next === widthRef.current) return;
      widthRef.current = next;
      setWidth(next);
    };

    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div
        ref={shellRef}
        className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted/30"
      >
        <div className="h-full overflow-y-scroll overscroll-contain">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: next }) => setNumPages(next)}
            loading={null}
            error={
              <p className="px-4 py-8 text-center text-sm text-destructive">
                Couldn't load this PDF.
              </p>
            }
            className="flex flex-col items-center gap-3 p-3"
          >
            {numPages != null && width > 0
              ? Array.from({ length: numPages }, (_, index) => (
                  <Page
                    key={index + 1}
                    pageNumber={index + 1}
                    width={width}
                    loading={null}
                    className="bg-background [&_canvas]:block"
                  />
                ))
              : null}
          </Document>
        </div>
      </div>
    </div>
  );
}
