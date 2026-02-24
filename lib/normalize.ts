/**
 * Normalize a string for fuzzy comparison.
 * TypeScript port of the Python normalize() function from sync.py.
 */
export function normalize(s: string): string {
  let result = s.toLowerCase().trim();
  // Remove feat./ft./featuring in parentheses/brackets
  result = result.replace(/\s*[(\[](feat\.?|ft\.?|featuring).*?[)\]]/g, "");
  // Remove feat./ft./featuring and everything after
  result = result.replace(/\s*(feat\.?|ft\.?|featuring)\s+.*$/g, "");
  // Normalize apostrophes
  result = result.replace(/[''`]/g, "'");
  // Collapse whitespace
  result = result.replace(/\s+/g, " ");
  return result.trim();
}
