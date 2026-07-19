const MAX_MERGED = 12000;

/** Join authorized context packs; truncate safely for Gateway invoke. */
export function mergeContextPacks(
  ...packs: Array<string | undefined>
): string | undefined {
  const parts = packs.filter(
    (pack): pack is string => pack !== undefined && pack.length > 0,
  );
  if (parts.length === 0) return undefined;
  let merged = parts.join("\n\n");
  if (merged.length > MAX_MERGED) {
    merged = `${merged.slice(0, MAX_MERGED)}…`;
  }
  return merged;
}
