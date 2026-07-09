import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CalendarOff, PowerOff, Info, Clock, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const HolidayManagement = () => {
  const { profile, roles } = useAuth();
  const canEdit = roles.includes("school_admin") || roles.includes("super_admin");

  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayModeLabel, setHolidayModeLabel] = useState("");
  const [holidayDays, setHolidayDays] = useState<number[]>([0, 6]);
  const [saving, setSaving] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attendance time state
  const [attStartTime, setAttStartTime] = useState("06:00");
  const [attEndTime, setAttEndTime] = useState("12:00");
  const [depStartTime, setDepStartTime] = useState("12:00");
  const [depEndTime, setDepEndTime] = useState("17:00");
  const [savingTime, setSavingTime] = useState(false);

  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    Promise.all([
      supabase.from("schools").select("holiday_mode, holiday_mode_label, holiday_days").eq("id", profile.school_id).single(),
      supabase.from("dismissal_settings")
        .select("attendance_start_time, attendance_end_time, departure_start_time, departure_end_time")
        .eq("school_id", profile.school_id).maybeSingle(),
    ]).then(([sRes, dRes]) => {
      if (sRes.data) {
        setHolidayMode(!!(sRes.data as any).holiday_mode);
        setHolidayModeLabel((sRes.data as any).holiday_mode_label || "");
        const hd = (sRes.data as any).holiday_days;
        setHolidayDays(Array.isArray(hd) ? hd : [0, 6]);
      }
      if (dRes.data) {
        setAttStartTime((dRes.data as any).attendance_start_time?.slice(0, 5) || "06:00");
        setAttEndTime((dRes.data as any).attendance_end_time?.slice(0, 5) || "12:00");
        setDepStartTime((dRes.data as any).departure_start_time?.slice(0, 5) || "12:00");
        setDepEndTime((dRes.data as any).departure_end_time?.slice(0, 5) || "17:00");
      }
      setLoading(false);
    });
  }, [profile?.school_id]);

  const toggleHolidayDay = async (day: number) => {
    if (!profile?.school_id || !canEdit) return;
    const next = holidayDays.includes(day) ? holidayDays.filter((x) => x !== day) : [...holidayDays, day];
    setHolidayDays(next);
    setSavingDays(true);
    const { error } = await supabase.from("schools").update({ holiday_days: next } as any).eq("id", profile.school_id);
    setSavingDays(false);
    if (error) { toast.error("Gagal: " + error.message); return; }
    toast.success("Hari libur mingguan diperbarui");
  };

  const handleToggle = async (val: boolean) => {
    if (!profile?.school_id || !canEdit) return;
    setSaving(true);
    const { error } = await supabase.from("schools").update({
      holiday_mode: val,
      holiday_mode_label: val ? (holidayModeLabel || "Hari Libur") : null,
    } as any).eq("id", profile.school_id);
    setSaving(false);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayMode(val);
    toast.success(val ? "Mode libur diaktifkan — absensi ditangguhkan" : "Mode libur dinonaktifkan");
  };

  const handleSaveTime = async () => {
    if (!profile?.school_id || !canEdit) return;
    setSavingTime(true);
    const payload = {
      attendance_start_time: attStartTime + ":00",
      attendance_end_time: attEndTime + ":00",
      departure_start_time: depStartTime + ":00",
      departure_end_time: depEndTime + ":00",
    };
    const { data: existing } = await supabase.from("dismissal_settings").select("id").eq("school_id", profile.school_id).maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from("dismissal_settings").update(payload as any).eq("school_id", profile.school_id));
    } else {
      ({ error } = await supabase.from("dismissal_settings").insert({
        school_id: profile.school_id, is_active: false, ...payload,
      } as any));
    }
    setSavingTime(false);
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else toast.success("Waktu absensi berhasil diperbarui!");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarOff}
        title="Mode Libur & Waktu Absensi"
        subtitle={canEdit
          ? "Kelola mode libur cepat, hari libur mingguan, dan rentang waktu absensi"
          : "Lihat pengaturan mode libur & waktu absensi sekolah"}
      />

      <Card className="border-0 shadow-card bg-gradient-to-br from-[#5B6CF9]/5 to-transparent">
        <CardContent className="p-4 flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4 text-[#5B6CF9]" />
          </div>
          <div className="text-sm text-muted-foreground">
            Untuk kelola tanggal libur nasional, ujian, kegiatan, atau agenda sekolah lainnya, gunakan menu <span className="font-semibold text-foreground">Kalender Akademik</span>.
          </div>
        </CardContent>
      </Card>

      {/* Toggle Mode Libur */}
      {canEdit && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PowerOff className="h-4 w-4 text-primary" />
              Toggle Mode Libur Cepat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`rounded-xl border p-4 transition-colors ${holidayMode ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800" : "bg-secondary/40 border-border"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    {holidayMode ? "Mode Libur AKTIF" : "Mode Libur Nonaktif"}
                    {holidayMode && <Badge className="bg-amber-500 text-white border-0">Absensi Ditangguhkan</Badge>}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktifkan bila hari ini libur mendadak (cuaca ekstrem, event khusus, dll).
                  </p>
                </div>
                <Switch checked={holidayMode} disabled={saving || loading} onCheckedChange={handleToggle} />
              </div>
              {holidayMode && (
                <div className="mt-3">
                  <Label className="text-xs">Alasan / Label</Label>
                  <Input
                    value={holidayModeLabel}
                    onChange={(e) => setHolidayModeLabel(e.target.value)}
                    onBlur={() => holidayMode && supabase.from("schools").update({ holiday_mode_label: holidayModeLabel } as any).eq("id", profile?.school_id || "").then(() => {})}
                    placeholder="Contoh: Cuaca ekstrem, Ujian nasional, dll"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hari Libur Mingguan */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-primary" />
            Hari Libur Sekolah (Mingguan)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Pilih hari libur tetap sekolah. Pada hari yang dipilih, sistem tidak menghitung absensi (tidak Auto-Alfa) dan dianggap libur."
              : "Daftar hari libur tetap sekolah yang berlaku setiap minggu."}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {[
              { v: 1, label: "Senin" }, { v: 2, label: "Selasa" }, { v: 3, label: "Rabu" },
              { v: 4, label: "Kamis" }, { v: 5, label: "Jumat" }, { v: 6, label: "Sabtu" },
              { v: 0, label: "Minggu" },
            ].map((d) => {
              const active = holidayDays.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  disabled={savingDays || loading || !canEdit}
                  onClick={() => toggleHolidayDay(d.v)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground">
            Hari aktif: <strong className="text-foreground">{
              [1,2,3,4,5,6,0].filter(d => !holidayDays.includes(d))
                .map(d => ({1:"Senin",2:"Selasa",3:"Rabu",4:"Kamis",5:"Jumat",6:"Sabtu",0:"Minggu"} as any)[d])
                .join(", ") || "(tidak ada)"
            }</strong>
          </div>
        </CardContent>
      </Card>

      {/* Waktu Absensi Datang & Pulang */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Waktu Absensi Datang & Pulang
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Sistem otomatis menentukan mode absensi (Datang / Pulang) berdasarkan waktu scan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-success/5 border border-success/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-success/15 text-success border-success/20 text-xs">Datang</Badge>
              <span className="text-xs text-muted-foreground">Waktu absensi kedatangan siswa</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="att-start" className="text-xs">Mulai</Label>
                <Input id="att-start" type="time" value={attStartTime} onChange={(e) => setAttStartTime(e.target.value)} disabled={loading || !canEdit} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="att-end" className="text-xs">Selesai</Label>
                <Input id="att-end" type="time" value={attEndTime} onChange={(e) => setAttEndTime(e.target.value)} disabled={loading || !canEdit} />
              </div>
            </div>
          </div>

          <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-warning/15 text-warning border-warning/20 text-xs">Pulang</Badge>
              <span className="text-xs text-muted-foreground">Waktu absensi kepulangan siswa</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="dep-start" className="text-xs">Mulai</Label>
                <Input id="dep-start" type="time" value={depStartTime} onChange={(e) => setDepStartTime(e.target.value)} disabled={loading || !canEdit} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dep-end" className="text-xs">Selesai</Label>
                <Input id="dep-end" type="time" value={depEndTime} onChange={(e) => setDepEndTime(e.target.value)} disabled={loading || !canEdit} />
              </div>
            </div>
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>• <strong>Waktu Datang ({attStartTime} - {attEndTime}):</strong> Scan tercatat sebagai <strong>Datang</strong></p>
            <p>• <strong>Waktu Pulang ({depStartTime} - {depEndTime}):</strong> Scan tercatat sebagai <strong>Pulang</strong></p>
            <p>• Setiap siswa bisa scan <strong>1x Datang</strong> dan <strong>1x Pulang</strong> per hari</p>
          </div>

          {canEdit && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveTime} disabled={savingTime || loading} className="bg-[#5B6CF9] hover:bg-[#4c5ded] text-white">
                {savingTime ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayManagement;
