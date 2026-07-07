// Lightweight loading screen — pure CSS animations, no framer-motion, no network fetch.
// Keeps the whole component cheap so it never blocks initial render.

const LOGO_SRC = "https://absenpintar.online/images/logo-atskolla-loading.png";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#5B6CF9]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-white/15 blur-xl animate-pulse" />
          <div className="relative z-10 h-20 w-20 rounded-2xl bg-white shadow-2xl flex items-center justify-center p-2">
            <img
              src={LOGO_SRC}
              alt="ATSkolla"
              className="h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        <div className="flex items-end gap-1 h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-white/70 animate-[loadingBar_0.9s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.12}s`, height: 8 }}
            />
          ))}
        </div>

        <p className="text-white/60 text-xs">Memuat...</p>
      </div>

      <style>{`
        @keyframes loadingBar {
          0%, 100% { height: 8px; }
          50% { height: 22px; }
        }
      `}</style>
    </div>
  );
}
