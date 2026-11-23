import type { Indent } from "./json/types";

export const THEME_KEY = "devistic-json-beautify-theme";
export const STORE_KEY = "devistic-json-beautify";

export type ThemeChoice = "light" | "dark" | "system";
export type AppMode = "json" | "text";

export interface Settings {
  indent: Indent;
  sortKeys: boolean;
  deepUnescape: boolean;
  mode: AppMode;
  wrap: boolean;
}

export interface RecentEntry {
  id: string;
  mode: AppMode;
  text: string;
  createdAt: string;
}

export interface PersistedState {
  version: 1;
  theme: ThemeChoice;
  settings: Settings;
  recent: RecentEntry[];
  draft: { json: string; text: string };
  privacyDismissed: boolean;
}

export interface BackupFile {
  product: "devistic-json-beautify";
  version: 1;
  exportedAt: string;
  theme: ThemeChoice;
  settings: Settings;
  recent: RecentEntry[];
  draft: { json: string; text: string };
  privacyDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  indent: "2",
  sortKeys: false,
  deepUnescape: false,
  mode: "json",
  wrap: false,
};

export function defaultState(): PersistedState {
  return {
    version: 1,
    theme: "system",
    settings: { ...DEFAULT_SETTINGS },
    recent: [],
    draft: { json: "", text: "" },
    privacyDismissed: false,
  };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...defaultState(), theme: loadTheme() };
    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    localStorage.setItem(THEME_KEY, state.theme);
  } catch {
    /* A full disk or private mode should not break the formatter. */
  }
}

export function loadTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* Ignore storage failures. */
  }
  return "system";
}

export function clearStored(): void {
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(THEME_KEY);
    sessionStorage.clear();
  } catch {
    /* Ignore storage failures. */
  }
}

export function toBackup(state: PersistedState): BackupFile {
  return {
    product: "devistic-json-beautify",
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: state.theme,
    settings: state.settings,
    recent: state.recent,
    draft: state.draft,
    privacyDismissed: state.privacyDismissed,
  };
}

export function recentToNdjson(recent: RecentEntry[]): string {
  return recent
    .map((entry) =>
      JSON.stringify({
        createdAt: entry.createdAt,
        mode: entry.mode,
        text: entry.text,
      }),
    )
    .join("\n");
}

export function parseBackup(raw: string): { ok: true; state: PersistedState } | { ok: false; message: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, message: "That file is not valid JSON." };
  }
  if (!isRecord(data)) return { ok: false, message: "The backup must be a JSON object." };
  if (data.product !== undefined && data.product !== "devistic-json-beautify") {
    return { ok: false, message: "This file is not a Devistic JSON Beautify backup." };
  }
  const base = defaultState();
  return { ok: true, state: normalizeState({ ...base, ...data, version: 1 }) };
}

function normalizeState(value: unknown): PersistedState {
  const base = defaultState();
  if (!isRecord(value)) return base;
  const settings = isRecord(value.settings) ? value.settings : {};
  const draft = isRecord(value.draft) ? value.draft : {};
  return {
    version: 1,
    theme: themeOf(value.theme),
    settings: {
      indent: settings.indent === "4" || settings.indent === "tab" ? settings.indent : "2",
      sortKeys: Boolean(settings.sortKeys),
      deepUnescape: Boolean(settings.deepUnescape),
      mode: settings.mode === "text" ? "text" : "json",
      wrap: Boolean(settings.wrap),
    },
    recent: Array.isArray(value.recent) ? value.recent.map(recentOf).filter((item) => item !== null).slice(0, 12) : [],
    draft: {
      json: typeof draft.json === "string" ? draft.json.slice(0, 400_000) : "",
      text: typeof draft.text === "string" ? draft.text.slice(0, 400_000) : "",
    },
    privacyDismissed: Boolean(value.privacyDismissed),
  };
}

function recentOf(value: unknown): RecentEntry | null {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : uid(),
    mode: value.mode === "text" ? "text" : "json",
    text: value.text.slice(0, 100_000),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
  };
}

function themeOf(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function applyTheme(choice: ThemeChoice): void {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0B1220" : "#F5F9FC");
}
