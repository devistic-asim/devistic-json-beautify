import { useMemo, useRef, useState } from "react";
import { copyText, downloadText, readFile } from "../lib/browser";
import { describeValue } from "../lib/json/describe";
import { escapeJsonText, formatJson } from "../lib/json/format";
import { errorSnippet } from "../lib/json/locate";
import type { FormatOptions, FormatSuccess, JsonDiagnostic } from "../lib/json/types";
import { validateStrict } from "../lib/json/validate";
import { JSON_SAMPLES } from "../lib/samples";
import type { Settings } from "../lib/storage";
import { countPhrase, inputPreview, textStats } from "../lib/text/transform";
import { useStore } from "../store";
import { Editor } from "./Editor";
import { TreeView } from "./TreeView";

export function JsonWorkspace({ initial }: { initial: string }) {
  const { state, updateSettings, setDraft, remember, removeRecent } = useStore();
  const settings = state.settings;
  const [input, setInput] = useState(initial);
  const [result, setResult] = useState<FormatSuccess | null>(null);
  const [ranFor, setRanFor] = useState<string | null>(null);
  const [lastStyle, setLastStyle] = useState<FormatOptions["style"]>("beautify");
  const [report, setReport] = useState<JsonDiagnostic | null>(null);
  const [view, setView] = useState<"text" | "tree">("text");
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef(0);

  const live = useMemo(() => (input.trim() ? validateStrict(input) : null), [input]);
  const stale = result !== null && ranFor !== input;
  const inputStats = textStats(input);
  const outputStats = textStats(result?.output ?? "");

  function flash(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  function updateInput(text: string) {
    setInput(text);
    setDraft("json", text);
    setReport(null);
  }

  function execute(style: FormatOptions["style"], options: Settings, save: boolean) {
    const next = formatJson(input, {
      indent: options.indent,
      sortKeys: options.sortKeys,
      deepUnescape: options.deepUnescape,
      style,
    });
    setLastStyle(style);
    setRanFor(input);
    if (next.ok) {
      setResult(next);
      setReport(null);
      setView("text");
      if (save) remember("json", input);
      flash(next.strict ? (style === "minify" ? "Minified." : "Beautified.") : "Repaired and formatted.");
      return;
    }
    setResult(null);
    setReport(next.error);
    flash(next.error.message);
  }

  function patch(nextPatch: Partial<Settings>, rerun: boolean) {
    const next = { ...settings, ...nextPatch };
    updateSettings(nextPatch);
    if (rerun && input.trim() && ranFor === input) execute(lastStyle, next, false);
  }

  async function paste() {
    try {
      updateInput(await navigator.clipboard.readText());
      flash("Pasted from the clipboard.");
    } catch {
      flash("Clipboard permission was blocked. Click the input and paste with the keyboard.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await readFile(file);
    updateInput(text);
    flash(text.length > 1_500_000 ? "File loaded. It is large, so the tree may be slow." : `Loaded ${file.name}.`);
  }

  async function copyOutput() {
    if (!result) {
      flash("Beautify or minify first, then copy the output.");
      return;
    }
    flash((await copyText(result.output)) ? "Copied the output." : "Could not copy. Select the output and copy it manually.");
  }

  function download() {
    if (!result) {
      flash("Beautify or minify first, then download.");
      return;
    }
    downloadText(lastStyle === "minify" ? "minified.json" : "formatted.json", result.output, "application/json");
  }

  function escapeOutput() {
    const source = result?.output ?? input;
    if (!source.trim()) {
      flash("There is nothing to escape yet.");
      return;
    }
    const output = escapeJsonText(source);
    setResult({
      ok: true,
      output,
      value: JSON.parse(output) as unknown,
      notes: [
        {
          code: "escape",
          message: "Wrapped the text as an escaped JSON string. Beautify will unwrap stringified JSON again.",
        },
      ],
      strict: true,
    });
    setReport(null);
    setRanFor(input);
    setView("text");
    setLastStyle("minify");
    flash("Escaped as a JSON string.");
  }

  let tone: "idle" | "ok" | "warn" | "bad" = "idle";
  let status = "Paste JSON, or load an example.";
  if (report && !result) {
    tone = "bad";
    status = "Not valid JSON. The line and column are below.";
  } else if (result) {
    tone = result.strict ? "ok" : "warn";
    status = result.strict ? "Valid JSON." : "Repaired to valid JSON.";
    if (stale) status = `${status} The output is older than the input.`;
  } else if (live?.ok) {
    tone = "ok";
    status = live.warnings.length ? "Valid JSON, with a warning." : "Valid JSON.";
  } else if (live?.error) {
    tone = "warn";
    status = `Not strict JSON. Line ${live.error.line}, column ${live.error.column}: ${live.error.message}`;
  }

  const recent = state.recent.filter((item) => item.mode === "json");

  return (
    <section className="workspace" aria-label="JSON formatter">
      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={() => execute("beautify", settings, true)}>
          Beautify
        </button>
        <button type="button" className="btn" onClick={() => execute("minify", settings, true)}>
          Minify
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!input.trim()) {
              flash("Paste JSON to validate it.");
              return;
            }
            if (!live || live.ok) {
              setReport(null);
              flash(live?.warnings[0]?.message ?? "Valid JSON.");
              return;
            }
            if (live.error) {
              setReport(live.error);
              setResult(null);
              flash(live.error.message);
            }
          }}
        >
          Validate
        </button>
        <button type="button" className="btn" title="Wrap the output as an escaped JSON string" onClick={escapeOutput}>
          Escape
        </button>
        <label className="field">
          Indent
          <select
            aria-label="Indent"
            value={settings.indent}
            onChange={(event) =>
              patch({ indent: event.currentTarget.value as Settings["indent"] }, lastStyle === "beautify")
            }
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <label className="check" title="Sort object keys from A to Z in the output">
          <input
            type="checkbox"
            checked={settings.sortKeys}
            onChange={(event) => patch({ sortKeys: event.currentTarget.checked }, true)}
          />
          Sort keys
        </label>
        <label
          className="check"
          title="Parse JSON that is stored inside string values. Leave this off to keep those strings as text."
        >
          <input
            type="checkbox"
            checked={settings.deepUnescape}
            onChange={(event) => patch({ deepUnescape: event.currentTarget.checked }, true)}
          />
          Deep unescape
        </label>
        <label className="check" title="Wrap long lines in both editors">
          <input
            type="checkbox"
            checked={settings.wrap}
            onChange={(event) => updateSettings({ wrap: event.currentTarget.checked })}
          />
          Wrap lines
        </label>
      </div>
      <p className="hint">
        Beautify pretty-prints and repairs common JSON issues. Minify removes whitespace. Validate checks strict JSON
        and does not change a successful result. Escape wraps the output as a string like {'{"a":1}'}. Press{" "}
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> or <kbd>⌘</kbd>+<kbd>Enter</kbd> to beautify.
      </p>
      <details className="help">
        <summary>What Beautify can fix</summary>
        <ul>
          <li>Stringified JSON such as {'{"a":1}'}, including several layers of escaping.</li>
          <li>Nested JSON hidden inside string values, when Deep unescape is on.</li>
          <li>Trailing commas, comments, single quotes, and unquoted keys (JSON5-style).</li>
          <li>Newline-delimited JSON, combined into one array.</li>
          <li>A JSONP callback, or a while(1); / for(;;); / {")]}'"} guard in front of an API response.</li>
        </ul>
      </details>

      <p className={`status status-${tone}`} role="status">
        {status}
      </p>
      <p className="sr-only" aria-live="polite">
        {toast}
      </p>

      {report && (
        <div className="error-panel" role="alert">
          <p>
            <strong>
              Line {report.line}, column {report.column}.
            </strong>{" "}
            {report.message}
          </p>
          <pre className="snippet">{errorSnippet(input, report.line, report.column)}</pre>
          <p>{report.hint}</p>
        </div>
      )}

      {result && result.originalIssue && !stale && (
        <p className="original-issue">
          <strong>
            Original issue, line {result.originalIssue.line}, column {result.originalIssue.column}.
          </strong>{" "}
          {result.originalIssue.message} The output is the repaired JSON.
        </p>
      )}

      {result && result.notes.length > 0 && (
        <ul className="notes">
          {result.notes.map((note) => (
            <li key={note.code} className={note.code.endsWith("available") || note.code === "duplicate-key" || note.code === "precision" ? "note note-tip" : "note"}>
              {note.message}
            </li>
          ))}
        </ul>
      )}
      {result === null && live && live.warnings.length > 0 && (
        <ul className="notes">
          {live.warnings.map((note) => (
            <li key={note.code} className="note note-tip">
              {note.message}
            </li>
          ))}
        </ul>
      )}

      <div className="panes">
        <section className="pane" aria-labelledby="input-label">
          <div className="pane-head">
            <h2 id="input-label">Input</h2>
            <div className="pane-actions">
              <button type="button" className="btn" onClick={() => void paste()}>
                Paste
              </button>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                Import file
              </button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept=".json,.txt,.ndjson,.jsonl,application/json,text/plain"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void onFile(file);
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  updateInput("");
                  setResult(null);
                  setReport(null);
                  setRanFor(null);
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="samples" role="group" aria-label="Examples">
            {JSON_SAMPLES.map((sample) => (
              <button key={sample.id} type="button" className="chip" title={sample.title} onClick={() => updateInput(sample.text)}>
                {sample.label}
              </button>
            ))}
          </div>
          <Editor
            id="json-input"
            label="JSON input"
            value={input}
            onChange={updateInput}
            placeholder='Paste JSON here. Stringified responses, NDJSON, JSONP, comments, and trailing commas are all fine.'
            errorLine={live?.error?.line ?? null}
            wrap={settings.wrap}
            onSubmit={() => execute("beautify", settings, true)}
          />
          <p className="meta">
            {countPhrase(inputStats.lines, "line", "lines")} · {countPhrase(inputStats.characters, "character", "characters")}
          </p>
        </section>

        <section className="pane" aria-labelledby="output-label">
          <div className="pane-head">
            <h2 id="output-label">Output</h2>
            <div className="pane-actions">
              <div className="segment" role="group" aria-label="Output view">
                <button type="button" aria-pressed={view === "text"} onClick={() => setView("text")}>
                  Formatted
                </button>
                <button type="button" aria-pressed={view === "tree"} onClick={() => setView("tree")} disabled={!result}>
                  Tree
                </button>
              </div>
              <button type="button" className="btn" onClick={() => void copyOutput()}>
                Copy
              </button>
              <button type="button" className="btn" onClick={download}>
                Download .json
              </button>
            </div>
          </div>
          {view === "tree" && result ? (
            result.output.length > 400_000 ? (
              <p className="editor-empty">This result is large. Use the formatted view, or minify a smaller piece.</p>
            ) : (
              <TreeView value={result.value} onCopied={flash} />
            )
          ) : (
            <Editor
              id="json-output"
              label="Formatted JSON"
              value={result?.output ?? ""}
              readOnly
              highlighted
              wrap={settings.wrap}
              emptyText="Beautified JSON will show up here. Your text never leaves this browser."
            />
          )}
          <p className="meta">
            {result ? (
              <>
                {describeValue(result.value)} · {countPhrase(outputStats.lines, "line", "lines")} ·{" "}
                {countPhrase(outputStats.characters, "character", "characters")}
                {stale ? " · stale" : ""}
              </>
            ) : (
              "No output yet"
            )}
            {result && (
              <>
                {" "}
                <button type="button" className="linkish" onClick={() => updateInput(result.output)}>
                  Use output as input
                </button>
              </>
            )}
          </p>
        </section>
      </div>

      {recent.length > 0 && (
        <div className="recent">
          <h2>Recent</h2>
          <ul>
            {recent.map((item) => (
              <li key={item.id}>
                <button type="button" className="chip" title={item.text.slice(0, 240)} onClick={() => updateInput(item.text)}>
                  {inputPreview(item.text)}
                </button>
                <button type="button" className="icon-btn" aria-label="Remove this recent input" onClick={() => removeRecent(item.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {toast && <p className="toast">{toast}</p>}
    </section>
  );
}

