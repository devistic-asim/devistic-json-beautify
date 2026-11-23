export interface RepairNote {
  code: string;
  message: string;
}

export interface JsonDiagnostic {
  message: string;
  hint: string;
  line: number;
  column: number;
  position: number;
  /** `input` matches the editor. `inner` is text after a wrapper or unescape. */
  subject: "input" | "inner";
  subjectNote?: string;
}

export type Indent = "2" | "4" | "tab";

export interface FormatOptions {
  indent: Indent;
  sortKeys: boolean;
  deepUnescape: boolean;
  style: "beautify" | "minify";
}

export interface FormatSuccess {
  ok: true;
  output: string;
  value: unknown;
  notes: RepairNote[];
  strict: boolean;
  originalIssue?: JsonDiagnostic;
}

export interface FormatFailure {
  ok: false;
  error: JsonDiagnostic;
  errorText: string;
  notes: RepairNote[];
}

export type FormatResult = FormatSuccess | FormatFailure;
