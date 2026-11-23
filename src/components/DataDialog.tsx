import { useRef, useState } from "react";
import { downloadText, readFile } from "../lib/browser";
import { recentToNdjson } from "../lib/storage";
import { useStore } from "../store";

export function DataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { backup, importBackup, clearAll, state } = useStore();
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!open) return null;

  function exportBackup() {
    downloadText(
      "devistic-json-beautify-backup.json",
      JSON.stringify(backup(), null, 2),
      "application/json",
    );
    setMessage("Downloaded the backup JSON.");
  }

  function exportRecent() {
    const body = recentToNdjson(state.recent);
    downloadText(
      "devistic-json-beautify-recent.ndjson",
      body.length ? `${body}\n` : "",
      "application/x-ndjson",
    );
    setMessage(state.recent.length ? "Downloaded recent inputs as NDJSON." : "Recent inputs are empty. Downloaded an empty file.");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const error = importBackup(await readFile(file));
    setMessage(error ?? "Imported your backup. Drafts, settings, and recent inputs were replaced.");
    setConfirming(false);
  }

  return (
    <dialog
      className="dialog"
      aria-labelledby="data-title"
      ref={(node) => {
        if (!node || node.open) return;
        try {
          node.showModal();
        } catch {
          /* The dialog is already showing. */
        }
      }}
      onClose={onClose}
    >
      <form method="dialog">
        <h2 id="data-title">Your data</h2>
        <p className="dialog-lead">
          Settings, drafts, and recent inputs stay in local storage on this device. You can take them with you, or
          delete them.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={exportBackup}>
            Download backup (.json)
          </button>
          <button type="button" className="btn" onClick={exportRecent}>
            Download recent (.ndjson)
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void onFile(file);
            }}
          />
        </div>
        <div className="danger-zone">
          <h3>Clear my local data</h3>
          <p>This deletes recent inputs, drafts, settings, and the saved theme in this browser.</p>
          {confirming ? (
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  clearAll();
                  setConfirming(false);
                  setMessage("Local data cleared.");
                }}
              >
                Delete local data
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              Clear my local data
            </button>
          )}
        </div>
        {message && (
          <p className="dialog-message" role="status">
            {message}
          </p>
        )}
        <div className="dialog-close">
          <button type="submit" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </dialog>
  );
}
