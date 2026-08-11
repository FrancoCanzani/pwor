import { useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const FRAME_PADDING = 12;

export function PdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [docReady, setDocReady] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setNumPages(null);
    setDocReady(false);
    setWidth(null);

    const shell = shellRef.current;
    if (!shell) return;

    // Wait until the dialog finish sizing so the first width isn't a zoom flicker.
    let last = 0;
    let stable = 0;
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const next = Math.max(
        0,
        Math.floor(shell.clientWidth - FRAME_PADDING * 2),
      );
      if (next <= 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (Math.abs(next - last) <= 1) {
        stable += 1;
      } else {
        stable = 0;
        last = next;
      }
      if (stable >= 3) {
        setWidth(last);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [fileUrl]);

  const loading = (
    <div className="flex h-full min-h-[inherit] w-full flex-1 items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  return (
    <div className="flex h-[70vh] flex-col">
      <div
        ref={shellRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-muted/30"
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-scroll overscroll-contain">
          {width == null ? (
            loading
          ) : (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: next }) => {
                setNumPages(next);
                setDocReady(true);
              }}
              loading={loading}
              error={
                <div className="flex h-full w-full flex-1 items-center justify-center">
                  <p className="text-sm text-destructive">
                    Couldn't load this PDF.
                  </p>
                </div>
              }
              className="flex min-h-full flex-col items-center gap-3 p-3"
            >
              {docReady && numPages != null
                ? Array.from({ length: numPages }, (_, index) => (
                    <Page
                      key={`${fileUrl}:${width}:${index + 1}`}
                      pageNumber={index + 1}
                      width={width}
                      loading={loading}
                      className="bg-background [&_canvas]:block"
                    />
                  ))
                : null}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
