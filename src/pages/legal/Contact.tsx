import { useState } from "react";
import { Mail, Phone, MapPin, Clock, MessageCircle, Send, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import LegalLayout from "./LegalLayout";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const CONTACT_CARDS = [
  {
    icon: Mail,
    label: "Email",
    value: "halo@atskolla.com",
    href: "mailto:halo@atskolla.com",
    note: "Respons dalam 1×24 jam kerja",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+62 888 6117 537",
    href: "https://wa.me/6288861175370",
    note: "Chat langsung dengan tim",
  },
  {
    icon: Phone,
    label: "Telepon",
    value: "+62 888 6117 537",
    href: "tel:+6288861175370",
    note: "Jam operasional saja",
  },
];

const HOURS = [
  { day: "Senin – Jumat", time: "08.00 – 17.00 WIB", open: true },
  { day: "Sabtu", time: "09.00 – 14.00 WIB", open: true },
  { day: "Minggu & Libur Nasional", time: "Tutup", open: false },
];

export default function Contact() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = "Nama wajib diisi";
    if (!form.email.trim()) e.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Format email tidak valid";
    if (!form.message.trim()) e.message = "Pesan wajib diisi";
    else if (form.message.trim().length < 10) e.message = "Pesan minimal 10 karakter";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Mohon periksa kembali data Anda.");
      return;
    }
    setSending(true);
    const body = encodeURIComponent(`Nama: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    const subject = encodeURIComponent(form.subject || "Kontak dari website ATSkolla");
    window.location.href = `mailto:halo@atskolla.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSending(false);
      toast.success("Membuka aplikasi email Anda...");
    }, 800);
  };

  const inputCls = (hasError?: boolean) =>
    cn(
      "w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all",
      hasError
        ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-red-100"
        : "border-slate-200 bg-white focus:border-[#5B6CF9] focus:ring-[#5B6CF9]/15",
    );

  return (
    <LegalLayout
      title="Hubungi Kami"
      description="Informasi kontak resmi ATSkolla — email, WhatsApp, alamat, dan jam operasional. Kirim pertanyaan Anda melalui formulir di bawah."
      path="/kontak"
      breadcrumb="Kontak"
      contentWidth="wide"
    >
      {/* Business identity */}
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#5B6CF9]/5 to-transparent border border-[#5B6CF9]/15">
        <div className="h-12 w-12 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-[#5B6CF9]" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#5B6CF9] uppercase tracking-wider">Nama Usaha</p>
          <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">ATSkolla</h2>
          <p className="text-sm text-slate-600 mt-1">Platform Digital Sekolah Terintegrasi untuk sekolah di seluruh Indonesia.</p>
        </div>
      </div>

      {/* Contact cards */}
      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        {CONTACT_CARDS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-[#5B6CF9]/40 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center text-[#5B6CF9] group-hover:bg-[#5B6CF9] group-hover:text-white transition-colors">
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-xs text-slate-500 mt-4">{c.label}</p>
            <p className="font-semibold text-slate-900 mt-1 group-hover:text-[#5B6CF9] break-all">{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.note}</p>
          </a>
        ))}
      </div>

      {/* Address + Hours + Form */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* Left: address + hours */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-[#5B6CF9]" />
              <p className="font-semibold text-slate-900">Alamat Usaha</p>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">JL Logawa Raya RT 4 / RW 2, Pangebatan, Banyumas, Jawa Tengah 53161, Indonesia</p>
            <p className="text-xs text-slate-400 mt-2">Layanan tersedia untuk sekolah di seluruh wilayah Indonesia (100% online).</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-[#5B6CF9]" />
              <p className="font-semibold text-slate-900">Jam Operasional</p>
            </div>
            <ul className="space-y-2.5">
              {HOURS.map((h) => (
                <li key={h.day} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", h.open ? "bg-emerald-500" : "bg-slate-300")} />
                    {h.day}
                  </span>
                  <span className={cn("font-medium", h.open ? "text-slate-900" : "text-slate-400")}>{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-1">
            <Send className="h-4 w-4 text-[#5B6CF9]" />
            <p className="font-semibold text-slate-900">Kirim Pesan</p>
          </div>
          <p className="text-xs text-slate-500 mb-5">Isi formulir di bawah, tim kami akan merespons secepatnya.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls(!!errors.name)}
                placeholder="Nama Anda"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls(!!errors.email)}
                placeholder="email@contoh.com"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Subjek</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className={inputCls()}
                placeholder="Pertanyaan tentang..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pesan <span className="text-red-500">*</span>
                <span className="text-slate-400 font-normal ml-1">({form.message.length}/500)</span>
              </label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value.slice(0, 500) })}
                rows={5}
                className={cn(inputCls(!!errors.message), "resize-none")}
                placeholder="Tulis pesan Anda di sini..."
              />
              {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-[#5B6CF9] to-[#4a5ce8] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#5B6CF9]/25 transition-all disabled:opacity-60"
            >
              {sending ? (
                <>Mengirim...</>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Kirim Pesan
                </>
              )}
            </button>

            <p className="flex items-start gap-2 text-xs text-slate-400 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>Data Anda hanya digunakan untuk membalas pesan ini dan tidak akan dibagikan ke pihak ketiga.</span>
            </p>
          </form>
        </div>
      </div>
    </LegalLayout>
  );
}
