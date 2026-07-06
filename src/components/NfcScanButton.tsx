import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Nfc, Loader2, Smartphone } from "lucide-react";
import { useNfcScanner } from "@/hooks/useNfcScanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";


interface Props {
  onUid: (uid: string) => void;
  label?: string;
}

/**
 * Tombol scan RFID/NFC via smartphone (Chrome Android).
 * Wajib dipanggil dari user gesture (klik) agar browser prompt izin NFC muncul.
 */
export function NfcScanButton({ onUid, label = "Scan RFID via HP (NFC)" }: Props) {
  const isMobile = useIsMobile();
  const { supported, scanning, start, stop } = useNfcScanner((uid) => {

    onUid(uid);
    toast.success(`Kartu terdeteksi: ${uid}`);
  });

  useEffect(() => () => stop(), [stop]);

  if (!isMobile) return null;


  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleClick = async () => {
    if (scanning) { stop(); return; }
    if (!supported) {
      if (isIOS) {
        toast.error("iOS Safari/Chrome belum mendukung Web NFC. Gunakan Chrome di Android, atau app 'NFC Tools' untuk baca UID lalu ketik manual.");
      } else {
        toast.error("Perangkat/browser ini tidak mendukung Web NFC. Gunakan Chrome di Android dan aktifkan NFC.");
      }
      return;
    }
    await start();
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        onClick={handleClick}
        variant={scanning ? "secondary" : "outline"}
        className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
      >
        {scanning ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menunggu tap kartu... (tap untuk berhenti)</>
        ) : (
          <><Smartphone className="h-4 w-4 mr-2" /> {label}</>
        )}
      </Button>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Nfc className="h-3 w-3" /> Android Chrome: aktifkan NFC & izinkan situs. iOS: gunakan app NFC eksternal lalu ketik UID.
      </p>
    </div>
  );
}
