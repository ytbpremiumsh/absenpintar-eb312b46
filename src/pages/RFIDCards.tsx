import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, Search, Nfc, Save, Trash2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Row = {
  kind: "student" | "staff";
  id: string;
  name: string;
  sub: string;
  rfid_uid: string | null;
};

async function readNfcOnce(signal: AbortSignal): Promise<string> {
  // @ts-ignore
  if (typeof window === "undefined" || !("NDEFReader" in window)) {
    throw new Error("Perangkat/browser ini tidak mendukung Web NFC. Gunakan Chrome di Android.");
  }
  // @ts-ignore
  const reader = new window.NDEFReader();
  await reader.scan({ signal });
  return await new Promise<string>((resolve, reject) => {
    reader.onreading = (ev: any) => {
      const uid = String(ev.serialNumber || "").replace(/:/g, "").toUpperCase();
      if (uid) resolve(uid); else reject(new Error("UID tidak terbaca"));
    };
    reader.onreadingerror = () => reject(new Error("Gagal membaca kartu"));
    signal.addEventListener("abort", () => reject(new Error("Dibatalkan")));
  });
}

export default function RFIDCards() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const [tab, setTab] = useState<"student" | "staff">("student");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Row | null>(null);
  const [uidInput, setUidInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [abort, setAbort] = useState<AbortController | null>(null);

  const load = async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    const [s, p] = await Promise.all([
      supabase.from("students").select("id,name,student_id,class,rfid_uid").eq("school_id", schoolId).order("class").order("name"),
      supabase.from("profiles").select("user_id,full_name,position,nip,rfid_uid").eq("school_id", schoolId).order("full_name"),
    ]);
    const out: Row[] = [
      ...(s.data || []).map((r: any) => ({ kind: "student" as const, id: r.id, name: r.name, sub: `${r.class} • ${r.student_id}`, rfid_uid: r.rfid_uid })),
      ...(p.data || []).map((r: any) => ({ kind: "staff" as const, id: r.user_id, name: r.full_name, sub: [r.position, r.nip].filter(Boolean).join(" • ") || "Staff", rfid_uid: r.rfid_uid })),
    ];
    setRows(out);
    setLoading(false);
  };
  useEffect(() => { load(); }, [schoolId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => r.kind === tab && (!s || r.name.toLowerCase().includes(s) || r.sub.toLowerCase().includes(s) || (r.rfid_uid || "").toLowerCase().includes(s)));
  }, [rows, q, tab]);

  const openAssign = (r: Row) => { setTarget(r); setUidInput(r.rfid_uid || ""); };
  const closeAssign = () => { abort?.abort(); setAbort(null); setScanning(false); setTarget(null); setUidInput(""); };

  const startScan = async () => {
    try {
      setScanning(true);
      const ctrl = new AbortController();
      setAbort(ctrl);
      const uid = await readNfcOnce(ctrl.signal);
      setUidInput(uid);
      toast.success(`Kartu terbaca: ${uid}`);
    } catch (e: any) {
      toast.error(e?.message || "Gagal scan NFC");
    } finally {
      setScanning(false);
      setAbort(null);
    }
  };

  const save = async () => {
    if (!target) return;
    const uid = uidInput.trim().toUpperCase();
    if (!uid) return toast.error("UID kosong");
    const table = target.kind === "student" ? "students" : "profiles";
    const idCol = target.kind === "student" ? "id" : "user_id";
    // uniqueness check
    const { data: dup } = await supabase.from(table).select(idCol).eq("rfid_uid", uid).neq(idCol, target.id).maybeSingle();
    if (dup) return toast.error("UID sudah dipakai orang lain di tabel ini");
    const { error } = await supabase.from(table).update({ rfid_uid: uid }).eq(idCol, target.id);
    if (error) return toast.error(error.message);
    toast.success("Kartu terdaftar");
    closeAssign(); load();
  };

  const clear = async () => {
    if (!target) return;
    const table = target.kind === "student" ? "students" : "profiles";
    const idCol = target.kind === "student" ? "id" : "user_id";
    const { error } = await supabase.from(table).update({ rfid_uid: null }).eq(idCol, target.id);
    if (error) return toast.error(error.message);
    toast.success("Kartu dihapus"); closeAssign(); load();
  };

  const assignedCount = rows.filter((r) => r.kind === tab && r.rfid_uid).length;
  const totalCount = rows.filter((r) => r.kind === tab).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CreditCard}
        title="Daftar Kartu RFID"
        subtitle="Kelola UID kartu RFID untuk siswa, guru, dan staff."
        actions={
          <Button asChild variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-white/20">
            <Link to="/rfid-test"><Smartphone className="h-4 w-4 mr-1.5" />Test NFC</Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="student">Siswa</TabsTrigger>
            <TabsTrigger value="staff">Guru & Staff</TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground">
            Terdaftar: <b>{assignedCount}</b> / {totalCount}
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, kelas, NIP, atau UID..." className="pl-9" />
        </div>

        <TabsContent value={tab} className="mt-3">
          <Card>
            <CardContent className="p-0 divide-y">
              {loading && <div className="p-6 text-center text-sm text-muted-foreground">Memuat…</div>}
              {!loading && filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada data.</div>}
              {filtered.map((r) => (
                <button key={`${r.kind}-${r.id}`} onClick={() => openAssign(r)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left transition">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] text-white flex items-center justify-center font-semibold shrink-0">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.sub}</div>
                  </div>
                  {r.rfid_uid ? (
                    <Badge variant="outline" className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {r.rfid_uid}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200">Belum</Badge>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(o) => !o && closeAssign()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Daftar Kartu RFID</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-semibold">{target.name}</div>
                <div className="text-xs text-muted-foreground">{target.sub}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">UID Kartu</label>
                <Input value={uidInput} onChange={(e) => setUidInput(e.target.value.toUpperCase())} placeholder="Contoh: 04A1B2C3D4E5F6" className="font-mono mt-1" />
              </div>
              <Button onClick={scanning ? () => { abort?.abort(); } : startScan} variant={scanning ? "destructive" : "outline"} className="w-full">
                {scanning ? (<><X className="h-4 w-4 mr-2" />Batalkan Scan</>) : (<><Nfc className="h-4 w-4 mr-2" />Scan via NFC HP (Android)</>)}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Tempelkan kartu ke bagian NFC Android. iOS Safari belum mendukung Web NFC — masukkan UID manual.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {target?.rfid_uid ? (
              <Button variant="ghost" onClick={clear} className="text-destructive"><Trash2 className="h-4 w-4 mr-1.5" />Hapus</Button>
            ) : <span />}
            <Button onClick={save}><Save className="h-4 w-4 mr-1.5" />Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
