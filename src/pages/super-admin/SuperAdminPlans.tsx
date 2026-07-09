import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, Check } from "lucide-react";
import { PlanCardsGrid } from "@/components/PlanCardsGrid";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string | null;
  features: string[];
  max_students: number | null;
  is_active: boolean;
  sort_order: number;
  show_on_landing: boolean;
}

const emptyPlan = { name: "", price: 0, description: "", features: "", max_students: "", is_active: true, show_on_landing: true };

const SuperAdminPlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyPlan);

  const fetchPlans = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    if (data) setPlans(data.map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [], show_on_landing: p.show_on_landing !== false })));
    setLoading(false);
  };

  const handleToggleLanding = async (planId: string, val: boolean) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, show_on_landing: val } : p));
    const { error } = await supabase.from("subscription_plans").update({ show_on_landing: val } as any).eq("id", planId);
    if (error) {
      toast.error("Gagal mengubah visibilitas");
      fetchPlans();
    } else {
      toast.success(val ? "Paket ditampilkan di Landing Page" : "Paket disembunyikan dari Landing Page");
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyPlan); setDialogOpen(true); };
  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name, price: plan.price, description: plan.description || "",
      features: plan.features.join("\n"), max_students: plan.max_students?.toString() || "", is_active: plan.is_active, show_on_landing: plan.show_on_landing,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const featuresArr = form.features.split("\n").map((f: string) => f.trim()).filter(Boolean);
    const payload = {
      name: form.name, price: Number(form.price), description: form.description || null,
      features: featuresArr, max_students: form.max_students ? Number(form.max_students) : null,
      is_active: form.is_active, sort_order: editing?.sort_order || plans.length + 1,
    };

    if (editing) {
      const { error } = await supabase.from("subscription_plans").update(payload).eq("id", editing.id);
      if (error) { toast.error("Gagal update: " + error.message); return; }
      toast.success("Paket berhasil diupdate");
    } else {
      const { error } = await supabase.from("subscription_plans").insert(payload);
      if (error) { toast.error("Gagal membuat: " + error.message); return; }
      toast.success("Paket berhasil dibuat");
    }
    setDialogOpen(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus paket langganan ini?")) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) { toast.error("Gagal hapus: " + error.message); return; }
    toast.success("Paket dihapus");
    fetchPlans();
  };

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manajemen Paket Langganan</h1>
          <p className="text-muted-foreground text-sm">Kelola paket, harga, dan fitur</p>
        </div>
        <Button onClick={openCreate} className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Tambah Paket</Button>
      </div>

      {/* Trial settings removed — trial system deprecated. */}

      {/* Preview: matches dashboard sekolah & landing page */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preview Tampilan Paket</CardTitle>
          <p className="text-xs text-muted-foreground">Tampilan yang sama dengan Dashboard Sekolah & Landing Page</p>
        </CardHeader>
        <CardContent>
          <PlanCardsGrid plans={plans.filter(p => p.is_active) as any} hideCta />
        </CardContent>
      </Card>

      {/* Management list (edit / delete / show on landing) */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={`border-0 shadow-card relative ${!plan.is_active ? "opacity-60" : ""}`}>
            {!plan.is_active && <Badge className="absolute top-3 right-3 bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Nonaktif</Badge>}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                {plan.name}
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(plan)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(plan.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardTitle>
              <p className="text-2xl font-bold text-primary">{formatRupiah(plan.price)}<span className="text-sm text-muted-foreground font-normal"> / bulan</span></p>
              {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {plan.max_students && <p className="text-xs text-muted-foreground">Maks {plan.max_students} siswa</p>}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground">Tampil di Landing Page</span>
                <Switch checked={plan.show_on_landing} onCheckedChange={(val) => handleToggleLanding(plan.id, val)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Paket" : "Tambah Paket Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Paket</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Basic" /></div>
            <div><Label>Harga (Rupiah)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
            <div><Label>Deskripsi</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Fitur (1 per baris)</Label><Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={5} placeholder="Monitoring realtime&#10;Scan QR Code" /></div>
            <div><Label>Maks Siswa (kosong = unlimited)</Label><Input type="number" value={form.max_students} onChange={(e) => setForm({ ...form, max_students: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Aktif</Label></div>
          </div>
          <DialogFooter><Button onClick={handleSave} className="gradient-primary text-primary-foreground">{editing ? "Simpan" : "Buat Paket"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPlans;
