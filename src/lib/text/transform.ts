export interface TextStats {
  characters: number;
  lines: number;
  words: number;
}

export type TextAction =
  | "clean"
  | "trim"
  | "collapse"
  | "blank"
  | "newlines"
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "snake"
  | "kebab";

export function countPhrase(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function inputPreview(text: string): string {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const meaningful =
    lines.find((line) => !/^[[\]{}],?$/.test(line)) ?? lines[0] ?? "Recent input";
  const compact = meaningful.replace(/\s+/g, " ");
  return compact.length > 48 ? `${compact.slice(0, 48)}…` : compact;
}

export function textStats(input: string): TextStats {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = input.length === 0 ? 0 : normalized.split("\n").length;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  return { characters: [...input].length, lines, words };
}

export function applyTextAction(input: string, action: TextAction): string {
  switch (action) {
    case "clean":
      return cleanText(input, {
        trimLines: true,
        collapseSpaces: true,
        removeBlankLines: true,
        normalizeNewlines: true,
      });
    case "trim":
      return cleanText(input, {
        trimLines: true,
        collapseSpaces: false,
        removeBlankLines: false,
        normalizeNewlines: false,
      });
    case "collapse":
      return cleanText(input, {
        trimLines: false,
        collapseSpaces: true,
        removeBlankLines: false,
        normalizeNewlines: false,
      });
    case "blank":
      return cleanText(input, {
        trimLines: false,
        collapseSpaces: false,
        removeBlankLines: true,
        normalizeNewlines: true,
      });
    case "newlines":
      return cleanText(input, {
        trimLines: false,
        collapseSpaces: false,
        removeBlankLines: false,
        normalizeNewlines: true,
      });
    case "upper":
      return input.toUpperCase();
    case "lower":
      return input.toLowerCase();
    case "title":
      return toTitleCase(input);
    case "sentence":
      return toSentenceCase(input);
    case "camel":
      return mapContentLines(input, toCamel);
    case "snake":
      return mapContentLines(input, toSnake);
    case "kebab":
      return mapContentLines(input, toKebab);
  }
}

export function cleanText(
  input: string,
  options: {
    trimLines: boolean;
    collapseSpaces: boolean;
    removeBlankLines: boolean;
    normalizeNewlines: boolean;
  },
): string {
  let text = input.replace(/^\uFEFF/, "");
  if (options.normalizeNewlines) text = text.replace(/\r\n?/g, "\n");
  let lines = text.split("\n");
  if (options.trimLines) lines = lines.map((line) => line.trim());
  if (options.collapseSpaces) lines = lines.map((line) => line.replace(/[ \t\f\v]+/g, " "));
  if (options.removeBlankLines) lines = lines.filter((line) => line.trim() !== "");
  return lines.join("\n");
}

export function toTitleCase(input: string): string {
  return input.toLowerCase().replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function toSentenceCase(input: string): string {
  const lower = input.toLowerCase();
  return lower.replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (match) => match.toUpperCase());
}

export function wordsOf(input: string): string[] {
  const spaced = input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 0);
}

export function toCamel(input: string): string {
  return wordsOf(input)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function toSnake(input: string): string {
  return wordsOf(input)
    .map((word) => word.toLowerCase())
    .join("_");
}

export function toKebab(input: string): string {
  return wordsOf(input)
    .map((word) => word.toLowerCase())
    .join("-");
}

function mapContentLines(input: string, fn: (line: string) => string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => (line.trim() ? fn(line) : line))
    .join("\n");
}
