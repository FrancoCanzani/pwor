const WORD_BOUNDARY = /[\s\-_/]/;

/**
 * Subsequence match — every query character must appear in `text`, in order.
 * Contiguous runs and word-boundary hits score higher, so "cal" ranks
 * "Calendar" above "Work log" and "nt" ranks "New task" above "Notes".
 *
 * Returns null when the text doesn't match at all.
 */
export function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();

  let score = 0;
  let from = 0;
  let previous = -1;

  for (const char of needle) {
    const at = haystack.indexOf(char, from);
    if (at === -1) return null;

    if (at === previous + 1) score += 3;
    else if (at === 0 || WORD_BOUNDARY.test(haystack[at - 1]!)) score += 2;
    else score += 1;

    previous = at;
    from = at + 1;
  }

  // Shorter labels are the more precise match for the same run of characters.
  return score - haystack.length * 0.01;
}
