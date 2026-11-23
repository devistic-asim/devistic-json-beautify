import { useRef, useState } from "react";
import { copyText, downloadText, readFile } from "../lib/browser";
import { TEXT_SAMPLE } from "../lib/samples";
import { applyTextAction, countPhrase, inputPreview, textStats, type TextAction } from "../lib/text/transform";
import { useStore } from "../store";
import { Editor } from "./Editor";

const ACTIONS: Array<{ id: TextAction; label: string; title: string }> = [
  { id: "clean", label: "Clean text", title: "Trim each line, collapse spaces, drop blank lines, and use LF line endings" },
  { id: "trim", label: "Trim lines", title: "Remove spaces and tabs at the start and end of each line" },
  { id: "collapse", label: "Collapse spaces", title: "Turn runs of spaces and tabs into a single space" },
  { id: "blank", label: "Remove blank lines", title: "Delete lines that are empty or only whitespace" },
  { id: "newlines", label: "Fix line endings", title: "Convert Windows and old Mac line endings to LF" },
  { id: "upper", label: "UPPERCASE", title: "Convert letters to uppercase" },
  { id: "lower", label: "lowercase", title: "Convert letters to lowercase" },
  { id: "title", label: "Capitalize Each Word", title: "Capitalize the first letter of each word" },
  { id: "sentence", label: "Sentence case", title: "Capitalize the first letter of each sentence" },
  { id: "camel", label: "camelCase", title: "Turn each line into a camelCase identifier" },
  { id: "snake", label: "snake_case", title: "Turn each line into snake_case" },
  { id: "kebab", label: "kebab-case", title: "Turn each line into kebab-case" },
];

export function TextWorkspace({ initial }: { initial: string }) {
  const { setDraft, remember, state, updateSettings, removeRecent } = useStore();
  const [input, setInput] = useState(initial);
  const [output, setOutput] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef(0);
  const stats = textStats(input);
  const outStats = textStats(output);

  function flash(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  function updateInput(text: string) {
    setInput(text);
    setDraft("text", text);
  }

  function run(action: TextAction) {
    if (!input.trim()) {
      flash("Paste some text first.");
      return;
    }
    setOutput(applyTextAction(input, action));
    remember("text", input);
    const label = ACTIONS.find((item) => item.id === action)?.label ?? "Done";
    setLastAction(label);
    flash(`${label} applied to the input.`);
  }

  async function paste() {
    try {
      updateInput(await navigator.clipboard.readText());
      flash("Pasted from the clipboard.");
    } catch {
      flash("Clipboard permission was blocked. Click the input and paste with the keyboard.");
    }
  }

  const recent = state.recent.filter((item) => item.mode === "text");

  return (
    <section className="workspace" aria-label="Text formatter">
      <div className="toolbar toolbar-wrap">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className={action.id === "clean" ? "btn btn-primary" : "btn"}
            title={action.title}
            onClick={() => run(action.id)}
          >
            {action.label}
          </button>
        ))}
        <label className="check" title="Wrap long lines in both editors">
          <input
            type="checkbox"
            checked={state.settings.wrap}
            onChange={(event) => updateSettings({ wrap: event.currentTarget.checked })}
          />
          Wrap lines
        </label>
      </div>
      <p className="hint">
        Each action reads the input and writes the output. The input stays put until you use the output as the next
        input. Identifier actions (camelCase, snake_case, kebab-case) run one line at a time.
      </p>
      <p className={lastAction ? "status status-ok" : "status"} role="status">
        {lastAction
          ? `${lastAction} applied to the input. The input itself is unchanged until you use the output as input.`
          : "Each action reads the input and writes the output."}
      </p>
      <p className="sr-only" aria-live="polite">
        {toast}
      </p>
      <div className="panes">
        <section className="pane" aria-labelledby="text-input-label">
          <div className="pane-head">
            <h2 id="text-input-label">Input</h2>
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
                accept=".txt,.json,.md,.log,text/plain"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  void readFile(file).then((text) => {
                    updateInput(text);
                    flash(`Loaded ${file.name}.`);
                  });
                }}
              />
              <button type="button" className="btn" onClick={() => updateInput("")}>
                Clear
              </button>
              <button type="button" className="btn" title="Load a messy sample" onClick={() => updateInput(TEXT_SAMPLE)}>
                Example
              </button>
            </div>
          </div>
          <Editor
            id="text-input"
            label="Text input"
            value={input}
            onChange={updateInput}
            placeholder="Paste text to clean, change case, or convert to camelCase, snake_case, or kebab-case."
            wrap={state.settings.wrap}
            onSubmit={() => run("clean")}
          />
          <p className="meta">
            {countPhrase(stats.lines, "line", "lines")} · {countPhrase(stats.words, "word", "words")} ·{" "}
            {countPhrase(stats.characters, "character", "characters")}
          </p>
        </section>
        <section className="pane" aria-labelledby="text-output-label">
          <div className="pane-head">
            <h2 id="text-output-label">Output</h2>
            <div className="pane-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!output) {
                    flash("Run an action first, then copy.");
                    return;
                  }
                  void copyText(output).then((ok) => flash(ok ? "Copied the output." : "Could not copy."));
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!output) {
                    flash("Run an action first, then download.");
                    return;
                  }
                  downloadText("formatted.txt", output, "text/plain");
                }}
              >
                Download .txt
              </button>
            </div>
          </div>
          <Editor
            id="text-output"
            label="Text output"
            value={output}
            readOnly
            wrap={state.settings.wrap}
            emptyText="Cleaned or converted text will show up here."
          />
          <p className="meta">
            {output ? (
              <>
                {countPhrase(outStats.lines, "line", "lines")} · {countPhrase(outStats.words, "word", "words")} ·{" "}
                {countPhrase(outStats.characters, "character", "characters")}{" "}
                <button type="button" className="linkish" onClick={() => updateInput(output)}>
                  Use output as input
                </button>
              </>
            ) : (
              "No output yet"
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
                <button type="button" className="chip" onClick={() => updateInput(item.text)}>
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
