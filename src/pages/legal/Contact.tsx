import { useState } from "react";
import { Mail, Phone, MapPin, Clock, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import LegalLayout from "./LegalLayout";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Nama, email, dan pesan wajib diisi.");
      return;
    }
    setSending(true);
    // Fallback: open mail client with prefilled content
    const body = encodeURIComponent(
      `Nama: ${form.name}\nEmail: ${form.email}\n\n${form.message}`,
    );
    const subject = encodeURIComponent(form.subject || "Kontak dari website ATSkolla");
    window.location.href = `mailto:halo@atskolla.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSending(false);
      toast.success("Membuka aplikasi email Anda...");
    }, 800);
  };

  return (
    <LegalLayout
      title="Hubungi Kami"
      description="Informasi kontak resmi ATSkolla — email, nomor WhatsApp, alamat, dan jam operasional. Kirim pertanyaan Anda melalui formulir di bawah."
      path="/kontak"
    >
      <p>
        Tim ATSkolla siap membantu Anda. Silakan hubungi kami melalui salah satu kanal
        berikut atau kirim pesan langsung melalui formulir di bawah.
      </p>

      <div className="not-prose grid md:grid-cols-2 gap-6 my-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold text-[#5B6CF9] uppercase tracking-wider">Informasi Perusahaan</p>
          <h3 className="font-display text-xl font-bold text-[#0b1020] mt-1">ATSkolla</h3>
          <p className="text-sm text-slate-600 mt-1">Platform Digital Sekolah Terintegrasi</p>

          <ul className="mt-5 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center text-[#5B6CF9] flex-shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-[#0b1020]">Email</p>
                <a href="mailto:halo@atskolla.com" className="text-slate-600 hover:text-[#5B6CF9]">halo@atskolla.com</a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center text-[#5B6CF9] flex-shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-[#0b1020]">Telepon</p>
                <a href="tel:+6288861175370" className="text-slate-600 hover:text-[#5B6CF9]">+62 888 6117 537</a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center text-[#5B6CF9] flex-shrink-0">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-[#0b1020]">WhatsApp</p>
                <a href="https://wa.me/6288861175370" target="_blank" rel="noreferrer" className="text-slate-600 hover:text-[#5B6CF9]">+62 888 6117 537</a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center text-[#5B6CF9] flex-shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-[#0b1020]">Alamat</p>
                <p className="text-slate-600">Indonesia</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center text-[#5B6CF9] flex-shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-[#0b1020]">Jam Operasional</p>
                <p className="text-slate-600">Senin – Jumat, 08.00 – 17.00 WIB</p>
                <p className="text-slate-500 text-xs">Sabtu: 09.00 – 14.00 WIB · Minggu & Hari Libur: Tutup</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold text-[#5B6CF9] uppercase tracking-wider">Formulir Kontak</p>
          <h3 className="font-display text-xl font-bold text-[#0b1020] mt-1">Kirim Pesan</h3>
          <p className="text-sm text-slate-600 mt-1">Isi formulir di bawah, tim kami akan merespons secepatnya.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#5B6CF9] focus:ring-2 focus:ring-[#5B6CF9]/20"
                placeholder="Nama Anda"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#5B6CF9] focus:ring-2 focus:ring-[#5B6CF9]/20"
                placeholder="email@contoh.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Subjek</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#5B6CF9] focus:ring-2 focus:ring-[#5B6CF9]/20"
                placeholder="Pertanyaan tentang..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Pesan</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={5}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#5B6CF9] focus:ring-2 focus:ring-[#5B6CF9]/20 resize-none"
                placeholder="Tulis pesan Anda di sini..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#5B6CF9] text-white text-sm font-medium hover:bg-[#4a5ce8] transition-colors disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {sending ? "Mengirim..." : "Kirim Pesan"}
            </button>
          </form>
        </div>
      </div>
    </LegalLayout>
  );
}
