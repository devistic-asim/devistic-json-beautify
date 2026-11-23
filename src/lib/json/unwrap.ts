/** Text that is worth another parse: an object, array, or still-escaped JSON. */
export function looksStructural(value: string): boolean {
  const text = value.trim();
  if (text.startsWith("{") || text.startsWith("[")) return true;
  if (text.startsWith("'") && (text.includes("{") || text.includes("["))) return true;
  if (text.startsWith('"') && (text.includes("{") || text.includes("[") || text.includes('\\"'))) {
    return true;
  }
  return false;
}

/**
 * Peel stringified JSON, including several layers and a body that was copied
 * without its surrounding quotes (`{\"a\":1}`).
 */
export function unwrapStringified(input: string): { text: string; levels: number } {
  let current = input.trim();
  let levels = 0;
  const seen = new Set<string>();

  for (let n = 0; n < 8; n += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    try {
      const value = JSON.parse(current) as unknown;
      if (typeof value === "string" && looksStructural(value)) {
        current = value.trim();
        levels += 1;
        continue;
      }
      break;
    } catch {
      if (!shouldPeel(current)) break;
      const peeled = peelOne(current);
      if (peeled == null) break;
      const next = peeled.trim();
      if (next === current) break;
      if (!looksStructural(next)) {
        try {
          JSON.parse(next);
        } catch {
          break;
        }
      }
      current = next;
      levels += 1;
    }
  }

  return { text: current, levels };
}

function shouldPeel(input: string): boolean {
  const text = input.trim();
  if (text.startsWith('"')) return true;
  if ((text.startsWith("{") || text.startsWith("[")) && text.includes('\\"')) return true;
  if (text.startsWith("\\")) return true;
  return false;
}

function peelOne(input: string): string | null {
  if (!input.includes("\\")) return null;
  try {
    const value = JSON.parse(`"${input}"`) as unknown;
    if (typeof value === "string" && value !== input) return value;
  } catch {
    /* The body is not one clean JSON string. Try a single manual pass. */
  }
  return manualUnescape(input);
}

/** One layer of JSON string escapes. Returns null when an escape is invalid. */
export function manualUnescape(input: string): string | null {
  let out = "";
  let changed = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (c !== "\\") {
      out += c ?? "";
      continue;
    }
    const next = input[i + 1];
    if (next === undefined) return null;
    changed = true;
    if (next === "u") {
      const hex = input.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 5;
      continue;
    }
    const mapped = ESCAPES[next];
    if (mapped === undefined) return null;
    out += mapped;
    i += 1;
  }
  return changed ? out : null;
}

const ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};
