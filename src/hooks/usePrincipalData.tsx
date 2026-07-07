import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { toast } from "sonner";

export interface PrincipalStats {
  totalStudents: number;
  totalTeachers: number;
  teachersPresent: number;
  studentsPresent: number;
  activeClasses: number;
  attendanceRate: number;
}

export interface PrincipalData {
  loading: boolean;
  schoolName: string;
  now: Date;
  stats: PrincipalStats;
  liveClasses: any[];
  teacherAtt: { hadir: number; izin: number; sakit: number; alfa: number; belum: number };
  classAtt: Array<{ name: string; total: number; hadir: number }>;
  finance: { totalTagihan: number; totalPembayaran: number; tunggakan: number; saldoKas: number; danaPending: number };
  settlements: any[];
  monthly: any[];
  ranking: any[];
  calendar: any[];
  timeline: any[];
  notifs: any[];
  leaves: any[];
  announcements: any[];
  pendingSettlements: any[];
  withdrawals: any[];
  refresh: () => Promise<void>;
  setLeaves: (v: any[]) => void;
}

const Ctx = createContext<PrincipalData | null>(null);

const todayStr = () => new Date().toISOString().slice(0, 10);

export function PrincipalDataProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const schoolId = profile?.school_id;
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [schoolName, setSchoolName] = useState("");
  const [stats, setStats] = useState<PrincipalStats>({
    totalStudents: 0, totalTeachers: 0, teachersPresent: 0,
    studentsPresent: 0, activeClasses: 0, attendanceRate: 0,
  });
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [teacherAtt, setTeacherAtt] = useState({ hadir: 0, izin: 0, sakit: 0, alfa: 0, belum: 0 });
  const [classAtt, setClassAtt] = useState<Array<{ name: string; total: number; hadir: number }>>([]);
  const [finance, setFinance] = useState({ totalTagihan: 0, totalPembayaran: 0, tunggakan: 0, saldoKas: 0, danaPending: 0 });
  const [settlements, setSettlements] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      const today = todayStr();
      const dow = new Date().getDay();
      const hhmm = new Date().toTimeString().slice(0, 8);
      const monthAgo = format(subMonths(new Date(), 5), "yyyy-MM-dd");

      const [
        schoolQ, studentsQ, classesQ, teachersQ, teacherLogsQ, studentLogsQ,
        schedulesQ, subjectAttQ, invoicesQ, cashQ, setlAllQ,
        leavesQ, annQ, setlPendingQ, wdQ, holidaysQ, allInvoicesQ,
        allTeacherLogsQ, allStudentLogsQ, allCashQ,
      ] = await Promise.all([
        supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
        supabase.from("students").select("id, class").eq("school_id", schoolId),
        supabase.from("classes").select("id, name").eq("school_id", schoolId),
        supabase.from("user_roles").select("user_id").eq("role", "teacher" as any),
        supabase.from("teacher_attendance_logs").select("user_id, status, attendance_type").eq("school_id", schoolId).eq("date", today),
        supabase.from("attendance_logs").select("student_id, status, attendance_type, created_at").eq("school_id", schoolId).eq("date", today),
        supabase.from("teaching_schedules").select("id, teacher_id, class_id, subject_id, start_time, end_time, day_of_week, is_active").eq("school_id", schoolId).eq("day_of_week", dow).eq("is_active", true),
        supabase.from("subject_attendance").select("teaching_schedule_id, status").eq("school_id", schoolId).eq("date", today),
        supabase.from("spp_invoices").select("total_amount, status, paid_at, created_at").eq("school_id", schoolId),
        supabase.from("cash_book_entries").select("direction, amount, entry_date, category, description, created_at").eq("school_id", schoolId).order("entry_date", { ascending: false }).limit(500),
        supabase.from("spp_settlements").select("*").eq("school_id", schoolId).order("requested_at", { ascending: false }).limit(10),
        supabase.from("parent_leave_requests").select("*, students(name, class)").eq("school_id", schoolId).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
        supabase.from("school_announcements").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(20),
        supabase.from("spp_settlements").select("*").eq("school_id", schoolId).eq("status", "pending").order("requested_at", { ascending: false }),
        supabase.from("affiliate_withdrawals").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("school_holidays").select("*").eq("school_id", schoolId).gte("date", format(startOfMonth(new Date()), "yyyy-MM-dd")).lte("date", format(endOfMonth(subMonths(new Date(), -1)), "yyyy-MM-dd")),
        supabase.from("spp_invoices").select("total_amount, paid_at, status, created_at").eq("school_id", schoolId).gte("created_at", monthAgo),
        supabase.from("teacher_attendance_logs").select("date, status").eq("school_id", schoolId).gte("date", monthAgo),
        supabase.from("attendance_logs").select("date, status, student_id").eq("school_id", schoolId).gte("date", monthAgo),
        supabase.from("cash_book_entries").select("entry_date, direction, amount").eq("school_id", schoolId).gte("entry_date", monthAgo),
      ]);

      if (schoolQ.data?.name) setSchoolName(schoolQ.data.name);

      const students = studentsQ.data || [];
      const classes = classesQ.data || [];
      const teacherIds = new Set((teachersQ.data || []).map((r: any) => r.user_id));

      const teacherLogsAll = (teacherLogsQ.data || []).filter((l: any) => teacherIds.has(l.user_id));
      const teacherArrival = teacherLogsAll.filter((l: any) => (l.attendance_type ?? "datang") === "datang");
      const tHadir = teacherArrival.filter((l: any) => l.status === "hadir").length;
      const tIzin = teacherArrival.filter((l: any) => l.status === "izin").length;
      const tSakit = teacherArrival.filter((l: any) => l.status === "sakit").length;
      const tAlfa = teacherArrival.filter((l: any) => l.status === "alfa").length;
      const tBelum = Math.max(0, teacherIds.size - (tHadir + tIzin + tSakit + tAlfa));
      setTeacherAtt({ hadir: tHadir, izin: tIzin, sakit: tSakit, alfa: tAlfa, belum: tBelum });

      const studentLogs = (studentLogsQ.data || []).filter((l: any) => (l.attendance_type ?? "datang") === "datang");
      const uniqStudentPresent = new Set(studentLogs.filter((l: any) => l.status === "hadir").map((l: any) => l.student_id)).size;
      const rate = students.length > 0 ? Math.round((uniqStudentPresent / students.length) * 100) : 0;

      const byClass: Record<string, { hadir: number; total: number }> = {};
      const classSize: Record<string, number> = {};
      students.forEach((s: any) => { classSize[s.class || "-"] = (classSize[s.class || "-"] || 0) + 1; });
      Object.keys(classSize).forEach(c => { byClass[c] = { hadir: 0, total: classSize[c] }; });
      studentLogs.forEach((l: any) => {
        const st = students.find((s: any) => s.id === l.student_id);
        const cls = st?.class || "-";
        if (!byClass[cls]) byClass[cls] = { hadir: 0, total: classSize[cls] || 0 };
        if (l.status === "hadir") byClass[cls].hadir += 1;
      });
      setClassAtt(Object.entries(byClass).map(([name, v]) => ({ name, hadir: v.hadir, total: v.total })).sort((a, b) => a.name.localeCompare(b.name)));

      const schedules = schedulesQ.data || [];
      const subjectAtt = subjectAttQ.data || [];
      const liveNow = schedules.filter((s: any) => s.start_time <= hhmm && s.end_time > hhmm);
      const subjectIds = Array.from(new Set(schedules.map((s: any) => s.subject_id).filter(Boolean)));
      const classIds = Array.from(new Set(schedules.map((s: any) => s.class_id).filter(Boolean)));
      const teacherProfileIds = Array.from(new Set(schedules.map((s: any) => s.teacher_id).filter(Boolean)));

      const [subjMap, clsMap, tchMap] = await Promise.all([
        subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] as any[] }),
        classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [] as any[] }),
        teacherProfileIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", teacherProfileIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const sMap = new Map((subjMap.data || []).map((x: any) => [x.id, x.name]));
      const cMap = new Map((clsMap.data || []).map((x: any) => [x.id, x.name]));
      const tMap = new Map((tchMap.data || []).map((x: any) => [x.user_id, x.full_name]));

      const nowD = new Date();
      const currentClasses: any[] = [];
      const upcomingClasses: any[] = [];
      const doneClasses: any[] = [];
      schedules.forEach((s: any) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        const startMin = sh * 60 + sm, endMin = eh * 60 + em, curMin = nowD.getHours() * 60 + nowD.getMinutes();
        const progress = Math.min(100, Math.max(0, ((curMin - startMin) / (endMin - startMin)) * 100));
        const hadir = subjectAtt.filter((a: any) => a.teaching_schedule_id === s.id && a.status === "hadir").length;
        const className = cMap.get(s.class_id) || "-";
        const total = classSize[className] || 0;
        const journalFilled = subjectAtt.some((a: any) => a.teaching_schedule_id === s.id);
        const item = {
          id: s.id, subject: sMap.get(s.subject_id) || "Pelajaran",
          teacher: tMap.get(s.teacher_id) || "-",
          className, hadir, total,
          startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5),
          progress, journalFilled,
          status: curMin < startMin ? "upcoming" : curMin >= endMin ? "done" : "live",
        };
        if (item.status === "live") currentClasses.push(item);
        else if (item.status === "upcoming") upcomingClasses.push(item);
        else doneClasses.push(item);
      });
      setLiveClasses([...currentClasses, ...upcomingClasses, ...doneClasses]);

      const activeClassIds = new Set(schedules.map((s: any) => s.class_id));

      setStats({
        totalStudents: students.length,
        totalTeachers: teacherIds.size,
        teachersPresent: tHadir,
        studentsPresent: uniqStudentPresent,
        activeClasses: activeClassIds.size,
        attendanceRate: rate,
      });

      const invoices = invoicesQ.data || [];
      const totalTagihan = invoices.reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const totalPembayaran = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const tunggakan = invoices.filter((i: any) => i.status !== "paid").reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const cashEntries = cashQ.data || [];
      const saldoKas = cashEntries.reduce((s: number, e: any) => s + (e.direction === "in" ? (e.amount || 0) : -(e.amount || 0)), 0);
      const danaPending = (setlPendingQ.data || []).reduce((s: number, e: any) => s + (e.final_payout || 0), 0);
      setFinance({ totalTagihan, totalPembayaran, tunggakan, saldoKas, danaPending });
      setSettlements(setlAllQ.data || []);

      const monthsList: Array<{ key: string; label: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        monthsList.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM") });
      }
      const invByMonth = new Map<string, number>();
      const teacherByMonth = new Map<string, number>();
      const studentByMonth = new Map<string, number>();
      const inByMonth = new Map<string, number>();
      const outByMonth = new Map<string, number>();
      (allInvoicesQ.data || []).forEach((i: any) => {
        if (i.status === "paid" && i.paid_at) {
          const k = i.paid_at.slice(0, 7);
          invByMonth.set(k, (invByMonth.get(k) || 0) + (i.total_amount || 0));
        }
      });
      (allTeacherLogsQ.data || []).forEach((l: any) => {
        if (l.status === "hadir") { const k = l.date.slice(0, 7); teacherByMonth.set(k, (teacherByMonth.get(k) || 0) + 1); }
      });
      (allStudentLogsQ.data || []).forEach((l: any) => {
        if (l.status === "hadir") { const k = l.date.slice(0, 7); studentByMonth.set(k, (studentByMonth.get(k) || 0) + 1); }
      });
      (allCashQ.data || []).forEach((e: any) => {
        const k = e.entry_date.slice(0, 7);
        if (e.direction === "in") inByMonth.set(k, (inByMonth.get(k) || 0) + (e.amount || 0));
        else outByMonth.set(k, (outByMonth.get(k) || 0) + (e.amount || 0));
      });
      setMonthly(monthsList.map(m => ({
        month: m.label,
        Guru: teacherByMonth.get(m.key) || 0,
        Siswa: studentByMonth.get(m.key) || 0,
        SPP: invByMonth.get(m.key) || 0,
        Pendapatan: inByMonth.get(m.key) || 0,
        Pengeluaran: outByMonth.get(m.key) || 0,
      })));

      const rankArr = Object.entries(byClass).map(([name, v]) => ({
        name,
        attendance: v.total ? Math.round((v.hadir / v.total) * 100) : 0,
        hadir: v.hadir, total: v.total,
      })).sort((a, b) => b.attendance - a.attendance);
      setRanking(rankArr);

      const cal = [
        ...(holidaysQ.data || []).map((h: any) => ({ date: h.date, label: h.label, type: "libur" })),
        ...(annQ.data || []).slice(0, 20).map((a: any) => ({ date: a.created_at.slice(0, 10), label: a.title, type: "agenda" })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      setCalendar(cal.slice(0, 30));

      setLeaves(leavesQ.data || []);
      setAnnouncements((annQ.data || []).filter((a: any) => a.type === "draft" || a.type === "pending"));
      setPendingSettlements(setlPendingQ.data || []);
      setWithdrawals(wdQ.data || []);

      const notifList: any[] = [];
      const totalApprovals = (leavesQ.data?.length || 0) + (setlPendingQ.data?.length || 0);
      if (totalApprovals > 0) notifList.push({ key: "approvals", title: `${totalApprovals} pengajuan menunggu persetujuan`, tone: "warning" });
      const classesWithoutAtt = classes.length - Object.keys(byClass).filter(c => byClass[c].hadir > 0).length;
      if (classesWithoutAtt > 0) notifList.push({ key: "attclass", title: `${classesWithoutAtt} kelas belum melakukan absensi hari ini`, tone: "warning" });
      const teachersJournalDone = new Set((subjectAttQ.data || []).map((a: any) => a.teaching_schedule_id)).size;
      if (schedules.length - teachersJournalDone > 0) notifList.push({ key: "jurnal", title: `${schedules.length - teachersJournalDone} jadwal belum diisi jurnal`, tone: "info" });
      const paymentsToday = (invoicesQ.data || []).filter((i: any) => i.paid_at?.slice(0, 10) === today).length;
      if (paymentsToday > 0) notifList.push({ key: "spp", title: `${paymentsToday} pembayaran SPP masuk hari ini`, tone: "success" });
      setNotifs(notifList);

      const tl: any[] = [];
      (studentLogsQ.data || []).slice(0, 8).forEach((l: any) => tl.push({ type: "attendance", label: `Absensi siswa: ${l.status}`, at: l.created_at || today, tone: "primary" }));
      (invoicesQ.data || []).filter((i: any) => i.paid_at).slice(0, 8).forEach((i: any) => tl.push({ type: "payment", label: `Pembayaran SPP Rp ${(i.total_amount || 0).toLocaleString("id-ID")}`, at: i.paid_at, tone: "success" }));
      (annQ.data || []).slice(0, 6).forEach((a: any) => tl.push({ type: "announcement", label: `Pengumuman: ${a.title}`, at: a.created_at, tone: "info" }));
      (cashEntries || []).slice(0, 6).forEach((c: any) => tl.push({ type: c.direction === "in" ? "cash_in" : "cash_out", label: `Kas ${c.direction === "in" ? "Masuk" : "Keluar"}: Rp ${(c.amount || 0).toLocaleString("id-ID")}`, at: c.created_at, tone: c.direction === "in" ? "success" : "warning" }));
      (setlAllQ.data || []).slice(0, 4).forEach((s: any) => tl.push({ type: "settlement", label: `Pencairan ${s.settlement_code} (${s.status})`, at: s.requested_at, tone: "info" }));
      tl.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      setTimeline(tl.slice(0, 30));

    } catch (e) {
      console.error("Principal load error", e);
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !schoolId) { setLoading(false); return; }
    loadAll();
  }, [authLoading, user, schoolId, loadAll]);

  return (
    <Ctx.Provider value={{
      loading, schoolName, now, stats, liveClasses, teacherAtt, classAtt, finance,
      settlements, monthly, ranking, calendar, timeline, notifs, leaves,
      announcements, pendingSettlements, withdrawals, refresh: loadAll, setLeaves,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePrincipalData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrincipalData must be used within PrincipalDataProvider");
  return ctx;
}
