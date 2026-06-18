import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SchoolData } from "./SchoolCard";

interface SchoolEditDialogProps {
  school: SchoolData | null;
  onClose: () => void;
  onSaved: () => void;
}

const SchoolEditDialog = ({ school, onClose, onSaved }: SchoolEditDialogProps) => {
  const [form, setForm] = useState({ name: "", slug: "", address: "", npsn: "", city: "", province: "", timezone: "Asia/Jakarta" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name || "",
        slug: (school as any).slug || "",
        address: school.address || "",
        npsn: school.npsn || "",
        city: school.city || "",
        province: school.province || "",
        timezone: school.timezone || "Asia/Jakarta",
      });
    }
  }, [school]);

  const handleSave = async () => {
    if (!school) return;
    const slugClean = form.slug.trim().toLowerCase();
    if (slugClean && !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slugClean)) {
      toast.error("Subdomain hanya boleh huruf kecil, angka, dan tanda hubung (3-64 karakter)");
      return;
    }
    setSaving(true);
    const update: any = {
      name: form.name,
      address: form.address || null,
      npsn: form.npsn || null,
      city: form.city || null,
      province: form.province || null,
      timezone: form.timezone,
    };
    if (slugClean && slugClean !== ((school as any).slug || "")) update.slug = slugClean;
    const { error } = await supabase.from("schools").update(update).eq("id", school.id);

    setSaving(false);
    if (error) {
      toast.error("Gagal update: " + error.message);
      return;
    }
    toast.success("Data sekolah berhasil diupdate");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!school} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Data Sekolah</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nama Sekolah</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>NPSN</Label>
            <Input value={form.npsn} onChange={(e) => setForm({ ...form, npsn: e.target.value })} placeholder="Opsional" />
          </div>
          <div>
            <Label>Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder="smk-cendikia"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">.atskolla.com</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Mengubah subdomain akan memutus tautan lama. Hanya huruf kecil, angka, dan tanda hubung.
            </p>
          </div>
          <div>
            <Label>Alamat</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kota</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Provinsi</Label>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Zona Waktu</Label>
            <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Jakarta">WIB (Asia/Jakarta)</SelectItem>
                <SelectItem value="Asia/Makassar">WITA (Asia/Makassar)</SelectItem>
                <SelectItem value="Asia/Jayapura">WIT (Asia/Jayapura)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchoolEditDialog;
