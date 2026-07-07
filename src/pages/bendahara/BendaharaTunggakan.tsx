import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AlertTriangle, Users, GraduationCap, Loader2, Send } from "lucide-react";
import { StatCard } from "./BendaharaPages";

// Icon WhatsApp (inline SVG) — brand-consistent
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16.001 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.6 4.47 1.74 6.42L3.2 28.8l6.55-1.71a12.75 12.75 0 0 0 6.25 1.62h.01c7.07 0 12.8-5.73 12.8-12.8s-5.73-12.8-12.81-12.8Zm0 23.34h-.01a10.5 10.5 0 0 1-5.36-1.47l-.38-.23-3.89 1.02 1.04-3.79-.25-.39a10.55 10.55 0 0 1-1.61-5.58c0-5.83 4.75-10.58 10.58-10.58s10.58 4.75 10.58 10.58-4.74 10.44-10.7 10.44Zm5.8-7.83c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.83 1.04-1.02 1.25-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.77-2.22-.19-.32-.02-.5.14-.66.14-.14.32-.38.48-.57.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.57-.08-.16-.72-1.73-.99-2.37-.26-.63-.53-.54-.72-.55l-.62-.01c-.21 0-.55.08-.83.4-.29.32-1.1 1.07-1.1 2.62s1.13 3.04 1.29 3.25c.16.21 2.24 3.42 5.42 4.79.76.33 1.35.52 1.81.67.76.24 1.45.21 1.99.13.61-.09 1.89-.77 2.16-1.51.27-.75.27-1.39.19-1.51-.08-.13-.29-.21-.61-.37Z"/>
  </svg>
);


const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export default function BendaharaTunggakan() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [fClass, setFClass] = useState<string>("all");
  const [fMonth, setFMonth] = useState<string>("all");
  const [fYear, setFYear] = useState<string>(String(new Date().getFullYear()));
  const [waFlag, setWaFlag] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;
    setLoading(true);
    const [inv, cl, sc, sch] = await Promise.all([
      supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id).in("status", ["pending", "unpaid"]),
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("schools").select("name, bendahara_wa_enabled").eq("id", profile.school_id).maybeSingle(),
      supabase.from("students").select("id, parent_phone").eq("school_id", profile.school_id),
    ]);
    const phoneMap = new Map<string, string>();
    ((sch.data as any[]) || []).forEach((s: any) => { if (s.parent_phone) phoneMap.set(s.id, s.parent_phone); });
    const now = new Date();
    const overdue = ((inv.data as any[]) || []).filter((i: any) => new Date(i.due_date) < now)
      .map((i: any) => ({ ...i, parent_phone: i.parent_phone || phoneMap.get(i.student_id) || null }));
    setRows(overdue);
    setClasses(((cl.data as any[]) || []).map((x) => x.name));
    setSchool(sc.data);
    setWaFlag((sc.data as any)?.bendahara_wa_enabled !== false);
    setLoading(false);
  }, [profile?.school_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fClass !== "all" && r.class_name !== fClass) return false;
      if (fMonth !== "all" && String(r.period_month) !== fMonth) return false;
      if (fYear !== "all" && String(r.period_year) !== fYear) return false;
      return true;
    });
  }, [rows, fClass, fMonth, fYear]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
    const studentIds = new Set(filtered.map((r) => r.student_id));
    return { total, students: studentIds.size, invoices: filtered.length };
  }, [filtered]);

  const perClass = useMemo(() => {
    const map = new Map<string, { count: number; students: Set<string>; total: number }>();
    filtered.forEach((r) => {
      const e = map.get(r.class_name) || { count: 0, students: new Set<string>(), total: 0 };
      e.count += 1; e.students.add(r.student_id); e.total += r.total_amount || 0;
      map.set(r.class_name, e);
    });
    return Array.from(map.entries()).map(([cls, v]) => ({ cls, count: v.count, students: v.students.size, total: v.total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const perType = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filtered.forEach((r) => {
      const key = r.period_label || "Tanpa Kategori";
      const e = map.get(key) || { count: 0, total: 0 };
      e.count += 1; e.total += r.total_amount || 0;
      map.set(key, e);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [filtered]);

  const perStudent = useMemo(() => {
    const map = new Map<string, { student_id: string; name: string; class: string; phone: string | null; count: number; total: number }>();
    filtered.forEach((r) => {
      const e = map.get(r.student_id) || { student_id: r.student_id, name: r.student_name, class: r.class_name, phone: r.parent_phone, count: 0, total: 0 };
      e.count += 1; e.total += r.total_amount || 0;
      map.set(r.student_id, e);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const sendReminder = async (student: { student_id: string; name: string; class: string; phone: string | null; count: number; total: number }) => {
    // WA reminder tunggakan selalu aktif meski WA sekolah dinonaktifkan Super Admin

    if (!student.phone) { toast.error("Nomor WA wali tidak tersedia"); return; }
    setSending(student.student_id);
    const msg = `*${school?.name || "Sekolah"} — Pengingat Pembayaran*\n\nYth. Wali dari *${student.name}* (Kelas ${student.class}),\n\nSaat ini terdapat ${student.count} tagihan yang belum dilunasi dengan total *${fmtIDR(student.total)}*.\n\nMohon segera melakukan pembayaran melalui aplikasi wali murid ATSkolla atau hubungi bendahara sekolah.\n\nTerima kasih.`;
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { school_id: profile!.school_id, phone: student.phone, message: msg, message_type: "spp_reminder" },
    });
    setSending(null);
    if (error) toast.error("Gagal kirim WA");
    else toast.success(`Reminder terkirim ke ${student.name}`);
  };

  const broadcastAll = async () => {
    // WA reminder tunggakan selalu aktif meski WA sekolah dinonaktifkan Super Admin
    const targets = perStudent.filter((s) => s.phone);
    if (targets.length === 0) { toast.error("Tidak ada nomor WA yang bisa dikirimi"); return; }
    setBroadcasting(true);
    let ok = 0, fail = 0;
    for (const s of targets) {
      const msg = `*${school?.name || "Sekolah"} — Pengingat Pembayaran*\n\nYth. Wali dari *${s.name}* (Kelas ${s.class}),\n\nTerdapat ${s.count} tagihan yang belum dilunasi dengan total *${fmtIDR(s.total)}*.\n\nMohon segera melakukan pembayaran.\n\nTerima kasih.`;
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { school_id: profile!.school_id, phone: s.phone, message: msg, message_type: "spp_reminder" },
      });
      if (error) fail++; else ok++;
      await new Promise((r) => setTimeout(r, 800));
    }
    setBroadcasting(false);
    setBroadcastOpen(false);
    toast.success(`Reminder terkirim: ${ok} berhasil, ${fail} gagal`);
  };

  const yearOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(String(r.period_year)));
    if (s.size === 0) s.add(String(new Date().getFullYear()));
    return Array.from(s).sort();
  }, [rows]);

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <PageHeader
        icon={AlertTriangle}
        title="Rekap Tunggakan"
        subtitle="Daftar tagihan lewat jatuh tempo — kirim reminder WhatsApp ke wali murid."
        variant="primary"
        actions={
          <Button
            size="sm"
            onClick={() => setBroadcastOpen(true)}
            disabled={perStudent.length === 0}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/20"
          >
            <Send className="h-4 w-4 mr-1.5" /> Kirim Semua
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Total Tunggakan" value={fmtIDR(totals.total)} icon={AlertTriangle} gradient="from-rose-500 to-rose-600" />
        <StatCard label="Siswa Menunggak" value={totals.students} icon={Users} gradient="from-amber-500 to-amber-600" />
        <StatCard label="Jumlah Tagihan" value={totals.invoices} icon={GraduationCap} gradient="from-indigo-500 to-indigo-600" />
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Kelas</Label>
            <Select value={fClass} onValueChange={setFClass}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Bulan</Label>
            <Select value={fMonth} onValueChange={setFMonth}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bulan</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Tahun</Label>
            <Select value={fYear} onValueChange={setFYear}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tahun</SelectItem>
                {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rekap per kelas & jenis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-bold">Rekap per Kelas</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kelas</TableHead>
                  <TableHead className="text-right">Siswa</TableHead>
                  <TableHead className="text-right">Tagihan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perClass.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Tidak ada tunggakan</TableCell></TableRow>
                ) : perClass.map((c) => (
                  <TableRow key={c.cls}>
                    <TableCell className="text-sm font-semibold">{c.cls}</TableCell>
                    <TableCell className="text-right text-sm">{c.students}</TableCell>
                    <TableCell className="text-right text-sm">{c.count}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-rose-600">{fmtIDR(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-bold">Rekap per Jenis / Periode</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jenis / Periode</TableHead>
                  <TableHead className="text-right">Tagihan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perType.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">Tidak ada tunggakan</TableCell></TableRow>
                ) : perType.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="text-sm">{t.name}</TableCell>
                    <TableCell className="text-right text-sm">{t.count}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-rose-600">{fmtIDR(t.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Daftar siswa menunggak */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-bold">Daftar Siswa Menunggak</h3>
          
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead className="text-right">Tagihan</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>No. WA Wali</TableHead>
                <TableHead className="w-[140px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : perStudent.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Tidak ada siswa menunggak dalam filter ini</TableCell></TableRow>
              ) : perStudent.map((s) => (
                <TableRow key={s.student_id}>
                  <TableCell className="font-semibold text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.class}</TableCell>
                  <TableCell className="text-right text-sm">{s.count}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-rose-600 font-semibold">{fmtIDR(s.total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.phone || <span className="italic">tidak ada</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!s.phone || sending === s.student_id}
                      onClick={() => sendReminder(s)}
                      className="h-8 text-xs"
                    >
                      {sending === s.student_id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <WhatsAppIcon className="h-3.5 w-3.5 mr-1 text-emerald-600" />}
                      Reminder
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim reminder ke semua wali?</AlertDialogTitle>
            <AlertDialogDescription>
              Akan mengirim WA reminder ke {perStudent.filter((s) => s.phone).length} wali murid yang memiliki nomor WA.
              Proses dijalankan bertahap agar tidak dianggap spam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={broadcasting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={broadcastAll} disabled={broadcasting}>
              {broadcasting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Kirim Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
