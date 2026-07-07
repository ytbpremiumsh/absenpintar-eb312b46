import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import logoAsset from "@/assets/logo-atskolla-official.png.asset.json";

const ATSKOLLA_LOGO_URL = logoAsset.url;

interface LegalLayoutProps {
  title: string;
  description: string;
  path: string;
  updatedAt?: string;
  children: ReactNode;
}

export function LegalLayout({ title, description, path, updatedAt, children }: LegalLayoutProps) {
  useEffect(() => {
    document.title = `${title} — ATSkolla`;
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
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
  }, [title, description, path]);

  return (
    <div className="min-h-screen bg-white font-sans text-[#0b1020] antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={ATSKOLLA_LOGO_URL} alt="ATSkolla" className="h-9 w-auto object-contain" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#5B6CF9] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#5B6CF9] to-[#4a5ce8] text-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-14">
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-white/85 max-w-2xl">{description}</p>
          {updatedAt && (
            <p className="mt-4 text-xs text-white/70">Terakhir diperbarui: {updatedAt}</p>
          )}
        </div>
      </section>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <article className="prose prose-slate max-w-none prose-headings:font-display prose-headings:text-[#0b1020] prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-lg prose-a:text-[#5B6CF9] prose-strong:text-[#0b1020]">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 mt-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-10 grid md:grid-cols-3 gap-8 text-sm text-slate-600">
          <div>
            <img src={ATSKOLLA_LOGO_URL} alt="ATSkolla" className="h-9 w-auto object-contain mb-3" />
            <p>Platform Digital Sekolah Terintegrasi.</p>
          </div>
          <div>
            <p className="font-semibold text-[#0b1020] mb-3">Informasi Legal</p>
            <ul className="space-y-2">
              <li><Link to="/syarat-ketentuan" className="hover:text-[#5B6CF9]">Syarat & Ketentuan</Link></li>
              <li><Link to="/kebijakan-refund" className="hover:text-[#5B6CF9]">Kebijakan Refund</Link></li>
              <li><Link to="/faq" className="hover:text-[#5B6CF9]">FAQ</Link></li>
              <li><Link to="/kontak" className="hover:text-[#5B6CF9]">Kontak</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#0b1020] mb-3">Kontak</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#5B6CF9]" /> +62 888 6117 537</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#5B6CF9]" /> halo@atskolla.com</li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#5B6CF9]" /> Indonesia</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} ATSkolla. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default LegalLayout;
