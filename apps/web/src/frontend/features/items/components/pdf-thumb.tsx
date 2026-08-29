import { useLayoutEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";

import { cn } from "@/lib/utils";
import "@features/items/lib/pdf-worker";

export function PdfThumb({
  fileUrl,
  className,
}: {
  fileUrl: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const next = Math.floor(host.clientWidth);
      if (next > 0) setWidth(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn("size-full overflow-hidden bg-background", className)}
    >
      {width > 0 && !failed ? (
        <Document
          file={fileUrl}
          loading={null}
          onLoadError={() => setFailed(true)}
        >
          <Page
            pageNumber={1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
            className="[&_canvas]:block"
          />
        </Document>
      ) : null}
    </div>
  );
}
