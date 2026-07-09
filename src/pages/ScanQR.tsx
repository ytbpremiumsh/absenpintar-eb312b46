import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, CheckCircle2, Camera, Search, ShieldCheck, X, Clock, UserCheck, Loader2, Lock, SwitchCamera, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Nfc } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { useNfcScanner } from "@/hooks/useNfcScanner";
import { useIsMobile } from "@/hooks/use-mobile";

import { toast } from "sonner";
import jsQR from "jsqr";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fetchSchoolHolidayStatus } from "@/lib/schoolHoliday";

interface FoundStudent {
  id: string;
  name: string;
  class: string;
  student_id: string;
  parent_name: string;
  parent_phone: string;
  photo_url: string | null;
  __isTeacher?: boolean;
  __teacherUserId?: string;
}

// Auto-confirm dialog with 3s countdown
const ConfirmationPopup = ({ open, scannedStudent, alreadyRecorded, processing, currentAttType, scanMethod, onConfirm, onCancel }: {
  open: boolean; scannedStudent: FoundStudent | null; alreadyRecorded: boolean; processing: boolean;
  currentAttType: string; scanMethod: string; onConfirm: () => void; onCancel: () => void;
}) => {
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && !alreadyRecorded && scannedStudent) {
      setCountdown(3);
      timerRef.current = window.setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [open, alreadyRecorded, scannedStudent]);

  useEffect(() => {
    if (countdown === 0 && open && !alreadyRecorded && !processing) {
      onConfirm();
    }
  }, [countdown, open, alreadyRecorded, processing, onConfirm]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-[90vw] sm:max-w-md p-0 overflow-hidden">
        <div className="gradient-primary p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
            <DialogTitle className="text-base font-bold text-primary-foreground">Verifikasi Absensi</DialogTitle>
          </div>
          <DialogDescription className="text-primary-foreground/70 text-xs mt-1">
            {scanMethod === "face" ? "Wajah dikenali — konfirmasi kehadiran" : "Konfirmasi kehadiran siswa berikut"}
          </DialogDescription>
          <Badge className="mt-2 bg-white/20 text-white border-0 inline-flex items-center gap-1">
            Mode: {currentAttType === "datang" ? <><ArrowDownToLine className="h-3 w-3" /> Datang</> : <><ArrowUpFromLine className="h-3 w-3" /> Pulang</>}
          </Badge>
        </div>
        {scannedStudent && (
          <div className="p-5 text-center space-y-4">
            {scannedStudent.photo_url ? (
              <img src={scannedStudent.photo_url} alt={scannedStudent.name}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover mx-auto shadow-lg border-4 border-primary/20" />
            ) : (
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl sm:text-3xl font-bold mx-auto shadow-lg">
                {scannedStudent.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground">{scannedStudent.name}</h3>
              {scannedStudent.__isTeacher ? (
                <p className="text-sm text-muted-foreground">Peran: {scannedStudent.class}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Kelas: {scannedStudent.class}</p>
                  <p className="text-sm text-muted-foreground">NIS: {scannedStudent.student_id}</p>
                </>
              )}
              {scanMethod === "face" && (
                <span className="inline-flex items-center gap-1 text-xs text-success font-medium mt-1">
                  <UserCheck className="h-3 w-3" /> Dikenali via Face Recognition
                </span>
              )}
            </div>

            {alreadyRecorded ? (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-2 text-xs text-warning font-medium inline-flex items-center gap-1.5 justify-center">
                <AlertTriangle className="h-3.5 w-3.5" /> Siswa ini sudah tercatat absensi {currentAttType === "datang" ? "Datang" : "Pulang"} hari ini
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Otomatis konfirmasi dalam <strong className="text-foreground">{countdown}</strong> detik</span>
                </div>
                <Progress value={((3 - countdown) / 3) * 100} className="h-1.5" />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onCancel} className="flex-1 h-11">Batal</Button>
              <Button onClick={onConfirm} disabled={processing || alreadyRecorded}
                className="flex-1 h-11 bg-success hover:bg-success/90 text-success-foreground font-semibold">
                <CheckCircle2 className="h-4 w-4 mr-1" /> {currentAttType === "datang" ? "Hadir" : "Pulang"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ScanQR = () => {
  const { profile } = useAuth();
  const features = useSubscriptionFeatures();
  const [manualCode, setManualCode] = useState("");
  const [scannedStudent, setScannedStudent] = useState<FoundStudent | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [scanMethod, setScanMethod] = useState<"barcode" | "face" | "rfid">("barcode");
  const [faceScanning, setFaceScanning] = useState(false);
  const [currentAttType, setCurrentAttType] = useState<"datang" | "pulang">("datang");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const faceIntervalRef = useRef<number | null>(null);
  const isLookingUp = useRef(false);
  const scanPaused = useRef(false);

  const canFace = !features.loading && features.canFaceRecognition;
  const isMobile = useIsMobile();

  const [holidayBlock, setHolidayBlock] = useState<{ isHoliday: boolean; reason: string | null }>({ isHoliday: false, reason: null });
  const nfc = useNfcScanner((uid) => {
    if (scanPaused.current) return;
    setScanMethod("rfid");
    lookupStudent(uid);
  });

  // Load holiday status
  useEffect(() => {
    if (!profile?.school_id) return;
    fetchSchoolHolidayStatus(profile.school_id).then(setHolidayBlock);
  }, [profile?.school_id]);

  const ensureNotHoliday = useCallback(async (): Promise<boolean> => {
    if (!profile?.school_id) return true;
    const status = await fetchSchoolHolidayStatus(profile.school_id);
    setHolidayBlock(status);
    if (status.isHoliday) {
      toast.error(`Absensi ditangguhkan: ${status.reason}`);
      return false;
    }
    return true;
  }, [profile?.school_id]);

  // Determine attendance type based on time
  const getAttendanceType = useCallback(async (): Promise<"datang" | "pulang"> => {
    if (!profile?.school_id) return "datang";
    const { data: settings } = await supabase.from("dismissal_settings")
      .select("attendance_start_time, attendance_end_time, departure_start_time, departure_end_time")
      .eq("school_id", profile.school_id).maybeSingle();

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);
    const attStart = (settings as any)?.attendance_start_time || "06:00:00";
    const attEnd = (settings as any)?.attendance_end_time || "12:00:00";
    const depStart = (settings as any)?.departure_start_time || "12:00:00";
    const depEnd = (settings as any)?.departure_end_time || "17:00:00";

    if (currentTime >= attStart && currentTime < attEnd) return "datang";
    if (currentTime >= depStart && currentTime <= depEnd) return "pulang";
    if (currentTime < attStart) return "datang";
    return "pulang";
  }, [profile?.school_id]);

  const lookupStudent = useCallback(async (code: string) => {
    if (!code.trim() || !profile?.school_id || isLookingUp.current || scanPaused.current) return;
    isLookingUp.current = true;
    try {
      if (!(await ensureNotHoliday())) { scanPaused.current = true; return; }
      const trimmed = code.trim();
      const { data, error } = await supabase
        .from("students").select("*").eq("school_id", profile.school_id)
        .or(`student_id.eq.${trimmed},qr_code.eq.${trimmed},rfid_uid.eq.${trimmed},card_number.eq.${trimmed}`).maybeSingle();

      if (!error && data) {
        const attType = await getAttendanceType();
        setCurrentAttType(attType);
        const today = new Date().toISOString().slice(0, 10);
        const { data: existing } = await supabase.from("attendance_logs")
          .select("id").eq("student_id", data.id).eq("date", today).eq("attendance_type", attType).maybeSingle();
        setAlreadyRecorded(!!existing);
        setScannedStudent(data);
        setConfirmed(false);
        setScanMethod("barcode");
        scanPaused.current = true;
        return;
      }

      // Try teacher/staff lookup (qr_code = user_id)
      const { data: teacherProfile } = await (supabase
        .from("profiles") as any)
        .select("user_id, full_name, photo_url, qr_code, rfid_uid")
        .eq("school_id", profile.school_id)
        .or(`user_id.eq.${trimmed},qr_code.eq.${trimmed},rfid_uid.eq.${trimmed}`).maybeSingle();

      if (teacherProfile) {
        // Verify role is teacher/staff/bendahara
        const { data: rolesData } = await supabase
          .from("user_roles").select("role").eq("user_id", teacherProfile.user_id);
        const validRoles = (rolesData || []).map((r: any) => r.role);
        if (!validRoles.some((r: string) => ["teacher", "staff", "bendahara", "school_admin"].includes(r))) {
          toast.error("Kode tidak valid: " + trimmed);
          return;
        }
        const attType = await getAttendanceType();
        setCurrentAttType(attType);
        const today = new Date().toISOString().slice(0, 10);
        const { data: existing } = await supabase.from("teacher_attendance_logs" as any)
          .select("id").eq("user_id", teacherProfile.user_id).eq("date", today).eq("attendance_type", attType).maybeSingle();
        setAlreadyRecorded(!!existing);
        setScannedStudent({
          id: teacherProfile.user_id,
          name: teacherProfile.full_name,
          class: validRoles.includes("teacher") ? "Guru" : validRoles.includes("bendahara") ? "Bendahara" : "Staff",
          student_id: "—",
          parent_name: "",
          parent_phone: "",
          photo_url: teacherProfile.photo_url,
          __isTeacher: true,
          __teacherUserId: teacherProfile.user_id,
        });
        setConfirmed(false);
        setScanMethod("barcode");
        scanPaused.current = true;
        return;
      }

      toast.error("Tidak ditemukan untuk kode: " + trimmed);
    } finally { isLookingUp.current = false; }
  }, [profile?.school_id, getAttendanceType, ensureNotHoliday]);

  // Barcode scanning interval
  const startBarcodeScanning = useCallback(() => {
    if (scanIntervalRef.current) return;
    scanIntervalRef.current = window.setInterval(() => {
      if (scanPaused.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (qrCode?.data) lookupStudent(qrCode.data);
    }, 300);
  }, [lookupStudent]);

  // Face recognition capture
  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || !profile?.school_id || scanPaused.current) return;
    if (!(await ensureNotHoliday())) { scanPaused.current = true; return; }
    setFaceScanning(true);
    try {
      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-recognition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ captured_image: dataUrl, school_id: profile.school_id }),
      });

      const data = await res.json();
      if (!res.ok) { console.log("Face scan:", data.error); return; }

      if (data.match) {
        scanPaused.current = true;
        const attType = await getAttendanceType();
        setCurrentAttType(attType);
        const today = new Date().toISOString().slice(0, 10);

        if (data.type === "teacher" && data.teacher) {
          const { data: existing } = await supabase.from("teacher_attendance_logs" as any)
            .select("id").eq("user_id", data.teacher.user_id).eq("date", today).eq("attendance_type", attType).maybeSingle();
          setAlreadyRecorded(!!existing);
          setScannedStudent({
            id: data.teacher.user_id,
            name: data.teacher.full_name,
            class: "Guru / Staff",
            student_id: "—",
            parent_name: "",
            parent_phone: "",
            photo_url: data.teacher.photo_url,
            __isTeacher: true,
            __teacherUserId: data.teacher.user_id,
          });
          setConfirmed(false);
          setScanMethod("face");
          toast.success(`Wajah dikenali: ${data.teacher.full_name}`);
        } else if (data.student) {
          const { data: existing } = await supabase.from("attendance_logs")
            .select("id").eq("student_id", data.student.id).eq("date", today).eq("attendance_type", attType).maybeSingle();
          setAlreadyRecorded(!!existing);
          setScannedStudent(data.student);
          setConfirmed(false);
          setScanMethod("face");
          toast.success(`Wajah dikenali: ${data.student.name}`);
        }
      }
    } catch (err: any) {
      console.log("Face recognition error:", err.message);
    } finally {
      setFaceScanning(false);
    }
  }, [profile?.school_id, getAttendanceType, ensureNotHoliday]);

  const faceTimeoutRef = useRef<number | null>(null);

  const startFaceScanning = useCallback(() => {
    if (faceIntervalRef.current) return;
    faceTimeoutRef.current = window.setTimeout(() => captureAndRecognize(), 2000);
    faceIntervalRef.current = window.setInterval(() => {
      if (!scanPaused.current) captureAndRecognize();
    }, 4000);
  }, [captureAndRecognize]);

  const stopFaceScanning = useCallback(() => {
    if (faceTimeoutRef.current) { clearTimeout(faceTimeoutRef.current); faceTimeoutRef.current = null; }
    if (faceIntervalRef.current) { clearInterval(faceIntervalRef.current); faceIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const startPipelines = () => {
      startBarcodeScanning();
      if (canFace) startFaceScanning();
      else stopFaceScanning();
    };
    video.srcObject = streamRef.current;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.play().then(startPipelines).catch(err => console.error("Video play error:", err));
    } else {
      video.onloadedmetadata = () => {
        video.play().then(startPipelines).catch(err => console.error("Video play error:", err));
      };
    }
    return () => { video.onloadedmetadata = null; stopFaceScanning(); };
  }, [cameraActive, startBarcodeScanning, startFaceScanning, stopFaceScanning, canFace]);

  const startCamera = async (preferredFacing?: "user" | "environment") => {
    setCameraError("");
    const facing = preferredFacing || facingMode;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } });
      } catch {
        const fallback = facing === "user" ? "environment" : "user";
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fallback, width: { ideal: 640 }, height: { ideal: 480 } } });
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err: any) {
      if (err.name === "NotAllowedError") setCameraError("Izin kamera ditolak. Berikan izin kamera di pengaturan browser.");
      else setCameraError("Gagal mengakses kamera: " + (err.message || "Unknown error"));
    }
  };

  const switchCamera = () => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    stopCamera();
    setTimeout(() => startCamera(newFacing), 300);
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    stopFaceScanning();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    scanPaused.current = false;
  };

  useEffect(() => { return () => { stopCamera(); }; }, []);

  const handleSearch = () => { scanPaused.current = false; lookupStudent(manualCode); };

  const handleConfirm = async () => {
    if (!scannedStudent || !profile?.school_id) return;
    setProcessing(true);

    const now = new Date();
    const method = scanMethod === "face" ? "face_recognition" : scanMethod === "rfid" ? "rfid" : "barcode";

    if (scannedStudent.__isTeacher && scannedStudent.__teacherUserId) {
      const { error } = await supabase.from("teacher_attendance_logs" as any).insert({
        school_id: profile.school_id,
        user_id: scannedStudent.__teacherUserId,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        method,
        status: "hadir",
        recorded_by: profile.full_name || "Petugas",
        attendance_type: currentAttType,
      });
      setProcessing(false);
      if (error) { toast.error("Gagal mencatat absensi guru: " + error.message); return; }
      setConfirmed(true);
      setTimeout(() => {
        setScannedStudent(null);
        setConfirmed(false);
        setManualCode("");
        setAlreadyRecorded(false);
        scanPaused.current = false;
        setScanMethod("barcode");
      }, 1000);
      return;
    }

    const { error } = await supabase.from("attendance_logs").insert({
      school_id: profile.school_id,
      student_id: scannedStudent.id,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
      method,
      status: "hadir",
      recorded_by: profile.full_name || "Petugas",
      attendance_type: currentAttType,
    });

    setProcessing(false);
    if (error) { toast.error("Gagal mencatat absensi: " + error.message); return; }
    setConfirmed(true);
    const _typeLabel = currentAttType === "datang" ? "Datang" : "Pulang";
    // Success visual feedback is handled by the confirmed state UI, no toast needed

    // Send WA notification based on school delivery settings
    try {
      const [integrationRes, schoolRes, classRes] = await Promise.all([
        supabase
          .from("school_integrations")
          .select("attendance_arrive_template, attendance_depart_template, attendance_group_template, wa_delivery_target, wa_enabled, is_active")
          .eq("school_id", profile.school_id)
          .eq("integration_type", "onesender")
          .maybeSingle(),
        supabase.from("schools").select("name").eq("id", profile.school_id).single(),
        supabase.from("classes").select("wa_group_id").eq("school_id", profile.school_id).eq("name", scannedStudent.class).maybeSingle(),
      ]);

      const integration = integrationRes.data as any;
      if (integration && integration.wa_enabled !== false) {
        const schoolName = schoolRes.data?.name || "";
        const groupId = classRes.data?.wa_group_id || null;
        const deliveryTarget = integration.wa_delivery_target || "parent_only";
        const methodLabel = method === "face_recognition" ? "Face Recognition" : "Barcode Scan";
        const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const dayName = dayNames[now.getDay()];
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const dateStr = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        const typeLabel = currentAttType === "datang" ? "Datang (Hadir)" : "Pulang";

        const applyReplacements = (tpl: string) =>
          tpl
            .replace(/\{student_name\}/g, scannedStudent.name)
            .replace(/\{class\}/g, scannedStudent.class)
            .replace(/\{time\}/g, timeStr)
            .replace(/\{day\}/g, dayName)
            .replace(/\{student_id\}/g, scannedStudent.student_id)
            .replace(/\{method\}/g, methodLabel)
            .replace(/\{parent_name\}/g, scannedStudent.parent_name || "")
            .replace(/\{school_name\}/g, schoolName)
            .replace(/\{type\}/g, typeLabel)
            .replace(/\{date\}/g, dateStr);

        const sendTasks: Promise<any>[] = [];

        if ((deliveryTarget === "parent_only" || deliveryTarget === "both") && scannedStudent.parent_phone) {
          const parentTemplate = currentAttType === "datang"
            ? (integration.attendance_arrive_template || "")
            : (integration.attendance_depart_template || "");
          const parentMessage = parentTemplate
            ? applyReplacements(parentTemplate)
            : `📋 *Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nAnanda *${scannedStudent.name}* (Kelas ${scannedStudent.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${timeStr}.\n\nMetode: ${methodLabel}\n\n─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;

          sendTasks.push(
            supabase.functions.invoke("send-whatsapp", {
              body: {
                school_id: profile.school_id,
                phone: scannedStudent.parent_phone,
                message: parentMessage,
                message_type: "attendance",
                student_name: scannedStudent.name,
              },
            })
          );
        }

        if ((deliveryTarget === "group_only" || deliveryTarget === "both") && groupId) {
          const groupTemplate = integration.attendance_group_template || "";
          const groupMessage = groupTemplate
            ? applyReplacements(groupTemplate)
            : `📋 *Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nSiswa *${scannedStudent.name}* (Kelas ${scannedStudent.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${timeStr}.\n\nMetode: ${methodLabel}\n\n─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;

          sendTasks.push(
            supabase.functions.invoke("send-whatsapp", {
              body: {
                school_id: profile.school_id,
                group_id: groupId,
                message: groupMessage,
                message_type: "attendance_group",
                student_name: scannedStudent.name,
              },
            })
          );
        }

        if (sendTasks.length > 0) {
          await Promise.allSettled(sendTasks);
        }
      }
    } catch {
      // Don't fail attendance if WA fails
    }

    setTimeout(() => {
      setScannedStudent(null);
      setConfirmed(false);
      setManualCode("");
      setAlreadyRecorded(false);
      scanPaused.current = false;
      setScanMethod("barcode");
    }, 1000);
  };

  const handleCloseSuccess = () => {
    setScannedStudent(null);
    setConfirmed(false);
    setManualCode("");
    setAlreadyRecorded(false);
    scanPaused.current = false;
    setScanMethod("barcode");
  };

  const handleCancel = () => {
    setScannedStudent(null);
    setConfirmed(false);
    setManualCode("");
    setAlreadyRecorded(false);
    scanPaused.current = false;
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto px-1">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] p-5 text-white shadow-xl">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ScanLine className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Scan Absensi</h1>
              <p className="text-white/70 text-xs">Deteksi barcode & wajah otomatis</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm font-semibold">
                {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
              <span className="text-xs">
                {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {holidayBlock.isHoliday && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Absensi Ditangguhkan</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{holidayBlock.reason}</p>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Scanner Card - Premium */}
      <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          {cameraActive ? (
            <>
              <div className="relative bg-black" style={{ minHeight: 320 }}>
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted
                  style={{ minHeight: 320, WebkitTransform: "scaleX(1)" }} />
                
                {/* Scanner Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      {/* Top-left */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#5B6CF9] rounded-tl-lg" />
                      {/* Top-right */}
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#5B6CF9] rounded-tr-lg" />
                      {/* Bottom-left */}
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#5B6CF9] rounded-bl-lg" />
                      {/* Bottom-right */}
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#5B6CF9] rounded-br-lg" />
                      {/* Animated scan line */}
                      {!scanPaused.current && (
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#5B6CF9] to-transparent animate-pulse top-1/2" />
                      )}
                    </div>
                  </div>
                  
                  {/* Dark overlay outside scan area */}
                  <div className="absolute inset-0 bg-black/30" style={{
                    maskImage: "radial-gradient(ellipse 120px 120px at center, transparent 80%, black 100%)",
                    WebkitMaskImage: "radial-gradient(ellipse 120px 120px at center, transparent 80%, black 100%)"
                  }} />
                </div>

                {/* Status badge top */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    {faceScanning ? (
                      <><Loader2 className="h-3 w-3 animate-spin text-[#5B6CF9]" /><span className="text-[11px] text-white font-medium">Mengenali wajah...</span></>
                    ) : scanPaused.current ? (
                      <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-[11px] text-white font-medium">Terdeteksi!</span></>
                    ) : (
                      <><div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[11px] text-white/80">Memindai...</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <ScanLine className="h-3 w-3 text-white/70" />
                    {canFace && <UserCheck className="h-3 w-3 text-white/70 ml-0.5" />}
                    <Nfc className="h-3 w-3 text-white/70 ml-0.5" />
                  </div>
                </div>

                {/* Bottom status bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-white/80">
                      <ScanLine className="h-3.5 w-3.5" /> Barcode
                      {canFace ? (
                        <><span className="text-white/40">•</span><UserCheck className="h-3.5 w-3.5" /> Face</>
                      ) : (
                        <><span className="text-white/40">•</span><Lock className="h-3 w-3 opacity-50" /><span className="opacity-50">Face</span><span className="text-[9px] text-amber-400 font-bold ml-1">PREMIUM</span></>
                      )}
                      <span className="text-white/40">•</span><Nfc className="h-3.5 w-3.5" /> RFID
                    </div>
                  </div>
                </div>
              </div>

              {/* Camera controls */}
              <div className="p-3 flex items-center justify-between bg-card border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={switchCamera} className="h-9 rounded-xl gap-1.5 text-xs border-border/50">
                    <SwitchCamera className="h-3.5 w-3.5" /> {facingMode === "user" ? "Belakang" : "Depan"}
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={stopCamera} className="h-9 rounded-xl gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                  <X className="h-3.5 w-3.5" /> Tutup Kamera
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-b from-muted/30 to-background" style={{ minHeight: 280 }}>
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#4c5ded] flex items-center justify-center shadow-lg shadow-[#5B6CF9]/25">
                  <Camera className="h-9 w-9 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
                  <ScanLine className="h-3 w-3 text-white" />
                </div>
              </div>
              {cameraError && <p className="text-destructive text-xs text-center px-4 max-w-xs">{cameraError}</p>}
              <Button onClick={() => startCamera()} className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] hover:opacity-90 text-white font-semibold shadow-lg shadow-[#5B6CF9]/25 gap-2">
                <Camera className="h-4 w-4" /> Aktifkan Kamera
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 bg-muted/50 px-2.5 py-1 rounded-lg">
                  <ScanLine className="h-3.5 w-3.5 text-[#5B6CF9]" /> Barcode
                </div>
                {canFace ? (
                  <div className="flex items-center gap-1 bg-muted/50 px-2.5 py-1 rounded-lg">
                    <UserCheck className="h-3.5 w-3.5 text-[#5B6CF9]" /> Face Recognition
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-muted/50 px-2.5 py-1 rounded-lg opacity-60">
                    <Lock className="h-3 w-3" /> Face <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold ml-1">PREMIUM</span>
                  </div>
                )}
                <div className="flex items-center gap-1 bg-muted/50 px-2.5 py-1 rounded-lg">
                  <Nfc className="h-3.5 w-3.5 text-[#5B6CF9]" /> RFID
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/60">Atau gunakan input NIS manual di bawah</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual NIS input - Premium */}
      <Card className="border-0 shadow-lg rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-[#5B6CF9]" />
            </div>
            <p className="text-sm font-semibold text-foreground">Input NIS / Scan RFID</p>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Masukkan NIS (cth: NIS-001)" value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="h-11 text-sm rounded-xl border-border/50" />
            <Button onClick={handleSearch} className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] hover:opacity-90 text-white">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {isMobile && <div className="pt-2 border-t border-border/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center">
                <Nfc className="h-3.5 w-3.5 text-[#5B6CF9]" />
              </div>
              <p className="text-sm font-semibold text-foreground flex-1">Scan Kartu RFID via NFC HP</p>
              {nfc.scanning && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Aktif</Badge>}
            </div>
            <Button
              onClick={nfc.scanning ? nfc.stop : nfc.start}
              disabled={!nfc.supported}
              variant={nfc.scanning ? "destructive" : "outline"}
              className="w-full h-11 rounded-xl gap-2"
            >
              {nfc.scanning ? (<><X className="h-4 w-4" /> Hentikan NFC</>) : (<><Nfc className="h-4 w-4" /> {nfc.supported ? "Aktifkan Scan NFC" : "NFC tidak didukung (pakai Chrome Android)"}</>)}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Tempelkan kartu RFID ke bagian belakang HP. iPhone belum mendukung Web NFC.
            </p>
          </div>}

        </CardContent>
      </Card>

      {!scannedStudent && !cameraActive && (
        <div className="text-center py-8">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <ScanLine className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-xs text-muted-foreground/60">Arahkan kamera ke barcode / wajah atau masukkan NIS manual</p>
        </div>
      )}

      {/* POPUP DIALOG for confirmation - auto-confirm after 3s if valid */}
      <ConfirmationPopup
        open={!!scannedStudent && !confirmed}
        scannedStudent={scannedStudent}
        alreadyRecorded={alreadyRecorded}
        processing={processing}
        currentAttType={currentAttType}
        scanMethod={scanMethod}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Success Dialog */}
      <Dialog open={confirmed && !!scannedStudent} onOpenChange={(o) => { if (!o) handleCloseSuccess(); }}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm border-0 bg-success p-0">
          <div className="p-6 sm:p-8 text-center space-y-3">
            <CheckCircle2 className="h-14 w-14 sm:h-16 sm:w-16 text-success-foreground mx-auto" />
            <DialogTitle className="text-lg sm:text-xl font-bold text-success-foreground">Absensi Berhasil</DialogTitle>
            <DialogDescription className="text-success-foreground/90 space-y-0.5 text-sm">
              <p><strong>{scannedStudent?.name}</strong></p>
              <p>Kelas: {scannedStudent?.class} • {currentAttType === "datang" ? "Datang - Hadir" : "Pulang"}</p>
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import { PackageFeatureBlock } from "@/components/PackageFeatureBlock";
const ScanQRGuarded = () => (
  <PackageFeatureBlock feature="scan_qr" label="Scan Absensi">
    <ScanQR />
  </PackageFeatureBlock>
);
export default ScanQRGuarded;
