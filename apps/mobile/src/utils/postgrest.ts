/**
 * Makes user text safe to interpolate into a PostgREST `.or('col.ilike.%term%,...')` filter string.
 * Commas, parentheses, quotes, backslashes and wildcard characters are structural in that syntax;
 * leaving them in lets a crafted search term break the filter or append extra conditions.
 */
export const orTerm = (value: unknown): string =>
  String(value ?? '')
    .replace(/[,()"'\*%_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
