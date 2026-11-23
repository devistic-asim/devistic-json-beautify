export interface JsonToken {
  type: "key" | "string" | "number" | "literal" | "punct" | "ws";
  text: string;
}

/** Tokenize JSON this app produced. The input is already valid. */
export function highlightJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i] ?? "";
    if (c === '"') {
      const start = i;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      let j = i;
      while (j < source.length && isSpace(source[j] ?? "")) j += 1;
      tokens.push({
        type: source[j] === ":" ? "key" : "string",
        text: source.slice(start, i),
      });
      continue;
    }
    if (c === "-" || isDigit(c)) {
      const start = i;
      i += 1;
      while (i < source.length && /[0-9eE+.-]/.test(source[i] ?? "")) i += 1;
      tokens.push({ type: "number", text: source.slice(start, i) });
      continue;
    }
    const literal = matchLiteral(source, i);
    if (literal) {
      tokens.push({ type: "literal", text: literal });
      i += literal.length;
      continue;
    }
    if (isSpace(c)) {
      const start = i;
      while (i < source.length && isSpace(source[i] ?? "")) i += 1;
      tokens.push({ type: "ws", text: source.slice(start, i) });
      continue;
    }
    tokens.push({ type: "punct", text: c });
    i += 1;
  }
  return tokens;
}

function matchLiteral(source: string, index: number): string | null {
  for (const word of ["true", "false", "null"]) {
    if (!source.startsWith(word, index)) continue;
    const next = source[index + word.length] ?? "";
    if (/[A-Za-z0-9_]/.test(next)) continue;
    return word;
  }
  return null;
}

function isSpace(c: string): boolean {
  return c === " " || c === "\n" || c === "\r" || c === "\t";
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}
