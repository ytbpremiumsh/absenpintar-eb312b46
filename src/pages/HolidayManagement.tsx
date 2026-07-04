import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { CalendarOff, CalendarDays, PowerOff, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const HolidayManagement = () => {
  const { profile } = useAuth();
  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayModeLabel, setHolidayModeLabel] = useState("");
  const [holidayDates, setHolidayDates] = useState<{ id: string; date: string; label: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [newHolidayLabel, setNewHolidayLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    Promise.all([
      supabase.from("schools").select("holiday_mode, holiday_mode_label").eq("id", profile.school_id).single(),
      supabase.from("school_holidays").select("id, date, label").eq("school_id", profile.school_id).order("date"),
    ]).then(([sRes, hRes]) => {
      if (sRes.data) {
        setHolidayMode(!!(sRes.data as any).holiday_mode);
        setHolidayModeLabel((sRes.data as any).holiday_mode_label || "");
      }
      setHolidayDates((hRes.data || []) as any);
      setLoading(false);
    });
  }, [profile?.school_id]);

  const handleToggle = async (val: boolean) => {
    if (!profile?.school_id) return;
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

  const handleAddDate = async (date: Date | undefined) => {
    if (!date || !profile?.school_id) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    const existing = holidayDates.find((h) => h.date === iso);
    if (existing) {
      const { error } = await supabase.from("school_holidays").delete().eq("id", existing.id);
      if (error) { toast.error("Gagal: " + error.message); return; }
      setHolidayDates(holidayDates.filter((h) => h.id !== existing.id));
      toast.success("Tanggal libur dihapus");
      return;
    }
    const { data, error } = await supabase.from("school_holidays").insert({
      school_id: profile.school_id, date: iso, label: newHolidayLabel || null,
    } as any).select().single();
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayDates([...holidayDates, data as any].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHolidayLabel("");
    toast.success("Tanggal libur ditambahkan");
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("school_holidays").delete().eq("id", id);
    if (error) { toast.error("Gagal: " + error.message); return; }
    setHolidayDates(holidayDates.filter((h) => h.id !== id));
    toast.success("Dihapus");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarOff}
        title="Mode Libur & Tanggal Merah"
        subtitle="Kelola hari libur mendadak dan kalender tanggal merah sekolah"
      />

      {/* Info banner */}
      <Card className="border-0 shadow-card bg-gradient-to-br from-[#5B6CF9]/5 to-transparent">
        <CardContent className="p-4 flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
            <Info className="h-4.5 w-4.5 text-[#5B6CF9]" />
          </div>
          <div className="text-sm text-muted-foreground">
            Saat <span className="font-semibold text-foreground">Mode Libur AKTIF</span> atau tanggal masuk kalender tanggal merah,
            sistem otomatis <span className="font-semibold text-foreground">menolak absensi</span> dan
            <span className="font-semibold text-foreground"> tidak menandai siswa sebagai Alfa</span>.
          </div>
        </CardContent>
      </Card>

      {/* Toggle Mode Libur */}
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

      {/* Kalender Tanggal Merah */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Kalender Tanggal Merah Sekolah
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Klik tanggal untuk menandai libur. Klik lagi tanggal yang sama untuk membatalkan.
          </p>
          <Input
            value={newHolidayLabel}
            onChange={(e) => setNewHolidayLabel(e.target.value)}
            placeholder="Label opsional (mis: Libur Semester, HUT RI)"
            className="text-sm h-9"
          />

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border p-2 flex justify-center">
              <Calendar
                mode="single"
                onSelect={handleAddDate}
                modifiers={{ holiday: holidayDates.map((h) => new Date(h.date + "T00:00:00")) }}
                modifiersClassNames={{ holiday: "bg-red-500 text-white hover:bg-red-600 rounded-full" }}
                className="p-0"
              />
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Total: <span className="font-semibold text-foreground">{holidayDates.length}</span> tanggal libur
              </p>
              {holidayDates.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada tanggal libur.<br />Klik tanggal di kalender untuk menambahkan.
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
                  {holidayDates.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 border border-border/50">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">
                          {new Date(h.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        {h.label && <p className="text-[11px] text-muted-foreground truncate">{h.label}</p>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleRemove(h.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayManagement;
