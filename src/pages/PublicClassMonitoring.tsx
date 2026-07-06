import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  UserCheck, UserX, Clock, Users, RefreshCw,
  GraduationCap, Activity, CheckCircle2, Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { announceDismissal } from "@/lib/announceDismissal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface StudentStatus {
  id: string;
  name: string;
  class: string;
  parent_name: string;
  student_id: string;
  photo_url: string | null;
  status: "waiting" | "picked_up";
  dismissal_time: string | null;
  dismissed_by: string | null;
}

const LiveDot = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
  </span>
);

const PublicClassMonitoring = () => {
  const params = useParams<{ schoolId: string; className: string }>();
  const { school: tenantSchool } = useTenant();
  const schoolId = params.schoolId || tenantSchool?.id;
  const className = params.className;
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmStudent, setConfirmStudent] = useState<StudentStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const [successPopup, setSuccessPopup] = useState<StudentStatus | null>(null);
  const prevPickedIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);

  const decodedClass = className ? decodeURIComponent(className) : "";

  const fetchData = async (showRefresh = false) => {
    if (!schoolId || !decodedClass) return;
    if (showRefresh) setIsRefreshing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-monitoring?school_id=${schoolId}&class=${encodeURIComponent(decodedClass)}`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const json = await res.json();
      if (json.error) return;

      setSchoolName(json.school?.name || "ATSkolla");

      const classStudents: StudentStatus[] = json.classes[decodedClass] || [];

      // Announce newly picked up students (skip first load)
      if (!initialLoad.current) {
        const newPicked = classStudents.filter(
          (s) => s.status === "picked_up" && !prevPickedIds.current.has(s.id)
        );
        newPicked.forEach((s) => {
          announceDismissal(s.name, s.class);
          setSuccessPopup(s);
          setTimeout(() => setSuccessPopup(null), 5000);
        });
      }
      initialLoad.current = false;

      prevPickedIds.current = new Set(classStudents.filter(s => s.status === "picked_up").map(s => s.id));

      setStudents(classStudents);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 10000);
    const channel = supabase
      .channel(`public-class-${decodedClass}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dismissal_logs" }, () => fetchData(true))
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [schoolId, decodedClass]);

  const handlePublicDismissal = async (student: StudentStatus) => {
    if (!schoolId) return;
    setProcessing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-dismissal`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          school_id: schoolId,
          student_id: student.id,
          dismissed_by: `Wali Murid (Publik)`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal memproses kepulangan");
      } else {
        toast.success(`${student.name} berhasil ditandai pulang!`);
        announceDismissal(student.name, student.class);
        setSuccessPopup(student);
        setTimeout(() => setSuccessPopup(null), 5000);
        fetchData(true);
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setProcessing(false);
      setConfirmStudent(null);
    }
  };

  const picked = students.filter((s) => s.status === "picked_up");
  const waiting = students.filter((s) => s.status === "waiting");
  const percentage = students.length ? Math.round((picked.length / students.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <p className="text-muted-foreground font-medium">Memuat data kelas {decodedClass}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-elevated">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{schoolName} — Kelas {decodedClass}</h1>
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <LiveDot />
                  <span>Monitoring Kepulangan Realtime</span>
                  <Volume2 className="h-3 w-3 ml-1" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => fetchData(true)}
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <div className="text-right text-xs opacity-70 hidden sm:block">
                <p>Update terakhir</p>
                <p className="font-mono font-bold">
                  {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, value: students.length, label: "Total", color: "text-primary", bg: "bg-primary/10" },
            { icon: UserCheck, value: picked.length, label: "Sudah Pulang", color: "text-success", bg: "bg-success/10" },
            { icon: UserX, value: waiting.length, label: "Menunggu", color: "text-destructive", bg: "bg-destructive/10" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-0 shadow-card">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className={`text-xl sm:text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Progress */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Progress Kelas {decodedClass}</span>
              </div>
              <span className="text-lg font-extrabold text-primary">{percentage}%</span>
            </div>
            <div className="h-4 rounded-full bg-secondary overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-success"
                initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
            </div>
          </CardContent>
        </Card>

        {/* Student list */}
        <div className="space-y-4">
          {/* Waiting */}
          {waiting.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                <h2 className="font-bold text-foreground">Belum Pulang ({waiting.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {waiting.map((s, i) => (
                    <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.02 }}>
                      <Card className="border border-destructive/20 bg-destructive/5 shadow-sm">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                            {s.photo_url ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" /> : s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground">NIS: {s.student_id}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setConfirmStudent(s)}
                            className="shrink-0 text-xs h-8 px-3 bg-success hover:bg-success/90 text-success-foreground"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Pulang
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Picked up */}
          {picked.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success" />
                <h2 className="font-bold text-foreground">Sudah Pulang ({picked.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {picked.map((s, i) => (
                    <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.02 }}>
                      <Card className="border border-success/20 bg-success/5 shadow-sm">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-success/15 text-success flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                            {s.photo_url ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" /> : s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground">NIS: {s.student_id}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                              <UserCheck className="h-3 w-3 mr-1" /> Pulang
                            </Badge>
                            {s.dismissal_time && (
                              <div className="flex items-center gap-1 text-muted-foreground mt-1 justify-end">
                                <Clock className="h-3 w-3" />
                                <span className="text-[10px]">
                                  {new Date(s.dismissal_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {students.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Tidak ada siswa di kelas ini</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <LiveDot />
            <span>ATSkolla Attendance System • Data kelas {decodedClass} diperbarui otomatis</span>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmStudent} onOpenChange={() => setConfirmStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Kepulangan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menandai <strong>{confirmStudent?.name}</strong> (Kelas {confirmStudent?.class}) sebagai sudah pulang?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              onClick={() => confirmStudent && handlePublicDismissal(confirmStudent)}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              {processing ? "Memproses..." : "Ya, Konfirmasi Pulang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Popup */}
      <Dialog open={!!successPopup} onOpenChange={(open) => !open && setSuccessPopup(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Siswa Berhasil Pulang</DialogTitle>
          </DialogHeader>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Berhasil Pulang!</h2>
              <p className="text-lg font-semibold text-primary">{successPopup?.name}</p>
              <p className="text-sm text-muted-foreground">Kelas {successPopup?.class} • NIS: {successPopup?.student_id}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <Button onClick={() => setSuccessPopup(null)} variant="outline" className="mt-2">
              Tutup
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicClassMonitoring;
