import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CalendarDays, Save, Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { fetchSchoolHolidayStatus } from "@/lib/schoolHoliday";
import { motion } from "framer-motion";

const STATUS_OPTIONS = [
  { value: "hadir", label: "H", full: "Hadir", color: "bg-success/15 text-success border-success/30" },
  { value: "sakit", label: "S", full: "Sakit", color: "bg-blue-100 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" },
  { value: "izin", label: "I", full: "Izin", color: "bg-warning/15 text-warning border-warning/30" },
  { value: "alfa", label: "A", full: "Alfa", color: "bg-destructive/15 text-destructive border-destructive/30" },
];

interface Student {
  id: string;
  name: string;
  student_id: string;
  class: string;
  photo_url: string | null;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: string;
  time: string;
  date: string;
}

const WaliKelasAttendance = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<{ class_name: string; school_id: string }[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [changes, setChanges] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClass, setSelectedClass] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("class_teachers").select("class_name, school_id").eq("user_id", user.id)
      .then(({ data }) => {
        setAssignments(data || []);
        if (data && data.length > 0 && !selectedClass) setSelectedClass(data[0].class_name);
      });
  }, [user]);

  useEffect(() => {
    if (!assignments.length || !selectedClass) { setLoading(false); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const schoolId = assignments[0].school_id;

        const { data: studentData } = await supabase
          .from("students").select("id, name, student_id, class, photo_url")
          .eq("school_id", schoolId).eq("class", selectedClass).order("name");

        setStudents(studentData || []);

        if (studentData && studentData.length > 0) {
          const ids = studentData.map(s => s.id);
          const { data: attData } = await supabase
            .from("attendance_logs").select("id, student_id, status, time, date")
            .eq("school_id", schoolId).eq("date", selectedDate).in("student_id", ids);

          const map = new Map<string, AttendanceRecord>();
          (attData || []).forEach(a => map.set(a.student_id, a));
          setAttendance(map);
        } else {
          setAttendance(new Map());
        }
        setChanges(new Map());
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [assignments, selectedClass, selectedDate]);

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q));
  }, [students, search]);

  const getStudentStatus = (studentId: string) => {
    if (changes.has(studentId)) return changes.get(studentId)!;
    return attendance.get(studentId)?.status || "";
  };

  const handleStatusChange = (studentId: string, status: string) => {
    const existing = attendance.get(studentId);
    if (existing && existing.status === status) {
      const newChanges = new Map(changes);
      newChanges.delete(studentId);
      setChanges(newChanges);
    } else {
      setChanges(new Map(changes).set(studentId, status));
    }
  };

  const sendAttendanceWA = async (
    schoolId: string,
    studentId: string,
    status: string,
    timeStr: string,
  ) => {
    try {
      // Only send WA for "hadir" status
      if (status !== "hadir") return;
      const student = students.find(s => s.id === studentId) as any;
      if (!student) return;

      const [integrationRes, schoolRes, studentFullRes, classRes] = await Promise.all([
        supabase.from("school_integrations")
          .select("attendance_arrive_template, attendance_group_template, wa_delivery_target, wa_enabled, is_active")
          .eq("school_id", schoolId).eq("integration_type", "onesender").maybeSingle(),
        supabase.from("schools").select("name").eq("id", schoolId).single(),
        supabase.from("students").select("parent_phone, parent_name").eq("id", studentId).single(),
        supabase.from("classes").select("wa_group_id").eq("school_id", schoolId).eq("name", selectedClass).maybeSingle(),
      ]);

      const integration = integrationRes.data as any;
      if (!integration || integration.wa_enabled === false) return;

      const schoolName = schoolRes.data?.name || "";
      const parentPhone = studentFullRes.data?.parent_phone || "";
      const parentName = studentFullRes.data?.parent_name || "";
      const groupId = classRes.data?.wa_group_id || null;
      const deliveryTarget = integration.wa_delivery_target || "parent_only";

      const now = new Date();
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dayName = dayNames[now.getDay()];
      const dateStr = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      const hhmm = timeStr.slice(0, 5);
      const typeLabel = "Datang (Hadir)";

      const apply = (tpl: string) => tpl
        .replace(/\{student_name\}/g, student.name)
        .replace(/\{class\}/g, student.class)
        .replace(/\{time\}/g, hhmm)
        .replace(/\{day\}/g, dayName)
        .replace(/\{date\}/g, dateStr)
        .replace(/\{student_id\}/g, student.student_id)
        .replace(/\{method\}/g, "Manual Wali Kelas")
        .replace(/\{parent_name\}/g, parentName)
        .replace(/\{school_name\}/g, schoolName)
        .replace(/\{type\}/g, typeLabel);

      const tasks: Promise<any>[] = [];

      if ((deliveryTarget === "parent_only" || deliveryTarget === "both") && parentPhone) {
        const tpl = integration.attendance_arrive_template || "";
        const message = tpl ? apply(tpl)
          : `*Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nAnanda *${student.name}* (Kelas ${student.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${hhmm}.\n\nMetode: Manual Wali Kelas\n\n_Pesan otomatis dari ATSkolla_`;
        tasks.push(supabase.functions.invoke("send-whatsapp", {
          body: { school_id: schoolId, phone: parentPhone, message, message_type: "attendance", student_name: student.name },
        }));
      }

      if ((deliveryTarget === "group_only" || deliveryTarget === "both") && groupId) {
        const tpl = integration.attendance_group_template || "";
        const message = tpl ? apply(tpl)
          : `*Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nSiswa *${student.name}* (Kelas ${student.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${hhmm}.\n\nMetode: Manual Wali Kelas\n\n_Pesan otomatis dari ATSkolla_`;
        tasks.push(supabase.functions.invoke("send-whatsapp", {
          body: { school_id: schoolId, group_id: groupId, message, message_type: "attendance_group", student_name: student.name },
        }));
      }

      if (tasks.length > 0) await Promise.allSettled(tasks);
    } catch {
      // Silent: don't fail save if WA fails
    }
  };

  const handleSave = async () => {
    if (changes.size === 0) { toast.info("Tidak ada perubahan"); return; }
    const schoolId = assignments[0].school_id;
    // Block manual attendance during holiday (only when marking for today)
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate === today) {
      const holidayStatus = await fetchSchoolHolidayStatus(schoolId);
      if (holidayStatus.isHoliday) {
        toast.error(`Absensi ditangguhkan: ${holidayStatus.reason}`);
        return;
      }
    }
    setSaving(true);
    const now = new Date().toTimeString().slice(0, 8);

    try {
      const waTasks: Promise<any>[] = [];
      for (const [studentId, status] of changes) {
        const existing = attendance.get(studentId);
        if (existing) {
          await supabase.from("attendance_logs").update({ status, time: now }).eq("id", existing.id);
        } else {
          await supabase.from("attendance_logs").insert({
            school_id: schoolId, student_id: studentId, date: selectedDate,
            status, time: now, method: "manual", attendance_type: "datang",
          });
        }
        // Trigger WA for hadir status (only for today's attendance)
        if (status === "hadir" && selectedDate === new Date().toISOString().slice(0, 10)) {
          waTasks.push(sendAttendanceWA(schoolId, studentId, status, now));
        }
      }
      if (waTasks.length > 0) await Promise.allSettled(waTasks);
      toast.success(`${changes.size} absensi berhasil disimpan`);

      // Refresh
      const ids = students.map(s => s.id);
      const { data: attData } = await supabase
        .from("attendance_logs").select("id, student_id, status, time, date")
        .eq("school_id", schoolId).eq("date", selectedDate).in("student_id", ids);
      const map = new Map<string, AttendanceRecord>();
      (attData || []).forEach(a => map.set(a.student_id, a));
      setAttendance(map);
      setChanges(new Map());
    } catch {
      toast.error("Gagal menyimpan absensi");
    }
    setSaving(false);
  };

  const classNames = assignments.map(a => a.class_name);
  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const totalFilled = students.filter(s => getStudentStatus(s.id)).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat data...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] p-5 sm:p-6 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Absensi Manual</h1>
            <p className="text-white/70 text-xs sm:text-sm">Kelola absensi siswa kelas yang Anda ampu</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Pilih Kelas" />
          </SelectTrigger>
          <SelectContent>
            {classNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="pl-9 w-44" />
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari siswa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            {totalFilled}/{students.length} terisi
          </Badge>
          {!isToday && <Badge variant="outline" className="text-xs text-warning border-warning/30">Mengubah data tanggal lalu</Badge>}
        </div>
        <Button onClick={handleSave} disabled={changes.size === 0 || saving} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan ({changes.size})
        </Button>
      </div>

      {/* Student list with status buttons */}
      <Card className="border-0 shadow-card overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <span className="text-xs font-bold text-muted-foreground">NAMA SISWA</span>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map(s => (
                <span key={s.value} className="text-[10px] font-bold text-muted-foreground w-10 text-center">{s.label}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {filteredStudents.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Tidak ada siswa ditemukan</div>
          ) : (
            filteredStudents.map((s, i) => {
              const currentStatus = getStudentStatus(s.id);
              const hasChange = changes.has(s.id);
              const existingAtt = attendance.get(s.id);
              return (
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className={`grid grid-cols-[1fr_auto] gap-2 items-center p-3 transition-colors ${hasChange ? "bg-primary/5" : "hover:bg-secondary/30"}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                      {s.photo_url ? <img src={s.photo_url} alt="" className="h-full w-full object-cover rounded-full" /> : s.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">NIS: {s.student_id}</span>
                        {existingAtt && !hasChange && (
                          <span className="text-[10px] font-mono text-muted-foreground/70">• {existingAtt.time.slice(0, 5)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.map(opt => {
                      const isActive = currentStatus === opt.value;
                      return (
                        <button key={opt.value} onClick={() => handleStatusChange(s.id, opt.value)}
                          className={`w-10 h-9 rounded-lg text-xs font-bold border transition-all ${
                            isActive ? opt.color + " ring-2 ring-offset-1 ring-current/20" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                          }`}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {STATUS_OPTIONS.map(s => (
          <span key={s.value} className="flex items-center gap-1.5">
            <span className={`inline-block w-5 h-5 rounded text-center leading-5 text-[10px] font-bold border ${s.color}`}>{s.label}</span>
            {s.full}
          </span>
        ))}
      </div>
    </div>
  );
};

export default WaliKelasAttendance;
