import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home, ArrowUp } from "lucide-react";
import logoAsset from "@/assets/logo-atskolla-official.png.asset.json";
import { cn } from "@/lib/utils";

const ATSKOLLA_LOGO_URL = logoAsset.url;

interface TocItem {
  id: string;
  label: string;
}

interface LegalLayoutProps {
  title: string;
  description: string;
  path: string;
  breadcrumb: string;
  updatedAt?: string;
  toc?: TocItem[];
  children: ReactNode;
  contentWidth?: "narrow" | "wide";
}

export function LegalLayout({
  title,
  description,
  path,
  breadcrumb,
  updatedAt,
  toc,
  children,
  contentWidth = "narrow",
}: LegalLayoutProps) {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const location = useLocation();

  // SEO tags
  useEffect(() => {
    document.title = `${title} — ATSkolla`;
    const setMeta = (key: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", description);
    setMeta("og:title", `${title} — ATSkolla`, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", `https://absenpintar.online${path}`, "property");
    setMeta("og:type", "website", "property");

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `https://absenpintar.online${path}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [title, description, path]);

  // Scroll progress + back-to-top + active TOC
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const h = doc.scrollHeight - doc.clientHeight;
      const p = h > 0 ? (doc.scrollTop / h) * 100 : 0;
      setProgress(p);
      setShowTop(doc.scrollTop > 400);

      if (toc && toc.length > 0) {
        let current = "";
        for (const item of toc) {
          const el = document.getElementById(item.id);
          if (el && el.getBoundingClientRect().top < 140) current = item.id;
        }
        setActiveId(current || toc[0].id);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const maxW = contentWidth === "wide" ? "max-w-6xl" : "max-w-5xl";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-[#5B6CF9] to-[#7c8bff] transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80">
        <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4", maxW)}>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={ATSKOLLA_LOGO_URL} alt="ATSkolla" className="h-9 w-auto object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {[
              { to: "/syarat-ketentuan", label: "Syarat" },
              { to: "/kebijakan-refund", label: "Refund" },
              { to: "/faq", label: "FAQ" },
              { to: "/kontak", label: "Kontak" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors",
                  location.pathname === l.to
                    ? "bg-[#5B6CF9]/10 text-[#5B6CF9]"
                    : "text-slate-600 hover:text-[#5B6CF9] hover:bg-slate-50",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#5B6CF9]"
          >
            <Home className="h-4 w-4" /> <span className="hidden sm:inline">Beranda</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#5B6CF9] via-[#5563e8] to-[#4a5ce8] text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.1), transparent 40%)"
        }} />
        <div className={cn("relative mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16", maxW)}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-white/75 mb-4">
            <Link to="/" className="hover:text-white">Beranda</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">{breadcrumb}</span>
          </nav>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            {title}
          </h1>
          <p className="mt-3 text-white/85 max-w-2xl text-sm md:text-base leading-relaxed">
            {description}
          </p>
          {updatedAt && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs text-white/90 border border-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Terakhir diperbarui: {updatedAt}
            </div>
          )}
        </div>
      </section>

      {/* Content area */}
      <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14", maxW)}>
        <div className={cn("grid gap-8", toc && toc.length > 0 ? "lg:grid-cols-[220px_1fr]" : "")}>
          {/* TOC */}
          {toc && toc.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
                  Daftar Isi
                </p>
                <ul className="space-y-0.5">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => scrollTo(item.id)}
                        className={cn(
                          "w-full text-left text-sm px-3 py-2 rounded-lg transition-all border-l-2",
                          activeId === item.id
                            ? "text-[#5B6CF9] bg-[#5B6CF9]/5 border-[#5B6CF9] font-medium"
                            : "text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-100/70",
                        )}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          {/* Article */}
          <main>
            <div className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-6 md:p-10">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "fixed bottom-6 right-6 h-11 w-11 rounded-full bg-[#5B6CF9] text-white shadow-lg shadow-[#5B6CF9]/30 flex items-center justify-center transition-all hover:scale-110 z-40",
          showTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
        )}
        aria-label="Kembali ke atas"
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/70 mt-6">
        <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-10", maxW)}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={ATSKOLLA_LOGO_URL} alt="ATSkolla" className="h-8 w-auto object-contain" />
              <div className="text-xs text-slate-500">
                <p className="font-medium text-slate-700">ATSkolla</p>
                <p>Platform Digital Sekolah Terintegrasi</p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <Link to="/syarat-ketentuan" className="hover:text-[#5B6CF9]">Syarat & Ketentuan</Link>
              <Link to="/kebijakan-refund" className="hover:text-[#5B6CF9]">Kebijakan Refund</Link>
              <Link to="/faq" className="hover:text-[#5B6CF9]">FAQ</Link>
              <Link to="/kontak" className="hover:text-[#5B6CF9]">Kontak</Link>
            </nav>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} ATSkolla. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LegalLayout;

/* Shared building blocks for legal pages */

export function SectionHeading({ id, num, children }: { id: string; num: number | string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 flex items-center gap-3 font-display text-xl md:text-2xl font-bold text-slate-900 mt-10 first:mt-0 mb-4 pb-3 border-b border-slate-100">
      <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#5B6CF9]/10 text-[#5B6CF9] text-sm font-bold">
        {num}
      </span>
      <span>{children}</span>
    </h2>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="text-[15px] leading-relaxed text-slate-600 space-y-3 [&_a]:text-[#5B6CF9] [&_a:hover]:underline [&_strong]:text-slate-900 [&_strong]:font-semibold">
      {children}
    </div>
  );
}

export function CheckList({
  items,
  variant = "default",
}: {
  items: (string | ReactNode)[];
  variant?: "default" | "success" | "danger";
}) {
  const color =
    variant === "success"
      ? "text-emerald-600 bg-emerald-50"
      : variant === "danger"
      ? "text-red-600 bg-red-50"
      : "text-[#5B6CF9] bg-[#5B6CF9]/10";
  const icon =
    variant === "danger" ? "✕" : variant === "success" ? "✓" : "•";
  return (
    <ul className="space-y-2.5 mt-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] text-slate-600 leading-relaxed">
          <span className={cn("mt-0.5 h-5 w-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0", color)}>
            {icon}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function InfoCallout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success";
  title?: string;
  children: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-[#5B6CF9]/25 bg-[#5B6CF9]/5 text-slate-700";
  return (
    <div className={cn("mt-5 rounded-xl border p-4 text-sm leading-relaxed", styles)}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
