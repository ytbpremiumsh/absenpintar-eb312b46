import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, CreditCard as CardIcon } from "lucide-react";
import { toast } from "sonner";
import atskollaLogo from "@/assets/Logo_atskolla.png";

interface Props {
  student: {
    id: string;
    name: string;
    class?: string;
    student_id?: string;
    photo_url?: string | null;
    gender?: string;
    schools?: { name?: string; logo?: string | null };
    school_id?: string;
  };
}

function formatCard(n?: string) {
  if (!n) return "•••• •••• •••• ••••";
  const digits = n.replace(/\D/g, "").padEnd(16, "•");
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
}

export function StudentIdCard({ student }: Props) {
  const [cardNumber, setCardNumber] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Fetch card_number from DB (public.students select is allowed via existing RLS for authenticated,
      // but parent uses custom token — so we use edge if needed. Since we already have it in `student`
      // typically, fall back to direct fetch by id.)
      if ((student as any).card_number) {
        if (mounted) setCardNumber((student as any).card_number);
      } else {
        const { data } = await supabase
          .from("students")
          .select("card_number")
          .eq("id", student.id)
          .maybeSingle();
        if (mounted && data?.card_number) setCardNumber(data.card_number);
      }

      // Generate QR from student id / card number
      try {
        const QRCodeStyling = (await import("qr-code-styling")).default;
        const qr = new QRCodeStyling({
          width: 220,
          height: 220,
          data: (student as any).card_number || student.student_id || student.id,
          dotsOptions: { color: "#0f172a", type: "rounded" },
          backgroundOptions: { color: "#ffffff" },
          cornersSquareOptions: { type: "extra-rounded", color: "#5B6CF9" },
        });
        const blob = await qr.getRawData("png");
        if (blob && mounted) {
          const url = URL.createObjectURL(blob as Blob);
          setQrDataUrl(url);
        }
      } catch {/* ignore */}
    })();
    return () => { mounted = false; };
  }, [student.id]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const link = document.createElement("a");
      link.download = `kartu-pelajar-${student.name.replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Kartu berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh kartu");
    }
  };

  const schoolLogo = student.schools?.logo;
  const schoolName = student.schools?.name || "Sekolah";

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="relative w-full max-w-sm mx-auto rounded-[24px] overflow-hidden shadow-xl"
        style={{ aspectRatio: "1 / 1.58", background: "linear-gradient(135deg, #5B6CF9 0%, #4338CA 60%, #1E1B4B 100%)" }}
      >
        {/* Decorative shapes */}
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-10 h-48 w-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, white 1.2px, transparent 1.2px), radial-gradient(circle at 80% 90%, white 1.2px, transparent 1.2px)", backgroundSize: "28px 28px" }} />

        {/* Header */}
        <div className="relative flex items-center gap-2.5 p-5 text-white">
          <img src={schoolLogo || atskollaLogo} alt="" crossOrigin="anonymous" className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur p-1 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Kartu Pelajar</p>
            <p className="text-sm font-bold leading-tight truncate">{schoolName}</p>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-5 flex items-center gap-4 text-white">
          <div className="h-24 w-20 rounded-2xl bg-white/15 backdrop-blur ring-2 ring-white/40 overflow-hidden shrink-0 flex items-center justify-center text-3xl font-bold">
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name} crossOrigin="anonymous" className="h-full w-full object-cover" />
            ) : (
              <span>{student.name?.[0]}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Nama Siswa</p>
            <p className="text-lg font-bold leading-tight break-words">{student.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Kelas</p>
                <p className="text-xs font-semibold">{student.class || "-"}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">NIS</p>
                <p className="text-xs font-semibold">{student.student_id || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card number strip */}
        <div className="relative mx-5 mt-4 rounded-2xl bg-black/25 backdrop-blur border border-white/15 px-4 py-3 text-white">
          <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Nomor Kartu Identitas</p>
          <p className="font-mono text-base font-bold tracking-[0.15em] mt-0.5">{formatCard(cardNumber)}</p>
        </div>

        {/* QR */}
        <div className="relative flex items-end justify-between px-5 mt-4 text-white">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Scan untuk verifikasi</p>
            <p className="text-[10px] text-white/70 mt-1">Powered by ATSkolla</p>
          </div>
          {qrDataUrl && (
            <div className="h-24 w-24 rounded-xl bg-white p-1.5 shadow-lg">
              <img src={qrDataUrl} alt="QR" className="h-full w-full object-contain" />
            </div>
          )}
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
