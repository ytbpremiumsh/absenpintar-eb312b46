import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import atskollaLogo from "@/assets/Logo_atskolla.png";
import { downloadCardAsJpg } from "@/lib/downloadCard";

interface Props {
  teacher: {
    user_id: string;
    full_name: string;
    photo_url?: string | null;
    qr_code?: string | null;
    nip?: string | null;
    phone?: string | null;
    role_label?: string; // e.g. "Guru", "Operator", "Bendahara"
  };
  school: {
    name?: string;
    logo?: string | null;
  };
}

function formatNip(n?: string | null) {
  if (!n) return "•••• •••• •••• ••••";
  const digits = n.replace(/\D/g, "").padEnd(16, "•");
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
}

export function TeacherIdCard({ teacher, school }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const QRCodeStyling = (await import("qr-code-styling")).default;
        const qr = new QRCodeStyling({
          width: 220,
          height: 220,
          data: teacher.qr_code || teacher.user_id,
          dotsOptions: { color: "#0f172a", type: "rounded" },
          backgroundOptions: { color: "#ffffff" },
          cornersSquareOptions: { type: "extra-rounded", color: "#5B6CF9" },
        });
        const blob = await qr.getRawData("png");
        if (blob && mounted) {
          const url = URL.createObjectURL(blob as Blob);
          setQrDataUrl(url);
        }
      } catch {/* ignore */ }
    })();
    return () => { mounted = false; };
  }, [teacher.user_id, teacher.qr_code]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      await downloadCardAsJpg(cardRef.current, `kartu-guru-${teacher.full_name.replace(/\s+/g, "-")}`);
      toast.success("Kartu berhasil diunduh");
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengunduh kartu");
    }
  };

  const schoolLogo = school?.logo;
  const schoolName = school?.name || "Sekolah";
  const roleLabel = teacher.role_label || "Guru / Staff";

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="relative w-full max-w-sm mx-auto rounded-[24px] overflow-hidden shadow-xl"
        style={{ aspectRatio: "1 / 1.58", background: "linear-gradient(135deg, #5B6CF9 0%, #4338CA 60%, #1E1B4B 100%)" }}
      >
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-10 h-48 w-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, white 1.2px, transparent 1.2px), radial-gradient(circle at 80% 90%, white 1.2px, transparent 1.2px)", backgroundSize: "28px 28px" }} />

        <div className="absolute inset-0 flex flex-col">
          <div className="relative flex items-start gap-2.5 p-5 text-white">
            <img src={schoolLogo || atskollaLogo} alt="" crossOrigin="anonymous" className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur p-1 object-contain shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Kartu {roleLabel}</p>
              <p className="text-[13px] font-bold leading-tight break-words" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{schoolName}</p>
            </div>
          </div>

          <div className="relative px-5 flex items-center gap-4 text-white">
            <div style={{ width: 80, height: 100 }} className="rounded-2xl bg-white/15 backdrop-blur ring-2 ring-white/40 overflow-hidden shrink-0 flex items-center justify-center text-3xl font-bold">
              {teacher.photo_url ? (
                <img src={teacher.photo_url} alt={teacher.full_name} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <span>{teacher.full_name?.[0]}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Nama</p>
              <p className="text-lg font-bold leading-tight break-words">{teacher.full_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Jabatan</p>
                  <p className="text-xs font-semibold">{roleLabel}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Telp</p>
                  <p className="text-xs font-semibold">{teacher.phone || "-"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-5 mt-4 rounded-2xl bg-black/25 backdrop-blur border border-white/15 px-4 py-3 text-white">
            <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">NIP / Nomor Induk</p>
            <p className="font-mono text-base font-bold tracking-[0.15em] mt-0.5">{formatNip(teacher.nip)}</p>
          </div>

          <div className="relative flex-1 flex items-center justify-center px-5 text-white">
            {qrDataUrl && (
              <div style={{ width: 210, height: 210 }} className="rounded-2xl bg-white p-3 shadow-lg">
                <img src={qrDataUrl} alt="QR" className="h-full w-full object-contain" />
              </div>
            )}
          </div>

          <div className="relative px-5 pb-4 pt-2 text-center text-white">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-semibold">Scan untuk verifikasi</p>
            <p className="text-[10px] text-white/60 mt-0.5">Powered by ATSkolla</p>
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto flex gap-2">
        <Button onClick={handleDownload} className="flex-1 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white">
          <Download className="h-4 w-4 mr-2" /> Unduh Kartu
        </Button>
      </div>
    </div>
  );
}
