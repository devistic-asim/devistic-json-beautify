import { useState } from "react";
import { DataDialog } from "./components/DataDialog";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { JsonWorkspace } from "./components/JsonWorkspace";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { TextWorkspace } from "./components/TextWorkspace";
import { useStore } from "./store";

export function App() {
  const { state, resetToken, setTheme, updateSettings, dismissPrivacy } = useStore();
  const [dataOpen, setDataOpen] = useState(false);
  const mode = state.settings.mode;

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to the formatter
      </a>
      <Header
        mode={mode}
        theme={state.theme}
        onMode={(next) => updateSettings({ mode: next })}
        onTheme={setTheme}
      />
      {!state.privacyDismissed && <PrivacyNotice onDismiss={dismissPrivacy} />}
      <main id="main">
        <div hidden={mode !== "json"}>
          <JsonWorkspace key={`json-${resetToken}`} initial={state.draft.json} />
        </div>
        <div hidden={mode !== "text"}>
          <TextWorkspace key={`text-${resetToken}`} initial={state.draft.text} />
        </div>
      </main>
      <Footer onData={() => setDataOpen(true)} />
      <DataDialog open={dataOpen} onClose={() => setDataOpen(false)} />
    </div>
  );
}
