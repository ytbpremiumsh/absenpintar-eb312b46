import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Tag, Loader2 } from "lucide-react";

const CATEGORIES = ["SPP", "Daftar Ulang", "Seragam", "Buku", "Ekskul", "Kegiatan", "Ujian", "Lainnya"];
const PERIODS = [
  { v: "monthly", label: "Bulanan" },
  { v: "semester", label: "Semester" },
  { v: "yearly", label: "Tahunan" },
  { v: "once", label: "Sekali Bayar" },
];
const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

type PT = {
  id: string;
  school_id: string;
  name: string;
  category: string;
  amount: number;
  applies_to: string;
  period: string;
  is_active: boolean;
  description: string | null;
};

const emptyForm: Partial<PT> = {
  name: "",
  category: "SPP",
  amount: 0,
  applies_to: "all",
  period: "monthly",
  is_active: true,
  description: "",
};

export default function BendaharaJenisPembayaran() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<PT[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PT>>(emptyForm);
  const [editing, setEditing] = useState<PT | null>(null);
  const [deleting, setDeleting] = useState<PT | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) return;
    setLoading(true);
    const [r, c] = await Promise.all([
      supabase.from("payment_types").select("*").eq("school_id", profile.school_id).order("created_at", { ascending: false }),
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
    ]);
    setRows((r.data as any[]) || []);
    setClasses(((c.data as any[]) || []).map((x) => x.name));
    setLoading(false);
  }, [profile?.school_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fCat !== "all" && r.category !== fCat) return false;
      if (fStatus === "active" && !r.is_active) return false;
      if (fStatus === "inactive" && r.is_active) return false;
      if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, q, fCat, fStatus]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: PT) => { setEditing(r); setForm(r); setOpen(true); };

  const save = async () => {
    if (!profile?.school_id) return;
    if (!form.name?.trim()) { toast.error("Nama pembayaran wajib diisi"); return; }
    setSaving(true);
    const payload: any = {
      school_id: profile.school_id,
      name: form.name!.trim(),
      category: form.category || "Lainnya",
      amount: Number(form.amount) || 0,
      applies_to: form.applies_to || "all",
      period: form.period || "once",
      is_active: form.is_active !== false,
      description: form.description?.toString().trim() || null,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from("payment_types").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("payment_types").insert(payload));
    }
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success(editing ? "Jenis pembayaran diperbarui" : "Jenis pembayaran ditambahkan");
    setOpen(false);
    fetchData();
  };

  const toggleActive = async (r: PT) => {
    const { error } = await supabase.from("payment_types").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(`Status diubah`); fetchData(); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("payment_types").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else { toast.success("Dihapus"); setDeleting(null); fetchData(); }
  };

  const appliesLabel = (v: string) => {
    if (v === "all") return "Semua Siswa";
    if (v.startsWith("class:")) return `Kelas ${v.slice(6)}`;
    if (v.startsWith("grade:")) return `Tingkat ${v.slice(6)}`;
    return v;
  };
  const periodLabel = (v: string) => PERIODS.find((p) => p.v === v)?.label || v;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <PageHeader
        icon={Tag}
        title="Jenis Pembayaran"
        subtitle="Kelola master pembayaran sekolah (SPP, daftar ulang, seragam, dsb.)"
        variant="primary"
        actions={
          <Button onClick={openAdd} className="bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Tambah
          </Button>
        }
      />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama pembayaran..." className="pl-8" />
          </div>
          <Select value={fCat} onValueChange={setFCat}>
            <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Berlaku Untuk</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">Belum ada jenis pembayaran</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-semibold text-sm">{r.name}</div>
                    {r.description && <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{r.category}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtIDR(r.amount)}</TableCell>
                  <TableCell className="text-xs">{appliesLabel(r.applies_to)}</TableCell>
                  <TableCell className="text-xs">{periodLabel(r.period)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      <span className="text-[11px] text-muted-foreground">{r.is_active ? "Aktif" : "Nonaktif"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Jenis Pembayaran" : "Tambah Jenis Pembayaran"}</DialogTitle>
            <DialogDescription>Master data pembayaran yang berlaku di sekolah Anda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nama Pembayaran</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SPP Bulanan / Daftar Ulang / ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nominal (Rp)</Label>
                <Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value || "0") })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Berlaku Untuk</Label>
                <Select value={form.applies_to} onValueChange={(v) => setForm({ ...form, applies_to: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Siswa</SelectItem>
                    {classes.map((c) => <SelectItem key={`c-${c}`} value={`class:${c}`}>Kelas {c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Periode</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Keterangan (opsional)</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Catatan tambahan..." />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Status Aktif</p>
                <p className="text-[11px] text-muted-foreground">Jenis pembayaran non-aktif tidak akan muncul di form tagihan.</p>
              </div>
              <Switch checked={form.is_active !== false} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus jenis pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" akan dihapus dari master. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
