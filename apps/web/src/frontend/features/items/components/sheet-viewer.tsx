import { useState } from "react";
import { DownloadIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isNumericCell, type SheetWorkbook } from "@features/items/lib/sheet";

const rowNumClass =
  "sticky left-0 z-20 w-7 border-r border-border bg-background px-1 py-1 text-right font-nums font-normal text-muted-foreground";

export function SheetViewer({
  workbook,
  downloadUrl,
}: {
  workbook: SheetWorkbook | undefined;
  downloadUrl: string;
}) {
  const [sheetIndex, setSheetIndex] = useState(0);

  if (!workbook) {
    return <div className="h-full" />;
  }

  if (workbook.sheets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">This sheet is empty.</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Download"
          nativeButton={false}
          render={<a href={downloadUrl} download />}
        >
          <DownloadIcon />
        </Button>
      </div>
    );
  }

  const activeIndex = Math.min(sheetIndex, workbook.sheets.length - 1);
  const sheet = workbook.sheets[activeIndex]!;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {workbook.sheets.length > 1 ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {workbook.sheets.map((entry, index) => (
              <button
                key={`${entry.name}-${index}`}
                type="button"
                onClick={() => setSheetIndex(index)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-xs transition-colors select-none",
                  index === activeIndex
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:bg-muted/60 active:text-foreground",
                )}
              >
                {entry.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-2">
          <span className="font-nums text-xs text-muted-foreground">
            {sheet.rows.length} rows
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download"
            nativeButton={false}
            render={<a href={downloadUrl} download />}
          >
            <DownloadIcon />
          </Button>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-md border border-border">
        <table className="w-max min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-border">
              <th scope="col" className={cn(rowNumClass, "z-40")}>
                #
              </th>
              {sheet.headers.map((header, colIndex) => (
                <th
                  key={`h-${colIndex}`}
                  scope="col"
                  className="max-w-[16rem] truncate bg-background px-1 py-1 font-normal text-muted-foreground"
                  title={header}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr
                key={`r-${rowIndex}`}
                className="group border-b border-border/60 last:border-b-0"
              >
                <td className={cn(rowNumClass, "group-hover:bg-muted")}>
                  {rowIndex + 1}
                </td>
                {row.map((cell, colIndex) => {
                  const numeric = isNumericCell(cell);
                  return (
                    <td
                      key={`c-${rowIndex}-${colIndex}`}
                      className={cn(
                        "max-w-[16rem] truncate px-1 py-1 text-foreground group-hover:bg-muted",
                        numeric && "font-nums text-right",
                      )}
                      title={cell}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
