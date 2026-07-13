import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { School, Save, Upload, Lock, Loader2, Image, Clock, Plus, Trash2, FileText, GripVertical, Globe, CalendarOff, CalendarDays, PowerOff, Link2, Copy, ExternalLink } from "lucide-react";
import { buildTenantUrl, getRootDomain } from "@/lib/tenant";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { toast } from "sonner";

const SchoolSettings = () => {
  const { profile } = useAuth();
  const features = useSubscriptionFeatures();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [npsn, setNpsn] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [holidayDays, setHolidayDays] = useState<number[]>([0, 6]);
  const [logo, setLogo] = useState("");
  const [slug, setSlug] = useState("");
  const [initialSlug, setInitialSlug] = useState("");
  const [slugUpdatedAt, setSlugUpdatedAt] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("14:00");
  const [attStartTime, setAttStartTime] = useState("06:00");
  const [attEndTime, setAttEndTime] = useState("12:00");
  const [depStartTime, setDepStartTime] = useState("12:00");
  const [depEndTime, setDepEndTime] = useState("17:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayModeLabel, setHolidayModeLabel] = useState("");
  const [holidayDates, setHolidayDates] = useState<{ id: string; date: string; label: string | null }[]>([]);
  const [savingHolidayMode, setSavingHolidayMode] = useState(false);
  const [newHolidayLabel, setNewHolidayLabel] = useState("");



  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    Promise.all([
      supabase.from("schools").select("name, address, logo, npsn, city, province, timezone, holiday_days, holiday_mode, holiday_mode_label, slug, slug_updated_at, whatsapp, email, principal_name").eq("id", profile.school_id).single(),
      supabase.from("dismissal_settings").select("school_start_time, school_end_time, attendance_start_time, attendance_end_time, departure_start_time, departure_end_time").eq("school_id", profile.school_id).maybeSingle(),
      supabase.from("qr_instructions").select("id, instruction_text, sort_order").eq("school_id", profile.school_id).order("sort_order"),
      supabase.from("school_holidays").select("id, date, label").eq("school_id", profile.school_id).order("date"),
    ]).then(([schoolRes, settingsRes, instrRes, holRes]) => {
      if (schoolRes.data) {
        setName(schoolRes.data.name || "");
        setAddress(schoolRes.data.address || "");
        setLogo(schoolRes.data.logo || "");
        setNpsn((schoolRes.data as any).npsn || "");
        setCity((schoolRes.data as any).city || "");
        setProvince((schoolRes.data as any).province || "");
        setTimezone((schoolRes.data as any).timezone || "Asia/Jakarta");
        const hd = (schoolRes.data as any).holiday_days;
        setHolidayDays(Array.isArray(hd) ? hd : [0, 6]);
        setHolidayMode(!!(schoolRes.data as any).holiday_mode);
        setHolidayModeLabel((schoolRes.data as any).holiday_mode_label || "");
        setSlug((schoolRes.data as any).slug || "");
        setInitialSlug((schoolRes.data as any).slug || "");
        setSlugUpdatedAt((schoolRes.data as any).slug_updated_at || null);
        setWhatsapp((schoolRes.data as any).whatsapp || "");
        setEmail((schoolRes.data as any).email || "");
        setPrincipalName((schoolRes.data as any).principal_name || "");
      }
      if (holRes.data) setHolidayDates(holRes.data as any);
      if (settingsRes.data) {
        setStartTime(settingsRes.data.school_start_time?.slice(0, 5) || "07:00");
        setEndTime(settingsRes.data.school_end_time?.slice(0, 5) || "14:00");
        setAttStartTime((settingsRes.data as any).attendance_start_time?.slice(0, 5) || "06:00");
        setAttEndTime((settingsRes.data as any).attendance_end_time?.slice(0, 5) || "12:00");
        setDepStartTime((settingsRes.data as any).departure_start_time?.slice(0, 5) || "12:00");
        setDepEndTime((settingsRes.data as any).departure_end_time?.slice(0, 5) || "17:00");
      }
      if (instrRes.data && instrRes.data.length > 0) {
        setQrInstructions(instrRes.data.map((r: any) => ({ id: r.id, text: r.instruction_text })));
      }
      setLoading(false);
    });
  }, [profile?.school_id]);

  const handleLogoUpload = async (file: File) => {
    if (!features.canCustomLogo) {
      toast.error("Fitur custom logo tersedia di paket School ke atas");
      return;
    }
    if (!profile?.school_id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${profile.school_id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("school-logos").upload(path, file, { upsert: true });
      if (uploadErr) { toast.error("Gagal upload logo: " + uploadErr.message); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from("school-logos").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      
      // Save logo URL to database immediately
      const { error: saveErr } = await supabase.from("schools").update({ logo: publicUrl }).eq("id", profile.school_id);
      if (saveErr) { toast.error("Logo terupload tapi gagal menyimpan ke database: " + saveErr.message); setUploading(false); return; }
      
      setLogo(publicUrl);
      toast.success("Logo berhasil diupload dan disimpan!");
    } catch (err: any) {
      toast.error("Terjadi kesalahan: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddInstruction = () => {
    if (qrInstructions.length >= maxInstructions) {
      toast.error(`Paket ${features.planName} hanya bisa ${maxInstructions} petunjuk. Upgrade untuk menambah lebih banyak.`);
      return;
    }
    setQrInstructions([...qrInstructions, { text: "" }]);
  };

  const handleRemoveInstruction = (index: number) => {
    setQrInstructions(qrInstructions.filter((_, i) => i !== index));
  };

  const handleUpdateInstruction = (index: number, text: string) => {
    const updated = [...qrInstructions];
    updated[index] = { ...updated[index], text };
    setQrInstructions(updated);
  };

  const handleSaveInstructions = async () => {
    if (!profile?.school_id) return;
    setSavingInstructions(true);

    // Delete existing
    await supabase.from("qr_instructions").delete().eq("school_id", profile.school_id);

    // Insert new
    const validInstructions = qrInstructions.filter(i => i.text.trim());
    if (validInstructions.length > 0) {
      const rows = validInstructions.map((instr, i) => ({
        school_id: profile.school_id!,
        instruction_text: instr.text.trim(),
        sort_order: i,
      }));
      const { error } = await supabase.from("qr_instructions").insert(rows);
      if (error) { toast.error("Gagal menyimpan: " + error.message); setSavingInstructions(false); return; }
    }

    setSavingInstructions(false);
    toast.success("Petunjuk QR Code berhasil disimpan!");
  };

  const handleToggleHolidayMode = async (val: boolean) => {
    if (!profile?.school_id) return;
    setSavingHolidayMode(true);
    const { error } = await supabase.from("schools").update({
      holiday_mode: val,
      holiday_mode_label: val ? (holidayModeLabel || "Hari Libur") : null,
    } as any).eq("id", profile.school_id);
    setSavingHolidayMode(false);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayMode(val);
    toast.success(val ? "Mode libur diaktifkan — absensi ditangguhkan" : "Mode libur dinonaktifkan");
  };

  const handleAddHolidayDate = async (date: Date | undefined) => {
    if (!date || !profile?.school_id) return;
    const iso = date.toISOString().slice(0, 10);
    // Toggle: if exists, delete
    const existing = holidayDates.find((h) => h.date === iso);
    if (existing) {
      const { error } = await supabase.from("school_holidays").delete().eq("id", existing.id);
      if (error) { toast.error("Gagal menghapus: " + error.message); return; }
      setHolidayDates(holidayDates.filter((h) => h.id !== existing.id));
      toast.success("Tanggal libur dihapus");
      return;
    }
    const { data, error } = await supabase.from("school_holidays").insert({
      school_id: profile.school_id,
      date: iso,
      label: newHolidayLabel || null,
    } as any).select().single();
    if (error) { toast.error("Gagal menambah: " + error.message); return; }
    setHolidayDates([...holidayDates, data as any].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHolidayLabel("");
    toast.success("Tanggal libur ditambahkan");
  };

  const handleRemoveHolidayDate = async (id: string) => {
    const { error } = await supabase.from("school_holidays").delete().eq("id", id);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayDates(holidayDates.filter((h) => h.id !== id));
    toast.success("Dihapus");
  };

  const COOLDOWN_DAYS = 14;
  const slugCooldownMs = slugUpdatedAt ? (new Date(slugUpdatedAt).getTime() + COOLDOWN_DAYS * 86400000) - Date.now() : 0;
  const slugDaysRemaining = Math.max(0, Math.ceil(slugCooldownMs / 86400000));
  const canEditSlug = slugDaysRemaining === 0;

  const handleSave = async () => {
    if (!profile?.school_id) return;
    setSaving(true);

    // Handle subdomain change with 14-day cooldown + uniqueness check
    const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const slugChanged = normalizedSlug !== initialSlug;
    let slugUpdatePayload: any = {};
    if (slugChanged) {
      if (!canEditSlug) {
        setSaving(false);
        toast.error(`Subdomain baru bisa diubah lagi dalam ${slugDaysRemaining} hari.`);
        return;
      }
      if (normalizedSlug.length < 3) {
        setSaving(false);
        toast.error("Subdomain minimal 3 karakter — hanya huruf & angka (tanpa tanda hubung).");
        return;
      }
      const { data: taken } = await supabase.from("schools").select("id").eq("slug", normalizedSlug).neq("id", profile.school_id).maybeSingle();
      if (taken) {
        setSaving(false);
        toast.error("Subdomain sudah dipakai sekolah lain. Coba yang lain.");
        return;
      }
      slugUpdatePayload = { slug: normalizedSlug, slug_updated_at: new Date().toISOString() };
    }

    const { error: schoolErr } = await supabase.from("schools").update({
      name, address, logo: logo || null,
      npsn: npsn || null, city: city || null, province: province || null, timezone,
      holiday_days: holidayDays,
      whatsapp: whatsapp || null, email: email || null, principal_name: principalName || null,
      ...slugUpdatePayload,
    } as any).eq("id", profile.school_id);

    if (!schoolErr && slugChanged) {
      setInitialSlug(normalizedSlug);
      setSlug(normalizedSlug);
      setSlugUpdatedAt(slugUpdatePayload.slug_updated_at);
    }


    const settingsPayload = {
      school_start_time: startTime + ":00",
      school_end_time: endTime + ":00",
      attendance_start_time: attStartTime + ":00",
      attendance_end_time: attEndTime + ":00",
      departure_start_time: depStartTime + ":00",
      departure_end_time: depEndTime + ":00",
    };

    const { data: existing } = await supabase.from("dismissal_settings").select("id").eq("school_id", profile.school_id).maybeSingle();
    if (existing) {
      await supabase.from("dismissal_settings").update(settingsPayload as any).eq("school_id", profile.school_id);
    } else {
      await supabase.from("dismissal_settings").insert({
        school_id: profile.school_id,
        is_active: false,
        ...settingsPayload,
      } as any);
    }

    setSaving(false);
    if (schoolErr) { toast.error("Gagal menyimpan: " + schoolErr.message); } else { toast.success("Pengaturan sekolah berhasil diperbarui!"); }
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Memuat...</div>;

  if (!profile?.school_id) return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <School className="h-12 w-12 text-muted-foreground/30" />
      <h3 className="text-lg font-semibold text-foreground">Sekolah Belum Terhubung</h3>
      <p className="text-sm text-muted-foreground max-w-md">Akun Anda belum terhubung ke sekolah. Hubungi administrator untuk menghubungkan akun Anda ke data sekolah.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader icon={School} title="Identitas Sekolah" subtitle="Kelola informasi dan pengaturan sekolah Anda" />

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle className="text-base">Informasi Sekolah</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">Nama Sekolah</Label>
              <Input id="school-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama sekolah" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-npsn">NPSN</Label>
              <Input id="school-npsn" value={npsn} onChange={(e) => setNpsn(e.target.value)} placeholder="Nomor Pokok Sekolah Nasional" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="school-address">Alamat Lengkap</Label>
            <Textarea id="school-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Contoh No. 123, Kelurahan, Kecamatan" rows={3} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school-city">Kota / Kabupaten</Label>
              <Input id="school-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Contoh: Jakarta Selatan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-province">Provinsi</Label>
              <Input id="school-province" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Contoh: DKI Jakarta" />
            </div>
          </div>

          {/* Kepala Sekolah, Email, WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="school-principal">Nama Kepala Sekolah</Label>
            <Input id="school-principal" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} placeholder="Contoh: Drs. Ahmad Susanto, M.Pd." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school-email">Email Sekolah</Label>
              <Input id="school-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@sekolah.sch.id" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-whatsapp">Nomor WhatsApp</Label>
              <Input id="school-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="628123456789" />
            </div>
          </div>

          {/* Subdomain */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Label>Subdomain Sekolah</Label>
              {!canEditSlug && (
                <Badge variant="secondary" className="text-[10px]">
                  <Lock className="h-3 w-3 mr-1" /> Bisa diubah dalam {slugDaysRemaining} hari
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex-1 flex items-center rounded-lg border border-border overflow-hidden ${canEditSlug ? "bg-background" : "bg-muted/40"}`}>
                <span className="pl-3 pr-2 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  https://
                </span>
                <input
                  readOnly={!canEditSlug}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  placeholder="namasekolah"
                  className="flex-1 bg-transparent py-2 text-sm font-medium text-foreground outline-none"
                />
                <span className="pl-1 pr-3 py-2 text-sm text-muted-foreground">
                  .{getRootDomain()}
                </span>
              </div>
              {initialSlug && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => { navigator.clipboard.writeText(buildTenantUrl(initialSlug, "/admin")); toast.success("URL disalin"); }}
                    title="Salin URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(buildTenantUrl(initialSlug, "/admin"), "_blank")}
                    title="Buka"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {canEditSlug
                ? "Gunakan huruf kecil dan angka saja (tanpa tanda hubung / simbol). Setelah diubah, baru bisa diubah lagi setelah 14 hari."
                : `Subdomain baru dapat diubah lagi dalam ${slugDaysRemaining} hari.`}
            </p>
            {initialSlug && (
              <div className="mt-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-2">
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-foreground mb-0.5">
                    <Link2 className="h-3 w-3" /> URL Login Admin & Guru
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="font-mono break-all text-foreground flex-1">{buildTenantUrl(initialSlug, "/admin")}</code>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => { navigator.clipboard.writeText(buildTenantUrl(initialSlug, "/admin")); toast.success("URL admin disalin"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-foreground mb-0.5">
                    <Link2 className="h-3 w-3" /> URL Login Wali Murid
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="font-mono break-all text-foreground flex-1">{buildTenantUrl(initialSlug, "/login")}</code>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => { navigator.clipboard.writeText(buildTenantUrl(initialSlug, "/login")); toast.success("URL wali murid disalin"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40">
                  Bagikan URL sesuai peran — admin & guru pakai <b>/admin</b>, orang tua pakai <b>/login</b>.
                </div>
              </div>
            )}
          </div>



          {/* Logo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Logo Sekolah</Label>
              {!features.canCustomLogo && (
                <Badge variant="secondary" className="text-[10px]"><Lock className="h-3 w-3 mr-1" /> Paket School+</Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              {logo ? (
                <img src={logo} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-border" />
              ) : (
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                  <Image className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
              {features.canCustomLogo ? (
                <div className="relative">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
                  <Button variant="outline" size="sm" disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    {uploading ? "Mengupload..." : "Upload Logo"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="opacity-60 cursor-not-allowed"
                  onClick={() => toast.error("Fitur Upload Logo tersedia di paket School ke atas. Silakan upgrade langganan.")}>
                  <Upload className="h-4 w-4 mr-1" /> Upload Logo
                  <Lock className="h-3 w-3 ml-1 text-warning" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Zona Waktu */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Zona Waktu Sekolah
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Pilih zona waktu sekolah agar waktu absensi datang dan pulang sesuai dengan wilayah sekolah Anda.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zona Waktu</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih zona waktu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Jakarta">WIB — Waktu Indonesia Barat (UTC+7)</SelectItem>
                  <SelectItem value="Asia/Makassar">WITA — Waktu Indonesia Tengah (UTC+8)</SelectItem>
                  <SelectItem value="Asia/Jayapura">WIT — Waktu Indonesia Timur (UTC+9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground w-full">
                <p className="font-semibold text-foreground mb-1">
                  {timezone === "Asia/Jakarta" ? "WIB (UTC+7)" : timezone === "Asia/Makassar" ? "WITA (UTC+8)" : "WIT (UTC+9)"}
                </p>
                <p>Waktu saat ini: {(() => {
                  const tzMap: Record<string, string> = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura" };
                  const validTz = tzMap[timezone] || timezone || "Asia/Jakarta";
                  try {
                    return new Date().toLocaleTimeString("id-ID", { timeZone: validTz, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  } catch {
                    return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  }
                })()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      <Button onClick={handleSave} disabled={saving} className="gradient-primary hover:opacity-90 w-full sm:w-auto">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Menyimpan..." : "Simpan Pengaturan Sekolah"}
      </Button>
    </div>
  );
};

export default SchoolSettings;
