const SHEET_EXTENSIONS = new Set([
  "csv",
  "tsv",
  "xls",
  "xlsx",
  "xlsm",
  "ods",
]);

const SHEET_MIME_TYPES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

export type SheetTable = {
  name: string;
  headers: string[];
  rows: string[][];
};

export type SheetWorkbook = {
  sheets: SheetTable[];
};

function extensionOf(title: string | null): string | null {
  if (!title?.includes(".")) return null;
  return title.slice(title.lastIndexOf(".") + 1).toLowerCase();
}

export function isSheetPreviewable(
  mimeType: string | null,
  title: string | null,
): boolean {
  if (mimeType) {
    const normalized = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
    if (SHEET_MIME_TYPES.has(normalized)) return true;
  }
  const ext = extensionOf(title);
  return ext !== null && SHEET_EXTENSIONS.has(ext);
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function padRow(row: string[], width: number): string[] {
  if (row.length >= width) return row.slice(0, width);
  return [...row, ...Array.from({ length: width - row.length }, () => "")];
}

function normalizeSheet(
  name: string,
  rawRows: unknown[][],
): SheetTable | null {
  const stringRows = rawRows
    .map((row) => row.map(cellToString))
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  if (stringRows.length === 0) return null;

  const width = Math.max(...stringRows.map((row) => row.length), 1);
  const [headerRow, ...body] = stringRows;
  const headers = padRow(headerRow ?? [], width).map((cell, index) =>
    cell.trim() !== "" ? cell : `Column ${index + 1}`,
  );
  const rows = body.map((row) => padRow(row, width));

  return { name, headers, rows };
}

export async function parseSheetWorkbook(
  buffer: ArrayBuffer,
): Promise<SheetWorkbook> {
  const XLSX = await import("xlsx");
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, {
    type: "array",
    cellDates: true,
  });

  const sheets: SheetTable[] = [];

  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<
      (string | number | boolean | Date | null)[]
    >(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    const sheet = normalizeSheet(name, rawRows);
    if (sheet) sheets.push(sheet);
  }

  return { sheets };
}

const NUMERIC_RE = /^-?[\d,]+(\.\d+)?%?$/;

export function isNumericCell(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return NUMERIC_RE.test(trimmed);
}
