import type { JsonDiagnostic } from "./types";

export function positionAt(text: string, index: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < safe; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) {
      line += 1;
      column = 1;
    } else if (code === 13) {
      if (text.charCodeAt(i + 1) === 10) continue;
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

export function diagnostic(
  text: string,
  position: number,
  message: string,
  hint: string,
  subject: JsonDiagnostic["subject"] = "input",
  subjectNote?: string,
): JsonDiagnostic {
  const { line, column } = positionAt(text, position);
  return { message, hint, line, column, position, subject, subjectNote };
}

/** A few lines around the error, with a caret under the column. */
export function errorSnippet(source: string, line: number, column: number): string {
  const lines = source.split(/\n/);
  const index = Math.min(Math.max(line, 1), Math.max(lines.length, 1)) - 1;
  const from = Math.max(0, index - 1);
  const to = Math.min(lines.length, index + 2);
  const width = String(Math.max(to, 1)).length;
  const rendered: string[] = [];
  for (let i = from; i < to; i++) {
    const marker = i === index ? ">" : " ";
    const number = String(i + 1).padStart(width, " ");
    rendered.push(`${marker} ${number} | ${lines[i] ?? ""}`);
  }
  const prefix = 1 + 1 + width + 1 + 1 + 1;
  const caretAt = Math.max(1, column);
  rendered.push(`${" ".repeat(prefix + caretAt - 1)}^`);
  return rendered.join("\n");
}
