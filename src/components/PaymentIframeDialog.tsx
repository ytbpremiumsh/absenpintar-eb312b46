import { useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface PaymentIframeDialogProps {
  open: boolean;
  paymentUrl: string | null;
  title?: string;
  onClose: () => void;
  checkPaid?: () => Promise<boolean>;
  pollIntervalMs?: number;
  onPaid?: () => void;
  /** Metode pembayaran yang dipilih user — untuk menampilkan tata cara sesuai metode pada gateway external (iPaymu). */
  method?: "va" | "qris" | "retail" | string | null;
}

type StepList = { title: string; steps: string[] };

const METHOD_STEPS: Record<"va" | "qris" | "retail", StepList> = {
  qris: {
    title: "Tata Cara Pembayaran QRIS",
    steps: [
      "Klik tombol <b>Buka Halaman Pembayaran</b> di bawah, halaman QRIS akan terbuka di tab baru.",
      "Buka aplikasi mobile banking atau e-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja, dll) yang mendukung QRIS.",
      "Pilih menu <b>Scan / Bayar QRIS</b>, arahkan kamera ke kode QR yang tampil, lalu pastikan nominal sesuai.",
      "Konfirmasi pembayaran pada aplikasi. Setelah berhasil, <b>jangan tutup jendela ini</b> — tagihan akan otomatis tervalidasi.",
    ],
  },
  va: {
    title: "Tata Cara Pembayaran Virtual Account",
    steps: [
      "Klik tombol <b>Buka Halaman Pembayaran</b> di bawah untuk melihat nomor Virtual Account (VA).",
      "Catat atau salin <b>Nomor VA</b> dan <b>Nominal transfer</b> yang tertera pada halaman pembayaran.",
      "Buka aplikasi m-Banking / i-Banking / ATM Anda, pilih menu <b>Transfer</b> → <b>Virtual Account</b>, masukkan nomor VA tersebut.",
      "Pastikan nominal sesuai lalu selesaikan transfer. <b>Jangan tutup jendela ini</b> — status akan otomatis terverifikasi.",
    ],
  },
  retail: {
    title: "Tata Cara Pembayaran Retail (Alfamart / Indomaret)",
    steps: [
      "Klik tombol <b>Buka Halaman Pembayaran</b> di bawah untuk melihat kode pembayaran retail.",
      "Catat atau salin <b>Kode Pembayaran</b> dan <b>Nominal</b> yang tertera pada halaman.",
      "Datang ke kasir <b>Alfamart</b> / <b>Indomaret</b> terdekat sebelum kode kadaluarsa, sebutkan bayar tagihan dan berikan kode pembayaran.",
      "Bayar sesuai nominal ke kasir dan simpan struk. <b>Jangan tutup jendela ini</b> — pembayaran akan otomatis tervalidasi.",
    ],
  },
};

const DEFAULT_STEPS: StepList = {
  title: "Tata Cara Pembayaran",
  steps: [
    "Klik tombol <b>Buka Halaman Pembayaran</b> di bawah.",
    "Pilih metode pembayaran (QRIS, Virtual Account, atau Retail) sesuai yang tersedia.",
    "Selesaikan pembayaran sesuai instruksi (scan QRIS / transfer sesuai nominal ke Virtual Account).",
    "<b>Jangan menutup jendela ini.</b> Setelah pembayaran berhasil, tagihan akan otomatis tervalidasi dan jendela ini akan tertutup sendiri.",
  ],
};

const mustOpenOutsideIframe = (url?: string | null) => {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "payment.ipaymu.com" || host.endsWith(".ipaymu.com");
  } catch {
    return /ipaymu\.com/i.test(url);
  }
};

/**
 * Modal pembayaran in-dashboard.
 * Memuat halaman gateway (QRIS / Transfer Bank) di dalam iframe sehingga
 * pengguna tidak berpindah tab. Mendukung auto-close ketika pembayaran
 * berhasil — baik via postMessage dari gateway, navigasi iframe ke URL
 * sukses pada same-origin, maupun polling status melalui `checkPaid`.
 */
export const PaymentIframeDialog = ({
  open,
  paymentUrl,
  title = "Pembayaran QRIS / Transfer Bank",
  onClose,
  checkPaid,
  pollIntervalMs = 4000,
  onPaid,
}: PaymentIframeDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const closedRef = useRef(false);
  const externalOpenedRef = useRef<string | null>(null);
  const openOutside = mustOpenOutsideIframe(paymentUrl);

  const handlePaid = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    try { onPaid?.(); } catch { /* ignore optional callback errors */ }
    toast.success("Pembayaran berhasil. Terima kasih!");
    onClose();
  };

  // Reset guard setiap dialog dibuka kembali
  useEffect(() => {
    if (open) closedRef.current = false;
  }, [open, paymentUrl]);

  useEffect(() => {
    if (!open || !paymentUrl || !openOutside) return;
    if (externalOpenedRef.current === paymentUrl) return;
    externalOpenedRef.current = paymentUrl;
    window.open(paymentUrl, "_blank", "noopener,noreferrer");
  }, [open, paymentUrl, openOutside]);

  // 1) Listener postMessage dari gateway (jika gateway mengirim event)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MessageEvent) => {
      const data: unknown = e.data;
      if (!data) return;
      const str = typeof data === "string" ? data.toLowerCase() : "";
      const obj = typeof data === "object" ? data as Record<string, unknown> : {};
      const status = String(obj.status || obj.event || obj.type || "").toLowerCase();
      if (
        status.includes("paid") ||
        status.includes("success") ||
        status.includes("settle") ||
        str.includes("payment_success") ||
        str.includes("paid")
      ) {
        handlePaid();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 2) Cek navigasi iframe — kalau berpindah ke same-origin URL sukses
  useEffect(() => {
    if (!open) return;
    const onLoad = () => {
      try {
        const href = iframeRef.current?.contentWindow?.location?.href || "";
        if (/success|paid|thank|berhasil|complete/i.test(href)) handlePaid();
      } catch {
        // cross-origin → diabaikan
      }
    };
    const el = iframeRef.current;
    el?.addEventListener("load", onLoad);
    return () => el?.removeEventListener("load", onLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentUrl]);

  // 3) Polling status via checker yang disediakan parent
  useEffect(() => {
    if (!open || !checkPaid) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const ok = await checkPaid();
        if (!cancelled && ok) handlePaid();
      } catch {
        // abaikan, lanjut tick berikutnya
      }
    };
    const id = window.setInterval(tick, Math.max(1500, pollIntervalMs));
    // jalankan sekali segera setelah jeda singkat
    const first = window.setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentUrl, checkPaid, pollIntervalMs]);

  if (!paymentUrl) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 max-w-3xl w-[95vw] h-[88vh] overflow-hidden rounded-2xl border-0 shadow-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header — compact agar tidak menutupi konten pembayaran */}
        <div className="flex h-9 items-center justify-between gap-2 border-b bg-primary px-3 text-primary-foreground shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <p className="text-xs font-semibold truncate">{title}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground text-[11px]"
              onClick={() => window.open(paymentUrl, "_blank", "noopener,noreferrer")}
              title="Buka di tab baru"
            >
              <ExternalLink className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Tab Baru</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={onClose}
              title="Tutup"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {openOutside ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-5 sm:p-6">
            <div className="mx-auto max-w-md space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Informasi Pembayaran</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Halaman pembayaran akan terbuka di tab baru. Silakan ikuti tata cara di bawah, status pembayaran akan otomatis terdeteksi.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/60 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tata Cara Pembayaran</p>
                  <ol className="space-y-2 text-xs text-foreground/90">
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                      <span>Klik tombol <b>Buka Halaman Pembayaran</b> di bawah.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                      <span>Pilih metode pembayaran (QRIS, Virtual Account, atau Retail) sesuai yang tersedia.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
                      <span>Selesaikan pembayaran sesuai instruksi (scan QRIS / transfer sesuai nominal ke Virtual Account).</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">4</span>
                      <span><b>Jangan menutup jendela ini.</b> Setelah pembayaran berhasil, tagihan akan otomatis tervalidasi dan jendela ini akan tertutup sendiri.</span>
                    </li>
                  </ol>
                </div>

                <Button className="w-full h-11" onClick={() => window.open(paymentUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Buka Halaman Pembayaran
                </Button>

                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Menunggu konfirmasi pembayaran secara otomatis…
                </div>
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                Transaksi diproses aman oleh gateway pembayaran resmi.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 bg-muted/30">
            <iframe
              ref={iframeRef}
              src={paymentUrl}
              title="Halaman Pembayaran"
              className="w-full h-full border-0"
              allow="payment *; clipboard-write"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentIframeDialog;
