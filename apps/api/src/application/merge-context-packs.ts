const MAX_MERGED = 12000;

export type ContextPackLike =
  | string
  | { readonly text: string }
  | undefined;

function toText(pack: ContextPackLike): string | undefined {
  if (pack === undefined) return undefined;
  if (typeof pack === "string") {
    return pack.length > 0 ? pack : undefined;
  }
  return pack.text.length > 0 ? pack.text : undefined;
}

/** Join authorized context packs; truncate safely for Gateway invoke. */
export function mergeContextPacks(
  ...packs: ContextPackLike[]
): string | undefined {
  const parts = packs
    .map(toText)
    .filter((pack): pack is string => pack !== undefined);
  if (parts.length === 0) return undefined;
  let merged = parts.join("\n\n");
  if (merged.length > MAX_MERGED) {
    merged = `${merged.slice(0, MAX_MERGED)}…`;
  }
  return merged;
}

/** Flatten citation arrays from structured context packs. */
export function mergeCitations<T>(
  ...lists: Array<readonly T[] | undefined>
): T[] {
  const out: T[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) out.push(item);
  }
  return out;
}
