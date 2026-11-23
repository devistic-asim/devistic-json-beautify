import { repairJsonish } from "./repair";
import { looksStructural } from "./unwrap";

const MAX_REPLACEMENTS = 5000;
const MAX_DEPTH = 40;

/**
 * Parse JSON that was stored inside string values.
 * `apply` false counts them and leaves the tree unchanged.
 */
export function deepUnescape(
  value: unknown,
  apply: boolean,
): { value: unknown; count: number; capped: boolean } {
  let count = 0;
  let capped = false;

  function walk(current: unknown, depth: number): unknown {
    if (depth > MAX_DEPTH || capped) return current;
    if (typeof current === "string") {
      const embedded = parseEmbedded(current);
      if (embedded === undefined) return current;
      count += 1;
      if (count >= MAX_REPLACEMENTS) capped = true;
      return apply ? walk(embedded, depth + 1) : current;
    }
    if (Array.isArray(current)) {
      if (!apply) {
        for (const item of current) walk(item, depth + 1);
        return current;
      }
      return current.map((item) => walk(item, depth + 1));
    }
    if (current && typeof current === "object") {
      const record = current as Record<string, unknown>;
      if (!apply) {
        for (const item of Object.values(record)) walk(item, depth + 1);
        return current;
      }
      const next: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(record)) {
        next[key] = walk(item, depth + 1);
      }
      return next;
    }
    return current;
  }

  const next = walk(value, 0);
  return { value: apply ? next : value, count, capped };
}

function parseEmbedded(raw: string): unknown | undefined {
  const text = raw.trim();
  if (text.length < 2 || text.length > 200_000) return undefined;
  const start = text[0];
  if (start !== "{" && start !== "[" && start !== '"' && start !== "'") return undefined;
  if ((start === "{" || start === "[" || start === '"') && !needsRepair(text)) {
    try {
      const value = JSON.parse(text) as unknown;
      return accept(value);
    } catch {
      /* Fall through to the tolerant repair. */
    }
  }
  if (start !== "'" && start !== "{" && start !== "[" && start !== '"') return undefined;
  if (start === '"' && !looksStructural(text)) return undefined;
  const repaired = repairJsonish(text);
  if (!repaired.text) return undefined;
  try {
    return accept(JSON.parse(repaired.text) as unknown);
  } catch {
    return undefined;
  }
}

function accept(value: unknown): unknown | undefined {
  if (typeof value === "string") {
    if (!looksStructural(value)) return undefined;
    return parseEmbedded(value) ?? value;
  }
  if (value !== null && typeof value === "object") return value;
  return undefined;
}

function needsRepair(text: string): boolean {
  return text.startsWith("'") || /\/[/*]/.test(text) || /,(\s*[}\]])/.test(text);
}
