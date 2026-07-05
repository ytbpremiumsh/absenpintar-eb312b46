import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Camera, X, Search, ScanLine, UserCheck, CheckCircle2,
  Loader2, AlertTriangle, CreditCard, LogIn, LogOut, Lock,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ScannedStudent {
  id: string;
  name: string;
  class: string;
  student_id: string;
  photo_url: string | null;
}

interface PublicAttendanceScannerProps {
  schoolId: string;
  onAttendanceRecorded?: () => void;
  currentMode?: string;
  canFaceRecognition?: boolean;
}

const PublicAttendanceScanner = ({ schoolId, onAttendanceRecorded, currentMode = "datang", canFaceRecognition = false }: PublicAttendanceScannerProps) => {
  const [manualCode, setManualCode] = useState("");
  const [scannedStudent, setScannedStudent] = useState<ScannedStudent | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [scanMethod, setScanMethod] = useState<string>("barcode");
  const [faceScanning, setFaceScanning] = useState(false);
  const [attendanceType, setAttendanceType] = useState<string>("datang");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const faceIntervalRef = useRef<number | null>(null);
  const isLookingUp = useRef(false);
  const scanPaused = useRef(false);
  const mounted = useRef(true);

  // RFID keyboard emulation buffer
  const rfidBuffer = useRef("");
  const rfidTimeout = useRef<number | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // RFID listener: most RFID readers emulate keyboard and type card number + Enter rapidly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Enter" && rfidBuffer.current.length >= 4) {
        const code = rfidBuffer.current.trim();
        rfidBuffer.current = "";
        if (rfidTimeout.current) clearTimeout(rfidTimeout.current);
        lookupAndRecord(code, "rfid");
        return;
      }

      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        rfidBuffer.current += e.key;
        if (rfidTimeout.current) clearTimeout(rfidTimeout.current);
        rfidTimeout.current = window.setTimeout(() => {
          rfidBuffer.current = "";
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lookup student via public edge function - directly records attendance
  const lookupAndRecord = useCallback(async (code: string, method: string = "barcode", studentId?: string) => {
    if (isLookingUp.current) return;
    if (!code && !studentId) return;
    isLookingUp.current = true;
    scanPaused.current = true;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-scan-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({
          school_id: schoolId,
          ...(studentId ? { student_id: studentId } : { student_code: code }),
          method,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setAlreadyRecorded(true);
        setScannedStudent(data.student);
        setScanMethod(method);
        setAttendanceType(data.attendance_type || "datang");
        setConfirmed(false);
        const typeLabel = (data.attendance_type || "datang") === "datang" ? "Datang" : "Pulang";
        toast.info(`${data.student.name} sudah tercatat absensi ${typeLabel} hari ini`);
        setTimeout(() => resetState(), 3000);
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Siswa tidak ditemukan");
        scanPaused.current = false;
        return;
      }

      // Success
      setAlreadyRecorded(false);
      setScannedStudent(data.student);
      setScanMethod(method);
      setAttendanceType(data.attendance_type || "datang");
      setConfirmed(true);
      const typeLabel = (data.attendance_type || "datang") === "datang" ? "Datang" : "Pulang";
      toast.success(`${data.student.name} - ${typeLabel}!`);
      onAttendanceRecorded?.();
      setTimeout(() => resetState(), 3000);
    } catch (err: any) {
      toast.error("Gagal menghubungi server");
      scanPaused.current = false;
    } finally {
      isLookingUp.current = false;
    }
  }, [schoolId, SUPABASE_URL, SUPABASE_KEY, onAttendanceRecorded]);

  // Barcode scanning
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
      if (qrCode?.data) lookupAndRecord(qrCode.data, "barcode");
    }, 300);
  }, [lookupAndRecord]);

  // Stable ref for the latest lookupAndRecord so intervals don't need to restart
  const lookupRef = useRef(lookupAndRecord);
  useEffect(() => { lookupRef.current = lookupAndRecord; }, [lookupAndRecord]);

  const faceBusy = useRef(false);

  // Face recognition - stable function that reads from refs
  const captureAndRecognize = useCallback(async () => {
    if (faceBusy.current || !videoRef.current || scanPaused.current || isLookingUp.current) return;
    const video = videoRef.current;
    if (video.readyState < video.HAVE_ENOUGH_DATA) return;

    faceBusy.current = true;
    setFaceScanning(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/face-recognition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ captured_image: dataUrl, school_id: schoolId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) return;

      if (data.match && data.student) {
        toast.success(`Wajah dikenali: ${data.student.name}`);
        await lookupRef.current("", "face_recognition", data.student.id);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.log("Face recognition error:", err.message);
    } finally {
      faceBusy.current = false;
      setFaceScanning(false);
    }
  }, [schoolId, SUPABASE_URL, SUPABASE_KEY]); // No lookupAndRecord dependency!

  const startFaceScanning = useCallback(() => {
    if (faceIntervalRef.current) return;
    // Initial delay then every 10s
    const initialTimeout = window.setTimeout(() => captureAndRecognize(), 4000);
    faceIntervalRef.current = window.setInterval(() => {
      if (!scanPaused.current) captureAndRecognize();
    }, 10000);
    // Store initial timeout id in interval ref won't work, use a cleanup approach
    return initialTimeout;
  }, [captureAndRecognize]);

  const stopFaceScanning = useCallback(() => {
    if (faceIntervalRef.current) { clearInterval(faceIntervalRef.current); faceIntervalRef.current = null; }
  }, []);

  // Camera pipeline setup - only runs when camera stream is acquired, stable deps
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;

    let initialFaceTimeout: number | undefined;

    const startPipelines = () => {
      startBarcodeScanning();
      if (canFaceRecognition) {
        initialFaceTimeout = startFaceScanning();
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.play().then(startPipelines).catch(console.error);
    } else {
      video.onloadedmetadata = () => {
        video.play().then(startPipelines).catch(console.error);
      };
    }

    return () => {
      video.onloadedmetadata = null;
      if (initialFaceTimeout) clearTimeout(initialFaceTimeout);
      stopFaceScanning();
    };
  }, [cameraActive, startBarcodeScanning, startFaceScanning, stopFaceScanning, canFaceRecognition]);

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
      if (err.name === "NotAllowedError") setCameraError("Izin kamera ditolak.");
      else setCameraError("Gagal mengakses kamera: " + (err.message || "Unknown"));
    }
  };

  const switchCamera = async () => {
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

  const resetState = () => {
    setScannedStudent(null);
    setConfirmed(false);
    setManualCode("");
    setAlreadyRecorded(false);
    scanPaused.current = false;
    setScanMethod("barcode");
    setAttendanceType("datang");
  };

  const handleSearch = () => {
    if (!manualCode.trim()) return;
    scanPaused.current = false;
    lookupAndRecord(manualCode.trim(), "barcode");
  };

  const modeLabel = currentMode === "pulang" ? "Pulang" : "Datang";
  const ModeIcon = currentMode === "pulang" ? LogOut : LogIn;

  const getMethodLabel = (m: string) => {
    if (m === "face_recognition") return "Face Recognition";
    if (m === "rfid") return "Kartu RFID";
    return "Barcode Scan";
  };

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />

      <Card className="border-0 shadow-card overflow-hidden sticky top-24">
        {/* Mode indicator */}
        <div className={`px-3 py-2 flex items-center justify-center gap-2 text-sm font-bold ${
          currentMode === "pulang" 
            ? "bg-warning/15 text-warning" 
            : "bg-success/15 text-success"
        }`}>
          <ModeIcon className="h-4 w-4" />
          <span>Mode Absensi: {modeLabel}</span>
        </div>

        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Scan Absensi</h3>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[8px] px-1.5 py-0">
              <ScanLine className="h-2.5 w-2.5 mr-0.5" />QR
            </Badge>
            {canFaceRecognition ? (
              <Badge variant="outline" className="text-[8px] px-1.5 py-0">
                <UserCheck className="h-2.5 w-2.5 mr-0.5" />Face
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 opacity-40">
                <Lock className="h-2.5 w-2.5 mr-0.5" />Face
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          {cameraActive ? (
            <>
              <div className="relative bg-black" style={{ minHeight: 320 }}>
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted
                  style={{ minHeight: 320, WebkitTransform: "scaleX(1)" }} />
                
                {/* Scanner Overlay - Premium viewfinder */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#5B6CF9] rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#5B6CF9] rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#5B6CF9] rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#5B6CF9] rounded-br-lg" />
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
                    {canFaceRecognition && <UserCheck className="h-3 w-3 text-white/70 ml-0.5" />}
                    
                  </div>
                </div>

                {/* Bottom status bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-white/80">
                      <ScanLine className="h-3.5 w-3.5" /> Barcode
                      {canFaceRecognition ? (
                        <><span className="text-white/40">•</span><UserCheck className="h-3.5 w-3.5" /> Face</>
                      ) : (
                        <><span className="text-white/40">•</span><Lock className="h-3 w-3 opacity-50" /><span className="opacity-50">Face</span><span className="text-[9px] text-amber-400 font-bold ml-1">PREMIUM</span></>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Camera controls */}
              <div className="p-3 flex items-center justify-between bg-card border-t border-border/50">
                <Button variant="outline" size="sm" onClick={switchCamera} className="h-9 rounded-xl gap-1.5 text-xs border-border/50">
                  <SwitchCamera className="h-3.5 w-3.5" /> {facingMode === "user" ? "Belakang" : "Depan"}
                </Button>
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
                {canFaceRecognition ? (
                  <div className="flex items-center gap-1 bg-muted/50 px-2.5 py-1 rounded-lg">
                    <UserCheck className="h-3.5 w-3.5 text-[#5B6CF9]" /> Face
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-muted/50 px-2.5 py-1 rounded-lg opacity-60">
                    <Lock className="h-3 w-3" /> Face <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold ml-1">PREMIUM</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/60">Atau gunakan input NIS manual di bawah</p>
            </div>
          )}

        </CardContent>

        {/* Manual NIS input - Premium style */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-[#5B6CF9]/10 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-[#5B6CF9]" />
            </div>
            <p className="text-sm font-semibold text-foreground">Input NIS Manual</p>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Masukkan NIS (cth: NIS-001)" value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="h-11 text-sm rounded-xl border-border/50" />
            <Button onClick={handleSearch} className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] hover:opacity-90 text-white">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Already recorded popup */}
      <Dialog open={alreadyRecorded && !!scannedStudent} onOpenChange={(open) => { if (!open) resetState(); }}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm p-0 overflow-hidden">
          <div className="bg-warning/10 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-warning">Sudah Tercatat</DialogTitle>
            </div>
            <DialogDescription className="text-warning/70 text-xs mt-1">
              Absensi {attendanceType === "pulang" ? "Pulang" : "Datang"} sudah tercatat hari ini
            </DialogDescription>
          </div>
          {scannedStudent && (
            <div className="p-5 text-center space-y-3">
              {scannedStudent.photo_url ? (
                <img src={scannedStudent.photo_url} alt={scannedStudent.name}
                  className="h-20 w-20 rounded-full object-cover mx-auto shadow-lg border-4 border-warning/20" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-warning/20 flex items-center justify-center text-warning text-2xl font-bold mx-auto">
                  {scannedStudent.name.charAt(0)}
                </div>
              )}
              <h3 className="text-lg font-bold text-foreground">{scannedStudent.name}</h3>
              <p className="text-sm text-muted-foreground">Kelas: {scannedStudent.class} • NIS: {scannedStudent.student_id}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success popup */}
      <Dialog open={confirmed && !!scannedStudent} onOpenChange={(open) => { if (!open) resetState(); }}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm border-0 bg-success p-0">
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="h-14 w-14 text-success-foreground mx-auto" />
            <DialogTitle className="text-lg font-bold text-success-foreground">
              Absensi {attendanceType === "pulang" ? "Pulang" : "Datang"} Berhasil
            </DialogTitle>
            <DialogDescription className="text-success-foreground/90 text-sm">
              <p><strong>{scannedStudent?.name}</strong></p>
              <p>Kelas: {scannedStudent?.class} • Status: {attendanceType === "pulang" ? "Pulang" : "Hadir"}</p>
              <p className="text-xs mt-1">via {getMethodLabel(scanMethod)}</p>
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PublicAttendanceScanner;
