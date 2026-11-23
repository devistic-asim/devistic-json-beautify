import type { RepairNote } from "./types";

const IDENT_START = /[A-Za-z_$\u00A0-\uFFFF]/;
const IDENT_PART = /[A-Za-z0-9_$\u00A0-\uFFFF]/;

const LITERALS: Record<string, string> = {
  true: "true",
  false: "false",
  null: "null",
  True: "true",
  TRUE: "true",
  False: "false",
  FALSE: "false",
  None: "null",
  NONE: "null",
  none: "null",
  undefined: "null",
  NaN: "null",
  Infinity: "null",
};

/**
 * Rewrite JSON5-style text into strict JSON.
 * Strings are scanned, so comment markers and commas inside strings stay put.
 * Unknown bare words are left untouched so a later parse can still explain them.
 */
export function repairJsonish(input: string): { text: string; notes: RepairNote[] } {
  const repair = new Repair(input);
  repair.run();
  return { text: repair.output, notes: repair.notes };
}

class Repair {
  private i = 0;
  output = "";
  readonly notes: RepairNote[] = [];
  private readonly seen = new Set<string>();
  private readonly src: string;

  constructor(input: string) {
    let src = input;
    if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
    const straight = src
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
    if (straight !== src) {
      this.note(
        "smart-quotes",
        "Replaced curly quotes with straight quotes.",
      );
      src = straight;
    }
    this.src = src;
  }

  run(): void {
    this.skipIgnorable();
    if (this.eof()) return;
    this.value();
    this.skipIgnorable();
    if (!this.eof()) this.output += this.src.slice(this.i);
  }

  private eof(): boolean {
    return this.i >= this.src.length;
  }

  private peek(): string {
    return this.src[this.i] ?? "";
  }

  private note(code: string, message: string): void {
    if (this.seen.has(code)) return;
    this.seen.add(code);
    this.notes.push({ code, message });
  }

  private skipIgnorable(): void {
    while (!this.eof()) {
      const c = this.peek();
      if (c === " " || c === "\n" || c === "\r" || c === "\t") {
        this.i += 1;
        continue;
      }
      if (c === "/" && this.src[this.i + 1] === "/") {
        this.note("comments", "Removed comments.");
        this.i += 2;
        while (!this.eof() && this.peek() !== "\n") this.i += 1;
        continue;
      }
      if (c === "/" && this.src[this.i + 1] === "*") {
        this.note("comments", "Removed comments.");
        this.i += 2;
        while (!this.eof() && !(this.peek() === "*" && this.src[this.i + 1] === "/")) this.i += 1;
        if (!this.eof()) this.i += 2;
        continue;
      }
      break;
    }
  }

  private value(): void {
    this.skipIgnorable();
    if (this.eof()) return;
    const c = this.peek();
    if (c === "{") return this.object();
    if (c === "[") return this.array();
    if (c === '"') {
      this.output += this.readDouble();
      return;
    }
    if (c === "'") {
      this.note("single-quotes", "Converted single-quoted strings to double quotes.");
      this.output += this.readSingle();
      return;
    }
    if (c === "+" || c === "-" || this.isDigit(c)) {
      if (c === "-" && this.src.startsWith("Infinity", this.i + 1)) {
        this.note(
          "literals",
          "Converted non-JSON literals (True, False, None, undefined, NaN, Infinity) to JSON null, true, or false.",
        );
        this.i += 1 + "Infinity".length;
        this.output += "null";
        return;
      }
      this.output += this.readNumber();
      return;
    }
    if (IDENT_START.test(c)) {
      const word = this.readIdent();
      const mapped = LITERALS[word];
      if (mapped) {
        if (mapped !== word) {
          this.note(
            "literals",
            "Converted non-JSON literals (True, False, None, undefined, NaN, Infinity) to JSON null, true, or false.",
          );
        }
        this.output += mapped;
        return;
      }
      this.output += word;
      return;
    }
    this.output += c;
    this.i += 1;
  }

  private object(): void {
    this.output += "{";
    this.i += 1;
    this.skipIgnorable();
    if (this.peek() === "}") {
      this.output += "}";
      this.i += 1;
      return;
    }
    let first = true;
    while (!this.eof()) {
      this.skipIgnorable();
      if (this.peek() === "}") {
        this.output += "}";
        this.i += 1;
        return;
      }
      if (!first) this.output += ",";
      first = false;
      this.key();
      this.skipIgnorable();
      if (this.peek() === ":") this.i += 1;
      this.output += ":";
      this.value();
      this.skipIgnorable();
      if (this.peek() === ",") {
        this.i += 1;
        this.skipIgnorable();
        if (this.peek() === "}" || this.peek() === "") {
          this.note("trailing-commas", "Removed trailing commas.");
          this.output += "}";
          if (this.peek() === "}") this.i += 1;
          return;
        }
        continue;
      }
      if (this.peek() === "}") {
        this.output += "}";
        this.i += 1;
        return;
      }
      if (this.startsValue() || this.peek() === '"' || this.peek() === "'" || IDENT_START.test(this.peek())) {
        this.note("missing-commas", "Inserted missing commas between values.");
        continue;
      }
      break;
    }
  }

  private array(): void {
    this.output += "[";
    this.i += 1;
    this.skipIgnorable();
    if (this.peek() === "]") {
      this.output += "]";
      this.i += 1;
      return;
    }
    let first = true;
    while (!this.eof()) {
      this.skipIgnorable();
      if (this.peek() === "]") {
        this.output += "]";
        this.i += 1;
        return;
      }
      if (!first) this.output += ",";
      first = false;
      this.value();
      this.skipIgnorable();
      if (this.peek() === ",") {
        this.i += 1;
        this.skipIgnorable();
        if (this.peek() === "]" || this.peek() === "") {
          this.note("trailing-commas", "Removed trailing commas.");
          this.output += "]";
          if (this.peek() === "]") this.i += 1;
          return;
        }
        continue;
      }
      if (this.peek() === "]") {
        this.output += "]";
        this.i += 1;
        return;
      }
      if (this.startsValue()) {
        this.note("missing-commas", "Inserted missing commas between values.");
        continue;
      }
      break;
    }
  }

  private key(): void {
    this.skipIgnorable();
    const c = this.peek();
    if (c === '"') {
      this.output += this.readDouble();
      return;
    }
    if (c === "'") {
      this.note("single-quotes", "Converted single-quoted strings to double quotes.");
      this.output += this.readSingle();
      return;
    }
    if (IDENT_START.test(c)) {
      const word = this.readIdent();
      this.note("unquoted-keys", "Quoted unquoted keys.");
      this.output += JSON.stringify(word);
      return;
    }
  }

  private startsValue(): boolean {
    const c = this.peek();
    return (
      c === "{" ||
      c === "[" ||
      c === '"' ||
      c === "'" ||
      c === "+" ||
      c === "-" ||
      this.isDigit(c) ||
      IDENT_START.test(c)
    );
  }

  private readDouble(): string {
    const start = this.i;
    this.i += 1;
    let dirty = false;
    while (!this.eof()) {
      const c = this.peek();
      if (c === "\\") {
        this.i += 2;
        continue;
      }
      if (c === '"') {
        this.i += 1;
        break;
      }
      if (c.charCodeAt(0) < 0x20) {
        dirty = true;
        break;
      }
      this.i += 1;
    }
    if (!dirty) return this.src.slice(start, this.i);
    this.note(
      "raw-controls",
      "Escaped raw line breaks and tabs inside strings.",
    );
    this.i = start;
    return this.readDecodedDouble();
  }

  private readDecodedDouble(): string {
    this.i += 1;
    let decoded = "";
    while (!this.eof()) {
      const c = this.peek();
      if (c === '"') {
        this.i += 1;
        break;
      }
      if (c === "\\") {
        const next = this.src[this.i + 1];
        if (next === undefined) break;
        if (next === "u") {
          const hex = this.src.slice(this.i + 2, this.i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            decoded += String.fromCharCode(Number.parseInt(hex, 16));
            this.i += 6;
            continue;
          }
        }
        decoded += decodeEscape(next);
        this.i += 2;
        continue;
      }
      decoded += c;
      this.i += 1;
    }
    return JSON.stringify(decoded);
  }

  private readSingle(): string {
    this.i += 1;
    let decoded = "";
    while (!this.eof()) {
      const c = this.peek();
      if (c === "'") {
        this.i += 1;
        break;
      }
      if (c === "\\") {
        const next = this.src[this.i + 1];
        if (next === undefined) break;
        if (next === "u") {
          const hex = this.src.slice(this.i + 2, this.i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            decoded += String.fromCharCode(Number.parseInt(hex, 16));
            this.i += 6;
            continue;
          }
        }
        decoded += next === "'" ? "'" : decodeEscape(next);
        this.i += 2;
        continue;
      }
      decoded += c;
      this.i += 1;
    }
    return JSON.stringify(decoded);
  }

  private readNumber(): string {
    if (this.peek() === "+") {
      this.note("leading-plus", "Removed a leading + from a number.");
      this.i += 1;
    }
    let sign = "";
    if (this.peek() === "-") {
      sign = "-";
      this.i += 1;
    }
    if (this.peek() === "0" && (this.src[this.i + 1] === "x" || this.src[this.i + 1] === "X")) {
      this.i += 2;
      const hexStart = this.i;
      while (/[0-9a-fA-F]/.test(this.peek())) this.i += 1;
      const hex = this.src.slice(hexStart, this.i);
      this.note("hex", "Converted hexadecimal numbers to decimal.");
      try {
        return sign + BigInt(`0x${hex || "0"}`).toString(10);
      } catch {
        return `${sign}0`;
      }
    }
    const digStart = this.i;
    while (this.isDigit(this.peek())) this.i += 1;
    let intPart = this.src.slice(digStart, this.i);
    if (intPart.length > 1 && intPart.startsWith("0")) {
      this.note("leading-zero", "Removed leading zeros from a number.");
      intPart = intPart.replace(/^0+/, "") || "0";
    }
    if (intPart === "") intPart = "0";
    let rest = "";
    if (this.peek() === "." && this.isDigit(this.src[this.i + 1] ?? "")) {
      const from = this.i;
      this.i += 1;
      while (this.isDigit(this.peek())) this.i += 1;
      rest += this.src.slice(from, this.i);
    }
    if (this.peek() === "e" || this.peek() === "E") {
      const from = this.i;
      this.i += 1;
      if (this.peek() === "+" || this.peek() === "-") this.i += 1;
      while (this.isDigit(this.peek())) this.i += 1;
      rest += this.src.slice(from, this.i);
    }
    return sign + intPart + rest;
  }

  private readIdent(): string {
    const start = this.i;
    this.i += 1;
    while (IDENT_PART.test(this.peek())) this.i += 1;
    return this.src.slice(start, this.i);
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }
}

function decodeEscape(next: string): string {
  switch (next) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "\\":
    case "/":
    case '"':
    case "'":
      return next;
    default:
      return next;
  }
}
