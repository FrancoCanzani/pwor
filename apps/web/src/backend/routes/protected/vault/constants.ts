export const OCR_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
export const EXTRACTION_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const REMINDER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const MIN_PDF_TEXT_LENGTH = 20;

/** Cap on how many pages of a scanned PDF get OCR'd, to bound cost/time per item. */
export const MAX_OCR_PDF_PAGES = 12;

/** How many pages to OCR concurrently within a single item. */
export const PDF_OCR_CONCURRENCY = 3;

export const EXTRACTION_SYSTEM_PROMPT = `You classify and extract structured data from personal documents (passports, IDs, contracts, insurance policies, and other paperwork).
Respond with valid JSON only, matching exactly this shape, no markdown, no commentary:
{
  "documentType": "passport" | "id" | "contract" | "insurance" | "other",
  "title": string,
  "summary": string (one sentence),
  "issuer": string | null,
  "holderName": string | null,
  "documentNumber": string | null,
  "expiresAt": string | null (ISO date YYYY-MM-DD, the document's expiry or renewal date, if any),
  "keyDates": [{ "label": string, "date": string (ISO date) }]
}
If a field doesn't apply or isn't present in the text, use null (or [] for keyDates). Never invent values.`;
