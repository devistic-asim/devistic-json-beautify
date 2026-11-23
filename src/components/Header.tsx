import type { AppMode, ThemeChoice } from "../lib/storage";

const THEMES: Array<{ id: ThemeChoice; label: string; title: string }> = [
  { id: "light", label: "Light", title: "Light theme" },
  { id: "dark", label: "Dark", title: "Dark theme" },
  { id: "system", label: "System", title: "Match the system theme" },
];

export function Header({
  mode,
  theme,
  onMode,
  onTheme,
}: {
  mode: AppMode;
  theme: ThemeChoice;
  onMode: (mode: AppMode) => void;
  onTheme: (theme: ThemeChoice) => void;
}) {
  const logo = `${import.meta.env.BASE_URL}devistic-logo.jpg`;
  return (
    <header className="topbar">
      <div className="brand">
        <a
          className="logo-link"
          href="https://github.com/devistic-asim"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Devistic on GitHub (opens in a new tab)"
        >
          <img src={logo} alt="" width={44} height={44} />
        </a>
        <div>
          <h1>Devistic JSON Beautify</h1>
          <p className="tagline">Format JSON and text in this browser. Nothing is uploaded.</p>
        </div>
      </div>
      <div className="header-controls">
        <div className="segment" role="group" aria-label="Tool">
          <button type="button" aria-pressed={mode === "json"} onClick={() => onMode("json")}>
            JSON
          </button>
          <button type="button" aria-pressed={mode === "text"} onClick={() => onMode("text")}>
            Text
          </button>
        </div>
        <div className="segment" role="group" aria-label="Color theme">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={theme === item.id}
              title={item.title}
              onClick={() => onTheme(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
