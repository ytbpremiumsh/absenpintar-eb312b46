import { useEffect, useCallback } from "react";

export type LandingTheme = "light" | "dark";

const KEY = "landing_theme";

export function useLandingTheme() {
  // Landing & Login are locked to light mode — dark background disabled per request.
  useEffect(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  }, []);

  const noop = useCallback((_t?: LandingTheme) => {}, []);
  return { theme: "light" as LandingTheme, setTheme: noop, toggle: () => {} };
}

/**
 * CSS overrides scoped under `[data-ls-theme="dark"]`.
 * Injects dark palette on top of the hardcoded light-mode hex classes used on
 * the landing & login pages, so we don't have to rewrite every className.
 */
export const LANDING_THEME_CSS = `
[data-ls-theme="dark"] { color-scheme: dark; }

/* Surfaces */
[data-ls-theme="dark"] .bg-white { background-color: #0f1530 !important; }
[data-ls-theme="dark"] .bg-\\[\\#f5f7fb\\] { background-color: #080d1c !important; }
[data-ls-theme="dark"] .bg-slate-50 { background-color: #0a1128 !important; }

/* Gradients that use white / slate-50 */
[data-ls-theme="dark"] .from-white { --tw-gradient-from: #0f1530 var(--tw-gradient-from-position) !important; --tw-gradient-to: rgb(15 21 48 / 0) var(--tw-gradient-to-position) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
[data-ls-theme="dark"] .to-slate-50 { --tw-gradient-to: #0a1128 var(--tw-gradient-to-position) !important; }

/* Text */
[data-ls-theme="dark"] .text-\\[\\#0b1020\\] { color: #f5f7fb !important; }
[data-ls-theme="dark"] [class*="text-[#0b1020]/"] { color: rgba(245,247,251,0.72) !important; }

/* Borders */
[data-ls-theme="dark"] .border-slate-100,
[data-ls-theme="dark"] .border-slate-200 { border-color: rgba(255,255,255,0.08) !important; }

/* Problem-list warm tints on light */
[data-ls-theme="dark"] .bg-red-50 { background-color: rgba(239,68,68,0.10) !important; }
[data-ls-theme="dark"] .border-red-100 { border-color: rgba(239,68,68,0.24) !important; }

/* Nav shadow tweaks — keep header visually separated */
[data-ls-theme="dark"] .shadow-\\[0_1px_0_0_rgba\\(15\\,23\\,42\\,0\\.06\\)\\,0_8px_24px_-12px_rgba\\(15\\,23\\,42\\,0\\.08\\)\\] {
  box-shadow: 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 24px -12px rgba(0,0,0,0.6) !important;
}
`;
