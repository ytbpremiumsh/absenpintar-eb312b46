import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Nfc, Smartphone, CheckCircle2, XCircle, Loader2, Info, Radio } from "lucide-react";

type Scan = {
  ts: number;
  uid: string;
  match?: { kind: "student" | "staff"; name: string; sub: string } | null;
};

export default function RFIDTest() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [ios, setIos] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIos(/iPad|iPhone|iPod/.test(ua));
    // @ts-ignore
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
    return () => abortRef.current?.abort();
  }, []);

  const lookup = async (uid: string): Promise<Scan["match"]> => {
    if (!schoolId) return null;
    const [s, p] = await Promise.all([
      supabase.from("students").select("name,student_id,class").eq("school_id", schoolId).eq("rfid_uid", uid).maybeSingle(),
      supabase.from("profiles").select("full_name,position,nip").eq("school_id", schoolId).eq("rfid_uid", uid).maybeSingle(),
    ]);
    if (s.data) return { kind: "student", name: s.data.name, sub: `${s.data.class} • ${s.data.student_id}` };
    if (p.data) return { kind: "staff", name: p.data.full_name, sub: [p.data.position, p.data.nip].filter(Boolean).join(" • ") || "Staff" };
    return null;
  };

  const start = async () => {
    setError(null);
    // @ts-ignore
    if (!("NDEFReader" in window)) {
      setError("Web NFC tidak didukung di browser ini. Gunakan Chrome di Android 8+.");
      return;
    }
    try {
      // @ts-ignore
      const reader = new window.NDEFReader();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      await reader.scan({ signal: ctrl.signal });
      setScanning(true);
      reader.onreading = async (ev: any) => {
        const uid = String(ev.serialNumber || "").replace(/:/g, "").toUpperCase();
        if (!uid) return;
        const match = await lookup(uid);
        setScans((prev) => [{ ts: Date.now(), uid, match }, ...prev].slice(0, 20));
        if (navigator.vibrate) navigator.vibrate(match ? 120 : [60, 40, 60]);
      };
      reader.onreadingerror = () => setError("Gagal membaca kartu. Coba tempel ulang.");
    } catch (e: any) {
      setError(e?.message || "Gagal memulai scan NFC");
      setScanning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={Radio} title="Test RFID via HP" subtitle="Uji baca kartu RFID/NFC menggunakan smartphone." variant="purple" />

      {ios && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <div className="font-semibold">iPhone/iOS terbatas</div>
              Safari iOS belum mendukung Web NFC. Untuk uji di iPhone, gunakan aplikasi <b>NFC Tools</b> (App Store) untuk membaca UID kartu, lalu masukkan manual di halaman <b>Daftar Kartu RFID</b>. Web NFC berfungsi penuh di <b>Chrome Android 8+</b>.
            </div>
          </CardContent>
        </Card>
      )}

      {supported === false && !ios && (
        <Card className="border-rose-300 bg-rose-50">
          <CardContent className="p-4 flex gap-3">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-900">
              <div className="font-semibold">Browser tidak mendukung Web NFC</div>
              Gunakan Google Chrome pada perangkat Android dengan NFC aktif (Pengaturan → Koneksi → NFC).
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 flex flex-col items-center text-center gap-4">
          <div className={`h-24 w-24 rounded-full flex items-center justify-center border-4 ${scanning ? "border-[#5B6CF9] animate-pulse bg-[#5B6CF9]/10" : "border-slate-200 bg-slate-50"}`}>
            {scanning ? <Loader2 className="h-10 w-10 text-[#5B6CF9] animate-spin" /> : <Nfc className="h-10 w-10 text-slate-500" />}
          </div>
          <div>
            <div className="font-semibold">
              {scanning ? "Menunggu kartu…" : "Siap memindai"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {scanning ? "Tempelkan kartu RFID ke bagian belakang HP." : "Tekan tombol di bawah, lalu izinkan akses NFC."}
            </div>
          </div>
          {!scanning ? (
            <Button onClick={start} className="bg-[#5B6CF9] hover:bg-[#4c5ded]" disabled={supported === false}>
              <Smartphone className="h-4 w-4 mr-2" />Mulai Scan
            </Button>
          ) : (
            <Button variant="outline" onClick={stop}>Hentikan</Button>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </CardContent>
      </Card>

      <div>
        <div className="text-sm font-semibold mb-2">Hasil Pemindaian</div>
        {scans.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Belum ada kartu yang dipindai.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {scans.map((s, i) => (
              <Card key={`${s.ts}-${i}`} className={s.match ? "border-emerald-200" : "border-amber-200"}>
                <CardContent className="p-3 flex items-center gap-3">
                  {s.match ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <XCircle className="h-5 w-5 text-amber-600 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{s.uid}</div>
                    {s.match ? (
                      <div className="text-sm font-medium">{s.match.name} <span className="text-xs text-muted-foreground">• {s.match.sub}</span></div>
                    ) : (
                      <div className="text-sm text-amber-700">Kartu belum terdaftar</div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{new Date(s.ts).toLocaleTimeString("id-ID")}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
