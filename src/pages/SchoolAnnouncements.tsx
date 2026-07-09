import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichContent } from "@/components/RichContent";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Megaphone, Plus, Pin, AlertTriangle, Info, Sparkles, Loader2, Pencil, Trash2, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Navigate } from "react-router-dom";

const TYPE_OPTIONS = [
  { value: "info", label: "Informasi", icon: Info, color: "text-sky-600", bg: "bg-sky-500/10", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  { value: "penting", label: "Penting", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-500/10", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  { value: "urgent", label: "Mendesak", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10", badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
];

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  is_pinned: boolean;
  created_at: string;
  created_by: string | null;
  target_audience?: string;
}

const AUDIENCE_OPTIONS = [
  { value: "staff", label: "Staf & Guru" },
  { value: "parents", label: "Wali Murid" },
  { value: "all", label: "Semua (Staf + Wali Murid)" },
];

const SchoolAnnouncements = () => {
  const { user, profile, roles, loading: authLoading } = useAuth();
  const isAdmin = roles.includes("school_admin");
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [isPinned, setIsPinned] = useState(false);
  const [audience, setAudience] = useState("staff");

  const schoolId = profile?.school_id;

  const fetchData = async () => {
    if (!schoolId) { setLoading(false); return; }
    const { data } = await supabase
      .from("school_announcements")
      .select("*")
      .eq("school_id", schoolId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [schoolId]);

  if (!authLoading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const openNew = () => {
    setEditing(null);
    setTitle(""); setMessage(""); setType("info"); setIsPinned(false); setAudience("staff");
    setDialog(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title); setMessage(a.message); setType(a.type); setIsPinned(a.is_pinned);
    setAudience(a.target_audience || "staff");
    setDialog(true);
  };

  const handleSave = async () => {
    const plainText = message.replace(/<[^>]*>/g, "").trim();
    if (!title.trim() || (!plainText && !/<img|<iframe/i.test(message))) {
      toast.error("Mohon isi judul dan pesan");
      return;
    }
    if (!schoolId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("school_announcements")
          .update({ title: title.trim(), message: message.trim(), type, is_pinned: isPinned, target_audience: audience })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Pengumuman diperbarui");
      } else {
        const { error } = await supabase.from("school_announcements").insert({
          school_id: schoolId,
          title: title.trim(),
          message: message.trim(),
          type,
          is_pinned: isPinned,
          target_audience: audience,
          created_by: user?.id,
        });
        if (error) throw error;
        toast.success("Pengumuman dipublikasikan");
      }
      setDialog(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("school_announcements").delete().eq("id", deleteId);
    if (error) { toast.error("Gagal menghapus"); return; }
    toast.success("Pengumuman dihapus");
    setDeleteId(null);
    fetchData();
  };

  const togglePin = async (a: Announcement) => {
    const { error } = await supabase.from("school_announcements")
      .update({ is_pinned: !a.is_pinned }).eq("id", a.id);
    if (error) { toast.error("Gagal memperbarui"); return; }
    toast.success(a.is_pinned ? "Pin dilepas" : "Disematkan");
    fetchData();
  };

  const totalByType = TYPE_OPTIONS.map(t => ({ ...t, count: items.filter(i => i.type === t.value).length }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Pengumuman Sekolah"
        subtitle="Kelola informasi & pengumuman untuk seluruh staf, guru, dan wali kelas"
        actions={
          <Button onClick={openNew} className="bg-white text-primary hover:bg-white/90 shadow-md rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Buat Baru
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-sm">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total</p>
                <p className="text-xl font-bold">{items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {totalByType.map(t => {
          const Icon = t.icon;
          return (
            <Card key={t.value} className="rounded-2xl border border-border/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", t.bg)}>
                    <Icon className={cn("h-5 w-5", t.color)} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t.label}</p>
                    <p className="text-xl font-bold">{t.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border shadow-none">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-bold mb-1">Belum ada pengumuman</h3>
            <p className="text-sm text-muted-foreground mb-4">Mulai informasikan hal penting kepada guru dan staf sekolah Anda</p>
            <Button onClick={openNew} className="bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] text-white rounded-xl">
              <Plus className="h-4 w-4 mr-1.5" /> Buat Pengumuman Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((a, i) => {
            const cfg = TYPE_OPTIONS.find(t => t.value === a.type) || TYPE_OPTIONS[0];
            const Icon = cfg.icon;
            const accentSolid = cfg.bg.replace("/10", "");
            const audienceLabel = AUDIENCE_OPTIONS.find(o => o.value === (a.target_audience || "staff"))?.label || "Staf & Guru";
            const dateObj = new Date(a.created_at);
            const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
            const timeStr = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={cn(
                  "group relative rounded-3xl border border-border/60 bg-card shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden h-full",
                  a.is_pinned && "ring-2 ring-amber-400/50 shadow-amber-500/10"
                )}>
                  {/* Decorative accent */}
                  <div className={cn("absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity", accentSolid)} />
                  <div className={cn("absolute top-0 left-0 right-0 h-1", accentSolid)} />

                  <CardContent className="relative p-5 sm:p-6 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-inset ring-border/50", cfg.bg)}>
                          <Icon className={cn("h-5 w-5", cfg.color)} />
                        </div>
                        <div className="min-w-0">
                          <Badge variant="outline" className={cn("text-[10px] h-5 px-2 font-medium tracking-wide uppercase", cfg.badge)}>{cfg.label}</Badge>
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                            <span>{dateStr}</span>
                            <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/50" />
                            <span>{timeStr}</span>
                          </div>
                        </div>
                      </div>
                      {a.is_pinned && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
                          <Pin className="h-3 w-3 fill-current" /> Pinned
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] sm:text-base font-bold text-foreground leading-snug mb-1.5 line-clamp-2">{a.title}</h3>
                      <RichContent html={a.message} className="line-clamp-3 [&_img]:hidden [&_*]:!text-[13px] [&_*]:!leading-relaxed [&_*]:!text-muted-foreground" />
                    </div>

                    {/* Footer */}
                    <div className="mt-5 pt-4 border-t border-dashed border-border/70 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] h-6 px-2 gap-1 bg-[#5B6CF9]/10 text-[#5B6CF9] border-[#5B6CF9]/25 font-medium">
                        <Send className="h-3 w-3" /> {audienceLabel}
                      </Badge>
                      <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => togglePin(a)} title={a.is_pinned ? "Lepas pin" : "Sematkan"}>
                          <Pin className={cn("h-3.5 w-3.5", a.is_pinned ? "text-amber-600 fill-amber-500" : "text-muted-foreground")} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              {editing ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
            </DialogTitle>
            <DialogDescription>Pengumuman akan otomatis terlihat di dashboard semua guru dan staf.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tipe Pengumuman</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", t.color)} /> {t.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tujuan Penerima</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Pilih siapa yang akan melihat pengumuman ini di dashboard mereka.</p>
            </div>
            <div>
              <Label className="text-xs">Judul</Label>
              <Input className="mt-1.5" placeholder="Contoh: Rapat Guru Senin Pagi" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{title.length}/120</p>
            </div>
            <div>
              <Label className="text-xs">Isi Pesan</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Anda bisa menyisipkan gambar, link, format teks, simbol, daftar, dan lainnya.</p>
              <RichTextEditor value={message} onChange={setMessage} placeholder="Tulis isi pengumuman... gunakan toolbar untuk format teks, gambar, link, dll." />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">Sematkan ke Atas</p>
                  <p className="text-[10px] text-muted-foreground">Pengumuman ini akan selalu muncul paling atas</p>
                </div>
              </div>
              <Switch checked={isPinned} onCheckedChange={setIsPinned} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving} className="rounded-xl">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] text-white rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              {editing ? "Simpan Perubahan" : "Publikasikan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Pengumuman akan hilang dari semua dashboard guru.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchoolAnnouncements;
