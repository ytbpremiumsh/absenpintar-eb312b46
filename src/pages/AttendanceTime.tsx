import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, Save, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AttendanceTime = () => {
  const { profile } = useAuth();
  const [attStartTime, setAttStartTime] = useState("06:00");
  const [attEndTime, setAttEndTime] = useState("12:00");
  const [depStartTime, setDepStartTime] = useState("12:00");
  const [depEndTime, setDepEndTime] = useState("17:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    supabase.from("dismissal_settings")
      .select("attendance_start_time, attendance_end_time, departure_start_time, departure_end_time")
      .eq("school_id", profile.school_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAttStartTime((data as any).attendance_start_time?.slice(0, 5) || "06:00");
          setAttEndTime((data as any).attendance_end_time?.slice(0, 5) || "12:00");
          setDepStartTime((data as any).departure_start_time?.slice(0, 5) || "12:00");
          setDepEndTime((data as any).departure_end_time?.slice(0, 5) || "17:00");
        }
        setLoading(false);
      });
  }, [profile?.school_id]);

  const handleSave = async () => {
    if (!profile?.school_id) return;
    setSaving(true);
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
    setSaving(false);
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else toast.success("Waktu absensi berhasil diperbarui!");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Clock}
        title="Waktu Absensi Datang & Pulang"
        subtitle="Atur rentang waktu untuk sistem mengenali scan sebagai datang atau pulang"
      />

      <Card className="border-0 shadow-card bg-gradient-to-br from-[#5B6CF9]/5 to-transparent">
        <CardContent className="p-4 flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#5B6CF9]/10 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4 text-[#5B6CF9]" />
          </div>
          <div className="text-sm text-muted-foreground">
            Sistem akan otomatis menentukan mode absensi (<span className="font-semibold text-foreground">Datang</span> atau <span className="font-semibold text-foreground">Pulang</span>) berdasarkan waktu saat siswa melakukan scan.
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Pengaturan Rentang Waktu
          </CardTitle>
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
                <Input id="att-start" type="time" value={attStartTime} onChange={(e) => setAttStartTime(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="att-end" className="text-xs">Selesai</Label>
                <Input id="att-end" type="time" value={attEndTime} onChange={(e) => setAttEndTime(e.target.value)} disabled={loading} />
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
                <Input id="dep-start" type="time" value={depStartTime} onChange={(e) => setDepStartTime(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dep-end" className="text-xs">Selesai</Label>
                <Input id="dep-end" type="time" value={depEndTime} onChange={(e) => setDepEndTime(e.target.value)} disabled={loading} />
              </div>
            </div>
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>• <strong>Waktu Datang ({attStartTime} - {attEndTime}):</strong> Scan tercatat sebagai absensi <strong>Datang</strong></p>
            <p>• <strong>Waktu Pulang ({depStartTime} - {depEndTime}):</strong> Scan tercatat sebagai absensi <strong>Pulang</strong></p>
            <p>• Setiap siswa bisa scan <strong>1x Datang</strong> dan <strong>1x Pulang</strong> per hari</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || loading} className="bg-[#5B6CF9] hover:bg-[#4c5ded] text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan Perubahan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceTime;
