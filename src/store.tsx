import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  applyTheme,
  clearStored,
  defaultState,
  loadState,
  parseBackup,
  saveState,
  toBackup,
  uid,
  type AppMode,
  type PersistedState,
  type RecentEntry,
  type Settings,
  type ThemeChoice,
} from "./lib/storage";

interface StoreValue {
  state: PersistedState;
  setTheme: (theme: ThemeChoice) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setDraft: (mode: AppMode, text: string) => void;
  remember: (mode: AppMode, text: string) => void;
  removeRecent: (id: string) => void;
  dismissPrivacy: () => void;
  resetToken: number;
  importBackup: (raw: string) => string | null;
  clearAll: () => void;
  backup: () => ReturnType<typeof toBackup>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [resetToken, setResetToken] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = window.setTimeout(() => saveState(state), 150);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    applyTheme(state.theme);
    if (state.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [state.theme]);

  const setTheme = useCallback((theme: ThemeChoice) => {
    setState((current) => ({ ...current, theme }));
  }, []);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);
  const setDraft = useCallback((mode: AppMode, text: string) => {
    setState((current) => ({
      ...current,
      draft: { ...current.draft, [mode]: text.slice(0, 400_000) },
    }));
  }, []);
  const remember = useCallback((mode: AppMode, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || text.length > 100_000) return;
    const entry: RecentEntry = {
      id: uid(),
      mode,
      text,
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      recent: [entry, ...current.recent.filter((item) => item.mode !== mode || item.text !== text)].slice(0, 12),
    }));
  }, []);
  const removeRecent = useCallback((id: string) => {
    setState((current) => ({ ...current, recent: current.recent.filter((item) => item.id !== id) }));
  }, []);
  const dismissPrivacy = useCallback(() => {
    setState((current) => ({ ...current, privacyDismissed: true }));
  }, []);
  const importBackup = useCallback((raw: string) => {
    const parsed = parseBackup(raw);
    if (!parsed.ok) return parsed.message;
    setState(parsed.state);
    setResetToken((token) => token + 1);
    applyTheme(parsed.state.theme);
    return null;
  }, []);
  const clearAll = useCallback(() => {
    clearStored();
    setState(defaultState());
    setResetToken((token) => token + 1);
    applyTheme("system");
  }, []);
  const backup = useCallback(() => toBackup(stateRef.current), []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      resetToken,
      setTheme,
      updateSettings,
      setDraft,
      remember,
      removeRecent,
      dismissPrivacy,
      importBackup,
      clearAll,
      backup,
    }),
    [
      state,
      resetToken,
      setTheme,
      updateSettings,
      setDraft,
      remember,
      removeRecent,
      dismissPrivacy,
      importBackup,
      clearAll,
      backup,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
