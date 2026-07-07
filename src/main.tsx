import { createRoot } from "react-dom/client";
// Trim font weights to only what the landing/app actually renders above the fold.
// Additional weights can be added later per-page if needed.
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import App from "./App.tsx";
import "./index.css";

// Lazy-load remaining font weights after first paint so they don't block LCP.
if (typeof window !== "undefined") {
  const loadRest = () => {
    import("@fontsource/sora/400.css");
    import("@fontsource/sora/600.css");
    import("@fontsource/manrope/500.css");
    import("@fontsource/manrope/700.css");
  };
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(loadRest, { timeout: 2000 });
  } else {
    setTimeout(loadRest, 1200);
  }
}

// Global safety nets — catch stray errors so they don't vanish silently.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    // eslint-disable-next-line no-console
    console.error("[unhandledrejection]", event.reason);
  });
  window.addEventListener("error", (event) => {
    // eslint-disable-next-line no-console
    console.error("[window.error]", event.message, event.error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
