import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Web NFC scanner hook (Android Chrome). iOS Safari tidak mendukung Web NFC.
 * onUid dipanggil setiap kartu terbaca. Scanner tetap aktif sampai stop() dipanggil.
 */
export function useNfcScanner(onUid: (uid: string) => void) {
  const [supported, setSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cbRef = useRef(onUid);
  useEffect(() => { cbRef.current = onUid; }, [onUid]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
    return () => abortRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    // @ts-ignore
    if (!("NDEFReader" in window)) {
      toast.error("Perangkat ini tidak mendukung Web NFC (gunakan Chrome Android)");
      return false;
    }
    try {
      // @ts-ignore
      const reader = new window.NDEFReader();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      await reader.scan({ signal: ctrl.signal });
      reader.onreading = (ev: any) => {
        const uid = String(ev.serialNumber || "").replace(/:/g, "").toUpperCase();
        if (uid) {
          if (navigator.vibrate) navigator.vibrate(80);
          cbRef.current(uid);
        }
      };
      reader.onreadingerror = () => { /* biarkan senyap */ };
      setScanning(true);
      return true;
    } catch (e: any) {
      const msg = e?.message || "Gagal memulai scan NFC";
      if (String(msg).toLowerCase().includes("permission")) {
        toast.error("Izin NFC ditolak. Aktifkan NFC & izinkan situs ini.");
      } else {
        toast.error(msg);
      }
      setScanning(false);
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  }, []);

  return { supported, scanning, start, stop };
}
