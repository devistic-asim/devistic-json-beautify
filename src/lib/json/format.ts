import { deepUnescape } from "./deep";
import { repairJsonish } from "./repair";
import { sameJson, sortKeysDeep } from "./sort";
import type { FormatOptions, FormatResult, JsonDiagnostic, RepairNote } from "./types";
import { unwrapStringified } from "./unwrap";
import { validateStrict } from "./validate";

const PREFIXES: Array<{ code: string; message: string; pattern: RegExp }> = [
  {
    code: "while-1",
    message:
      "Removed a while(1); prefix. Some APIs send that guard so a browser will not run the response as a script.",
    pattern: /^while\s*\(\s*1\s*\)\s*;\s*/,
  },
  {
    code: "while-true",
    message: "Removed a while(true); prefix.",
    pattern: /^while\s*\(\s*true\s*\)\s*;\s*/,
  },
  {
    code: "for-ever",
    message: "Removed a for(;;); prefix. It is another script-guard some APIs put in front of JSON.",
    pattern: /^for\s*\(\s*;\s*;\s*\)\s*;\s*/,
  },
  {
    code: "xssi",
    message: "Removed a )]}' prefix. Google-style APIs use it so the body is not valid JavaScript.",
    pattern: /^\)\]\}',?\s*/,
  },
];

export function formatJson(input: string, options: FormatOptions): FormatResult {
  const notes: RepairNote[] = [];
  if (!input.trim()) {
    const error = issue(
      input,
      0,
      "The input is empty.",
      "Paste JSON, drop a .json file, or load an example.",
    );
    return { ok: false, error, errorText: input, notes };
  }

  let text = input;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    notes.push({
      code: "bom",
      message: "Removed a byte-order mark from the start of the file.",
    });
  }

  for (const prefix of PREFIXES) {
    const match = prefix.pattern.exec(text.trimStart());
    if (!match) continue;
    const leading = text.length - text.trimStart().length;
    text = text.slice(leading + match[0].length);
    notes.push({ code: prefix.code, message: prefix.message });
    break;
  }

  const jsonp = stripJsonp(text.trim());
  if (jsonp) {
    text = jsonp.inner;
    notes.push({
      code: "jsonp",
      message: `Removed a JSONP wrapper (${jsonp.name}(...)). The payload inside is the JSON.`,
    });
  }

  const unwrapped = unwrapStringified(text.trim());
  if (unwrapped.levels > 0) {
    text = unwrapped.text;
    notes.push({
      code: "unwrap",
      message: `Unwrapped ${unwrapped.levels} level${unwrapped.levels === 1 ? "" : "s"} of stringified JSON.`,
    });
  }
  text = text.trim();

  const parsed = parseDocument(text, notes);
  if (!parsed.ok) {
    const analysis = validateStrict(input);
    const error =
      analysis.error ??
      issue(
        input,
        0,
        "This is not valid JSON.",
        "Check the quotes, commas, and brackets. The status line names the first problem.",
      );
    return { ok: false, error, errorText: input, notes };
  }

  let value = parsed.value;
  if (options.deepUnescape) {
    const deep = deepUnescape(value, true);
    if (deep.count > 0) {
      value = deep.value;
      notes.push({
        code: "deep-unescape",
        message: deep.capped
          ? `Unescaped ${deep.count} nested JSON strings, then stopped at the safety limit. Turn off Deep unescape to keep them as text.`
          : `Unescaped ${deep.count} nested JSON string${deep.count === 1 ? "" : "s"} inside values. Turn off Deep unescape to keep them as text.`,
      });
    }
  } else {
    const deep = deepUnescape(value, false);
    if (deep.count > 0) {
      notes.push({
        code: "deep-available",
        message: `Found ${deep.count} string value${deep.count === 1 ? "" : "s"} that look like nested JSON. Turn on Deep unescape to parse them.`,
      });
    }
  }

  if (options.sortKeys) {
    const sorted = sortKeysDeep(value);
    if (!sameJson(sorted, value)) {
      notes.push({ code: "sort-keys", message: "Sorted object keys from A to Z." });
    }
    value = sorted;
  }

  const analysis = validateStrict(input);
  for (const warning of analysis.warnings) {
    if (warning.code === "bom") continue;
    if (!notes.some((note) => note.code === warning.code)) notes.push(warning);
  }

  const indent =
    options.style === "minify" ? undefined : options.indent === "tab" ? "\t" : options.indent === "4" ? 4 : 2;
  const output = JSON.stringify(value, null, indent) ?? "";
  const strict = analysis.ok && !analysis.warnings.some((warning) => warning.code === "bom");
  return {
    ok: true,
    output,
    value,
    notes,
    strict,
    ...(!strict && analysis.error ? { originalIssue: analysis.error } : {}),
  };
}

export function escapeJsonText(text: string): string {
  return JSON.stringify(text);
}

function parseDocument(text: string, notes: RepairNote[]): { ok: true; value: unknown } | { ok: false } {
  const strict = validateStrict(text);
  if (strict.ok) {
    return { ok: true, value: JSON.parse(text) as unknown };
  }

  const directRecords = ndjsonRecords(text, false);
  if (directRecords) {
    notes.push(ndjsonNote(directRecords.length));
    return { ok: true, value: directRecords };
  }

  const repaired = repairJsonish(text);
  for (const note of repaired.notes) {
    if (!notes.some((item) => item.code === note.code)) notes.push(note);
  }
  if (repaired.text) {
    try {
      return { ok: true, value: JSON.parse(repaired.text) as unknown };
    } catch {
      /* Try each line before giving up. */
    }
  }

  const looseRecords = ndjsonRecords(text, true);
  if (looseRecords) {
    notes.push(ndjsonNote(looseRecords.length));
    return { ok: true, value: looseRecords };
  }
  return { ok: false };
}

function ndjsonNote(count: number): RepairNote {
  return {
    code: "ndjson",
    message: `Detected newline-delimited JSON (${count} records) and combined them into one array.`,
  };
}

function ndjsonRecords(text: string, repairLines: boolean): unknown[] | null {
  const lines = text.split(/\r?\n/);
  const records: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    records.push(trimmed);
  }
  if (records.length < 2) return null;
  const values: unknown[] = [];
  for (const record of records) {
    const unwrapped = unwrapStringified(record).text.trim();
    try {
      values.push(JSON.parse(unwrapped) as unknown);
      continue;
    } catch {
      if (!repairLines) return null;
    }
    const repaired = repairJsonish(unwrapped);
    try {
      values.push(JSON.parse(repaired.text) as unknown);
    } catch {
      return null;
    }
  }
  return values;
}

function stripJsonp(input: string): { name: string; inner: string } | null {
  const match = /^([A-Za-z_$][\w$.]*)\s*\(/.exec(input);
  if (!match) return null;
  const name = match[1] ?? "";
  if (name === "while" || name === "for" || name === "true" || name === "false" || name === "null") {
    return null;
  }
  const open = match[0].length;
  const close = findMatchingParen(input, open - 1);
  if (close < 0) return null;
  const tail = input.slice(close + 1).trim();
  if (tail !== "" && tail !== ";") return null;
  const inner = input.slice(open, close).trim();
  if (!/^[{[\-"'0-9tfn]/.test(inner)) return null;
  return { name, inner };
}

function findMatchingParen(input: string, openIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (let i = openIndex; i < input.length; i += 1) {
    const c = input[i];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function issue(text: string, position: number, message: string, hint: string): JsonDiagnostic {
  const analysis = validateStrict(text);
  if (analysis.error) return analysis.error;
  return {
    message,
    hint,
    line: 1,
    column: position + 1,
    position,
    subject: "input",
  };
}
