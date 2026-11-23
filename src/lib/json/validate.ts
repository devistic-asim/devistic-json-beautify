import { diagnostic } from "./locate";
import type { JsonDiagnostic, RepairNote } from "./types";

export interface StrictAnalysis {
  ok: boolean;
  error?: JsonDiagnostic;
  warnings: RepairNote[];
}

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

/**
 * Strict JSON check with a stable line and column.
 * The position points at the character that explains the problem
 * (the trailing comma, the bad quote), which is often clearer than
 * the token an engine happens to reject next.
 */
export function validateStrict(input: string): StrictAnalysis {
  const parser = new StrictParser(input);
  const ok = parser.parseDocument();
  return { ok, error: parser.error, warnings: parser.warnings };
}

class StrictParser {
  private i = 0;
  error?: JsonDiagnostic;
  readonly warnings: RepairNote[] = [];
  private duplicateNoted = false;
  private precisionNoted = false;

  constructor(private readonly s: string) {}

  parseDocument(): boolean {
    if (this.s.charCodeAt(0) === 0xfeff) {
      this.warnings.push({
        code: "bom",
        message: "The input starts with a byte-order mark, which strict JSON.parse rejects.",
      });
      this.i = 1;
    }
    this.skipWs();
    if (this.eof()) {
      return this.fail(
        this.i,
        "The input is empty.",
        "Paste JSON, drop a .json file, or load an example.",
      );
    }
    if (!this.value()) return false;
    this.skipWs();
    if (!this.eof()) {
      return this.fail(
        this.i,
        "Extra content follows the JSON value.",
        "Strict JSON is a single value. If each line is its own JSON value (NDJSON), Beautify can combine them into an array.",
      );
    }
    return this.error === undefined;
  }

  private eof(): boolean {
    return this.i >= this.s.length;
  }

  private peek(): string {
    return this.s[this.i] ?? "";
  }

  private fail(at: number, message: string, hint: string): false {
    if (!this.error) this.error = diagnostic(this.s, at, message, hint);
    return false;
  }

  private skipWs(): void {
    while (!this.eof()) {
      const code = this.s.charCodeAt(this.i);
      if (code === 32 || code === 9 || code === 10 || code === 13) this.i += 1;
      else break;
    }
  }

  private value(): boolean {
    this.skipWs();
    if (this.eof()) {
      return this.fail(
        this.i,
        "Unexpected end of input.",
        "A value is missing. Look for a truncated object, array, or string.",
      );
    }
    const c = this.peek();
    if (c === "{") return this.object();
    if (c === "[") return this.array();
    if (c === '"') return this.string();
    if (c === "'") {
      return this.fail(
        this.i,
        "Strings must use double quotes.",
        "Single quotes are JavaScript or JSON5, not strict JSON. Beautify can convert them.",
      );
    }
    if (c === "/") {
      return this.fail(
        this.i,
        "Comments are not allowed in JSON.",
        "Remove // and /* */ comments, or use Beautify to strip them.",
      );
    }
    if (c === "-" || this.isDigit(c)) return this.number();
    if (this.keyword("true") || this.keyword("false") || this.keyword("null")) return true;
    if (IDENT_START.test(c)) {
      const at = this.i;
      const word = this.readIdent();
      return this.fail(at, `Unexpected word “${word}”.`, hintForWord(word));
    }
    if (c === ",") {
      return this.fail(
        this.i,
        "Unexpected comma.",
        "A comma cannot start a value. Look for a leading comma or two commas in a row.",
      );
    }
    if (c === "}" || c === "]") {
      return this.fail(
        this.i,
        `Unexpected “${c}”.`,
        "A value was expected before this closing bracket.",
      );
    }
    return this.fail(
      this.i,
      `Unexpected character “${visible(c)}”.`,
      "This character is not JSON syntax. Beautify can repair quotes, commas, comments, and common API wrappers.",
    );
  }

  private object(): boolean {
    this.i += 1;
    this.skipWs();
    if (this.peek() === "}") {
      this.i += 1;
      return true;
    }
    const seen = new Set<string>();
    while (!this.eof()) {
      this.skipWs();
      if (this.peek() === "/") return this.commentFail();
      const c = this.peek();
      if (c === "'") {
        return this.fail(
          this.i,
          "Object keys must use double quotes.",
          "Single-quoted keys are JSON5, not strict JSON. Beautify can convert them.",
        );
      }
      if (IDENT_START.test(c)) {
        return this.fail(
          this.i,
          "Object keys must be double-quoted strings.",
          "Beautify can add quotes around unquoted keys.",
        );
      }
      if (c === ",") {
        return this.fail(
          this.i,
          "Unexpected comma in an object.",
          "JSON does not allow a leading comma. Remove it, or use Beautify.",
        );
      }
      if (c !== '"') {
        return this.fail(
          this.i,
          "Expected an object key.",
          "A key is a double-quoted string followed by a colon.",
        );
      }
      const keyStart = this.i;
      if (!this.string()) return false;
      const rawKey = this.s.slice(keyStart, this.i);
      let key = rawKey;
      try {
        const parsed = JSON.parse(rawKey) as unknown;
        if (typeof parsed === "string") key = parsed;
      } catch {
        /* The string parser already accepted it. Keep the raw text. */
      }
      if (seen.has(key) && !this.duplicateNoted) {
        this.duplicateNoted = true;
        this.warnings.push({
          code: "duplicate-key",
          message: `Duplicate key ${JSON.stringify(key)}. JSON keeps the last value for a repeated key.`,
        });
      }
      seen.add(key);
      this.skipWs();
      if (this.peek() !== ":") {
        return this.fail(
          this.i,
          "Expected a colon after the object key.",
          "Write the key, then :, then the value.",
        );
      }
      this.i += 1;
      if (!this.value()) return false;
      this.skipWs();
      if (this.peek() === ",") {
        const commaAt = this.i;
        this.i += 1;
        this.skipWs();
        if (this.peek() === "}") {
          return this.fail(
            commaAt,
            "Trailing comma in an object.",
            "JSON does not allow a comma after the last property. Beautify can remove it.",
          );
        }
        if (this.peek() === ",") {
          return this.fail(this.i, "Unexpected extra comma.", "Two commas in a row are not valid JSON.");
        }
        continue;
      }
      if (this.peek() === "}") {
        this.i += 1;
        return true;
      }
      if (this.peek() === "/") return this.commentFail();
      return this.fail(
        this.i,
        "Expected a comma or a closing brace.",
        "Separate properties with commas. The missing comma is often on the line above the one an engine highlights.",
      );
    }
    return this.fail(this.i, "Unclosed object.", "An opening { never found its closing }.");
  }

  private array(): boolean {
    this.i += 1;
    this.skipWs();
    if (this.peek() === "]") {
      this.i += 1;
      return true;
    }
    while (!this.eof()) {
      if (this.peek() === "/") return this.commentFail();
      if (this.peek() === ",") {
        return this.fail(
          this.i,
          "Unexpected comma in an array.",
          "JSON does not allow a leading comma. Remove it, or use Beautify.",
        );
      }
      if (!this.value()) return false;
      this.skipWs();
      if (this.peek() === ",") {
        const commaAt = this.i;
        this.i += 1;
        this.skipWs();
        if (this.peek() === "]") {
          return this.fail(
            commaAt,
            "Trailing comma in an array.",
            "JSON does not allow a comma after the last item. Beautify can remove it.",
          );
        }
        if (this.peek() === ",") {
          return this.fail(this.i, "Unexpected extra comma.", "Two commas in a row are not valid JSON.");
        }
        continue;
      }
      if (this.peek() === "]") {
        this.i += 1;
        return true;
      }
      if (this.peek() === "/") return this.commentFail();
      return this.fail(
        this.i,
        "Expected a comma or a closing bracket.",
        "Separate array items with commas.",
      );
    }
    return this.fail(this.i, "Unclosed array.", "An opening [ never found its closing ].");
  }

  private string(): boolean {
    const start = this.i;
    this.i += 1;
    while (!this.eof()) {
      const c = this.peek();
      if (c === '"') {
        this.i += 1;
        return true;
      }
      if (c === "\\") {
        const next = this.s[this.i + 1];
        if (next === undefined) {
          return this.fail(this.i, "Unterminated string.", "The string ends on a backslash.");
        }
        if (next === "u") {
          const hex = this.s.slice(this.i + 2, this.i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            return this.fail(
              this.i,
              "Invalid \\u escape.",
              "\\u must be followed by four hexadecimal digits, for example \\u00A9.",
            );
          }
          this.i += 6;
          continue;
        }
        if ('"\\/bfnrt'.includes(next)) {
          this.i += 2;
          continue;
        }
        return this.fail(
          this.i,
          `Invalid escape “\\${next}”.`,
          "Valid escapes are \\\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t, and \\uXXXX.",
        );
      }
      if (c.charCodeAt(0) < 0x20) {
        return this.fail(
          this.i,
          "Unescaped control character inside a string.",
          "A raw newline or tab inside a string must be written as \\n or \\t.",
        );
      }
      this.i += 1;
    }
    return this.fail(start, "Unterminated string.", "A double quote was opened and never closed.");
  }

  private number(): boolean {
    const start = this.i;
    if (this.peek() === "-") this.i += 1;
    if (this.eof() || !this.isDigit(this.peek())) {
      return this.fail(start, "Invalid number.", "A minus sign must be followed by a digit.");
    }
    if (this.peek() === "0") {
      this.i += 1;
      if (!this.eof() && this.isDigit(this.peek())) {
        return this.fail(
          start,
          "Numbers cannot have leading zeros.",
          "Use 0.5 for a fraction, or drop the extra zero.",
        );
      }
    } else {
      while (!this.eof() && this.isDigit(this.peek())) this.i += 1;
    }
    const intLen = this.i - start - (this.s[start] === "-" ? 1 : 0);
    if (intLen > 15 && !this.precisionNoted) {
      this.precisionNoted = true;
      this.warnings.push({
        code: "precision",
        message:
          "A number has more than 15 digits. Formatting uses JavaScript numbers, so the last digits may change. Keep it as a string if you need the exact value.",
      });
    }
    if (this.peek() === ".") {
      this.i += 1;
      if (this.eof() || !this.isDigit(this.peek())) {
        return this.fail(this.i, "Invalid number.", "A decimal point must be followed by a digit.");
      }
      while (!this.eof() && this.isDigit(this.peek())) this.i += 1;
    }
    if (this.peek() === "e" || this.peek() === "E") {
      this.i += 1;
      if (this.peek() === "+" || this.peek() === "-") this.i += 1;
      if (this.eof() || !this.isDigit(this.peek())) {
        return this.fail(start, "Invalid number.", "An exponent needs at least one digit.");
      }
      while (!this.eof() && this.isDigit(this.peek())) this.i += 1;
    }
    return true;
  }

  private commentFail(): false {
    return this.fail(
      this.i,
      "Comments are not allowed in JSON.",
      "Remove // and /* */ comments, or use Beautify to strip them.",
    );
  }

  private keyword(word: string): boolean {
    if (!this.s.startsWith(word, this.i)) return false;
    const next = this.s[this.i + word.length] ?? "";
    if (IDENT_PART.test(next)) return false;
    this.i += word.length;
    return true;
  }

  private readIdent(): string {
    const start = this.i;
    this.i += 1;
    while (!this.eof() && IDENT_PART.test(this.peek())) this.i += 1;
    return this.s.slice(start, this.i);
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }
}

function hintForWord(word: string): string {
  if (word === "undefined" || word === "NaN" || word === "Infinity") {
    return `${word} is not a JSON value. Use null, or Beautify to convert it.`;
  }
  if (word === "True" || word === "False" || word === "None" || word === "TRUE" || word === "FALSE") {
    return `${word} looks like a Python or spreadsheet literal. Beautify can convert True, False, and None.`;
  }
  return "Keys and strings must be wrapped in double quotes. Beautify can repair this JSON5-style text.";
}

function visible(c: string): string {
  if (c === "\n") return "\\n";
  if (c === "\t") return "\\t";
  if (c === "\r") return "\\r";
  return c;
}
