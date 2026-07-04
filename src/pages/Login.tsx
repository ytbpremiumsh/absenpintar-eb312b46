import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, Shield, QrCode, Scan, ArrowLeft,
  Phone, MessageSquare, Sparkles, Users, Calendar, ScanFace, Wallet, BarChart3, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import BackendStatusBanner, { isBackendNetworkError } from "@/components/BackendStatusBanner";
import { useTenant } from "@/lib/tenant";

type Mode = "school" | "parent";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("as") === "parent" ? "parent" : "school");
  const tenant = useTenant();
  const tenantLogo = tenant.school?.logo || null;
  const tenantName = tenant.school?.name || null;

  // school
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("remembered_email"));
  const [loading, setLoading] = useState(false);
  const [loginLogo, setLoginLogo] = useState("/images/logo-atskolla.png");
  const [networkIssue, setNetworkIssue] = useState(false);
  const [recheckKey, setRecheckKey] = useState(0);

  // parent
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [parentMethod, setParentMethod] = useState<"phone" | "card">("phone");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["login_logo_url"])
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map((d) => [d.key, d.value]));
          if (map.login_logo_url) setLoginLogo(map.login_logo_url);
        }
      });
    if (localStorage.getItem("parent_token") && mode === "parent") navigate("/parent");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNetworkIssue(false);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (isBackendNetworkError(error)) {
          setNetworkIssue(true);
          setRecheckKey((k) => k + 1);
          toast.error("Server backend sedang gangguan/timeout. Silakan coba lagi sebentar.");
        } else if (error.includes("Invalid login credentials")) {
          toast.error("Email atau password salah. Pastikan email sudah terverifikasi.");
        } else if (error.includes("Email not confirmed")) {
          toast.error("Email belum diverifikasi. Silakan cek inbox email Anda.");
        } else {
          toast.error("Login gagal: " + error);
        }
        return;
      }
      // Persist remember-me preference
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
        localStorage.removeItem("was_ephemeral");
      } else {
        localStorage.removeItem("remembered_email");
        localStorage.setItem("was_ephemeral", "1");
        sessionStorage.setItem("tab_alive", "1");
      }
      toast.success("Login berhasil!");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [{ data: roles }, { data: profileData }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
          supabase.from("profiles").select("full_name, school_id").eq("user_id", user.id).maybeSingle(),
        ]);
        const rolesList = (roles || []).map((r: any) => r.role);
        const isSuperAdmin = rolesList.includes("super_admin");
        const isBendahara = rolesList.includes("bendahara");
        const isTeacher = rolesList.includes("teacher");
        const isAdmin = rolesList.includes("school_admin");
        const isStaff = rolesList.includes("staff");
        const dashboardKinds = [isSuperAdmin, isAdmin, isStaff && !isAdmin, isTeacher, isBendahara].filter(Boolean).length;

        (async () => {
          try {
            let schoolName: string | null = null;
            if (profileData?.school_id) {
              const { data: schoolData } = await supabase.from("schools").select("name").eq("id", profileData.school_id).maybeSingle();
              schoolName = schoolData?.name || null;
            }
            await supabase.from("login_logs").insert({
              user_id: user.id,
              email: user.email || null,
              full_name: profileData?.full_name || null,
              role: rolesList.join(", ") || null,
              school_name: schoolName,
              user_agent: navigator.userAgent,
            } as any);
          } catch (e) { console.warn("login_logs insert failed", e); }
        })();

        sessionStorage.removeItem("dashboard_chosen");
        if (dashboardKinds > 1) navigate("/select-role");
        else if (isSuperAdmin) navigate("/super-admin");
        else if (isBendahara) navigate("/bendahara");
        else if (isTeacher) navigate("/teacher-dashboard");
        else navigate("/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      toast.error("Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    setLoading(true);
    try {
      if (parentMethod === "card") {
        const digits = cardNumber.replace(/\D/g, "");
        if (digits.length !== 16) { toast.error("Nomor Kartu harus 16 digit"); return; }
        // Direct login (no OTP) when using Nomor Kartu Identitas
        const { data } = await supabase.functions.invoke("parent-portal", {
          body: { action: "login_card", card_number: digits },
        });
        if (data?.error) return toast.error(data.error);
        if (!data?.token) return toast.error("Login gagal");
        localStorage.setItem("parent_token", data.token);
        localStorage.setItem("parent_phone", data.phone);
        toast.success("Login berhasil");
        navigate("/parent");
        return;
      }
      // WhatsApp method → still requires OTP
      if (!phone || phone.length < 9) { toast.error("Nomor WA tidak valid"); return; }
      const { data } = await supabase.functions.invoke("parent-portal", {
        body: { action: "request_otp", phone },
      });
      if (data?.error) return toast.error(data.error);
      if (data?.phone) setPhone(data.phone);
      toast.success("Kode OTP dikirim via WhatsApp");
      setStep("otp");
      setCooldown(60);
    } catch { toast.error("Gagal memproses login"); } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return toast.error("Kode harus 6 digit");
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("parent-portal", { body: { action: "verify_otp", phone, otp } });
      if (data?.error) {
        toast.error(data.error);
        if (/kedaluwarsa|expired/i.test(String(data.error))) {
          setOtp(""); setStep("phone"); setCooldown(0);
        }
        return;
      }
      localStorage.setItem("parent_token", data.token);
      localStorage.setItem("parent_phone", data.phone);
      toast.success("Login berhasil");
      navigate("/parent");
    } catch { toast.error("Gagal verifikasi OTP"); } finally { setLoading(false); }
  };

  const scanBars = Array.from({ length: 24 }, (_, i) => i);

  const features = [
    { icon: Users, title: "Sistem Multi Role", desc: "Dashboard Admin Sekolah, Guru, Wali Kelas, Bendahara, hingga Wali Murid" },
    { icon: ScanFace, title: "Absensi Barcode & Face Recognition", desc: "Pencatatan kehadiran dengan QR/Barcode dan pengenalan wajah otomatis" },
    { icon: Calendar, title: "Jadwal Pelajaran Real-time", desc: "Sinkronisasi jadwal mengajar dan kehadiran secara langsung" },
    { icon: Wallet, title: "Manajemen Keuangan SPP", desc: "Tagihan, pembayaran, dan rekap SPP otomatis dalam satu dashboard" },
    { icon: MessageCircle, title: "Notifikasi WhatsApp Otomatis", desc: "Info kehadiran dan tagihan langsung terkirim ke wali murid via WA" },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-[#5B6CF9]">
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-50 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>

      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { top: '10%', left: '5%', delay: 0 }, { top: '20%', left: '90%', delay: 1 },
          { top: '70%', left: '8%', delay: 0.5 }, { top: '80%', left: '85%', delay: 1.5 },
          { top: '40%', left: '3%', delay: 2 }, { top: '55%', left: '95%', delay: 0.8 },
        ].map((dot, i) => (
          <motion.div key={i} className="absolute w-2 h-2 rounded-full bg-white" style={{ top: dot.top, left: dot.left }}
            animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.5, 1] }} transition={{ duration: 3, repeat: Infinity, delay: dot.delay }} />
        ))}
        <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          animate={{ top: ['0%', '100%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="hidden lg:block absolute right-[8%] top-[15%] w-28 h-28 border-2 border-white/10 rounded-2xl"
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.03, 1] }} transition={{ duration: 6, repeat: Infinity }}>
          <div className="absolute top-2 left-2 w-5 h-5 border-l-2 border-t-2 border-white/20 rounded-tl-md" />
          <div className="absolute top-2 right-2 w-5 h-5 border-r-2 border-t-2 border-white/20 rounded-tr-md" />
          <div className="absolute bottom-2 left-2 w-5 h-5 border-l-2 border-b-2 border-white/20 rounded-bl-md" />
          <div className="absolute bottom-2 right-2 w-5 h-5 border-r-2 border-b-2 border-white/20 rounded-br-md" />
        </motion.div>
      </div>

      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-300/[0.05] rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center justify-items-center">
          {/* Left: Features */}
          <motion.div
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}
            className="hidden lg:block text-white w-full max-w-lg"
          >
            <div className="flex items-center gap-3 mb-5">
              <img src={tenantLogo || loginLogo} alt={tenantName || "ATSkolla"} className="h-11 w-11 rounded-xl shadow-lg object-contain bg-white/10" />
              <span className="font-bold text-2xl tracking-tight">{tenantName || "ATSkolla"}</span>
            </div>
            <h2 className="text-3xl xl:text-[2rem] font-bold mb-2 leading-tight">{tenantName ? `Selamat Datang di ${tenantName}` : "Platform Digital Sekolah Modern"}</h2>
            <p className="text-white/70 text-sm mb-5">{tenantName ? "Masuk untuk mengakses dashboard sekolah Anda." : "Solusi lengkap absensi, keuangan, dan komunikasi sekolah dalam satu sistem."}</p>
            <div className="space-y-2.5">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-3 bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm"
                >
                  <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight">{f.title}</p>
                    <p className="text-[12px] text-white/65 mt-1 leading-snug">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Login card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="flex lg:hidden items-center justify-center gap-3 mb-6">
              <img src={tenantLogo || loginLogo} alt={tenantName || "ATSkolla"} className="h-11 w-11 rounded-xl shadow-lg object-contain bg-white/10" />
              <span className="font-bold text-xl text-white tracking-tight">{tenantName || "ATSkolla"}</span>
            </motion.div>

            <div className="text-center mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {mode === "school" ? "Selamat Datang" : "Portal Wali Murid"}
              </h2>
              <p className="text-white/60 text-sm mt-1">
                {mode === "school" ? "Masuk ke akun Anda untuk melanjutkan" : "Pantau aktivitas ananda dengan mudah"}
              </p>
            </div>

            <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.6 }} className="relative">
              <div className="absolute -inset-1 bg-white/10 rounded-[2rem] blur-xl" />
              <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-6 sm:p-7 shadow-2xl shadow-black/20">
                {/* Tabs */}
                <div className="flex p-1 bg-secondary/60 rounded-xl mb-5">
                  <button
                    type="button"
                    onClick={() => setMode("school")}
                    className={`flex-1 h-9 text-xs font-semibold rounded-lg transition-all ${
                      mode === "school" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Sekolah / Guru
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("parent")}
                    className={`flex-1 h-9 text-xs font-semibold rounded-lg transition-all ${
                      mode === "parent" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Wali Murid
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-5">
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                    <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      {mode === "school" ? "Koneksi Aman" : "Login via WhatsApp"}
                    </span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {mode === "school" ? (
                    <motion.form
                      key="school"
                      initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleLogin} className="space-y-4"
                    >
                      <div className="mb-2">
                        <BackendStatusBanner forceShow={networkIssue} recheckKey={recheckKey} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input id="email" type="email" placeholder="email@sekolah.com" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 pl-10 bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 rounded-xl" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 pl-10 pr-10 bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 rounded-xl" required />
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-border accent-[#5B6CF9] cursor-pointer"
                          />
                          <span className="text-xs font-medium text-muted-foreground">Ingat Saya</span>
                        </label>
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                          Lupa Password?
                        </Link>
                      </div>
                      <Button type="submit" disabled={loading}
                        className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 rounded-xl">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Masuk Sekarang <ArrowRight className="h-4 w-4 ml-2" /></>}
                      </Button>

                      <div className="text-center pt-1">
                        <p className="text-sm text-muted-foreground">
                          Belum punya akun?{" "}
                          <Link to="/register" className="text-primary font-semibold hover:underline">Daftar Sekolah</Link>
                        </p>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="parent"
                      initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AnimatePresence mode="wait">
                        {step === "phone" ? (
                          <motion.div key="phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25 }} className="space-y-4">
                            {/* Method toggle */}
                            <div className="flex p-1 bg-secondary/60 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setParentMethod("phone")}
                                className={`flex-1 h-8 text-[11px] font-semibold rounded-lg transition-all ${parentMethod === "phone" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground"}`}
                              >
                                No. WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => setParentMethod("card")}
                                className={`flex-1 h-8 text-[11px] font-semibold rounded-lg transition-all ${parentMethod === "card" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground"}`}
                              >
                                Nomor Kartu Identitas
                              </button>
                            </div>

                            {parentMethod === "phone" ? (
                              <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nomor WhatsApp</Label>
                                <div className="relative group">
                                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                                  <Input id="phone" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                    className="h-12 pl-10 bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 rounded-xl" />
                                </div>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" /> Gunakan nomor yang terdaftar di sekolah ananda.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label htmlFor="card" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nomor Kartu Siswa (16 digit)</Label>
                                <div className="relative group">
                                  <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                                  <Input id="card" type="tel" inputMode="numeric" maxLength={19} placeholder="1234 5678 9012 3456"
                                    value={cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
                                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                                    className="h-12 pl-10 font-mono tracking-wider bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 rounded-xl" />
                                </div>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" /> OTP tetap dikirim ke WhatsApp orang tua yang terdaftar.
                                </p>
                              </div>
                            )}
                            <Button onClick={requestOtp} disabled={loading}
                              className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 rounded-xl">
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageSquare className="h-4 w-4 mr-2" /> Kirim Kode OTP <ArrowRight className="h-4 w-4 ml-2" /></>}
                            </Button>
                          </motion.div>
                        ) : (
                          <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="otp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kode OTP (6 digit)</Label>
                              <Input id="otp" type="text" inputMode="numeric" maxLength={6} placeholder="------" value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                className="h-14 text-center text-2xl tracking-[0.5em] font-bold bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 rounded-xl" />
                              <p className="text-[11px] text-muted-foreground">Kode dikirim ke <strong>{phone}</strong> via WhatsApp.</p>
                            </div>
                            <Button onClick={verifyOtp} disabled={loading}
                              className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 rounded-xl">
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Masuk Sekarang <ArrowRight className="h-4 w-4 ml-2" /></>}
                            </Button>
                            <div className="flex items-center justify-between text-xs">
                              <button onClick={() => setStep("phone")} className="text-muted-foreground hover:text-foreground">← Ganti nomor</button>
                              <button onClick={requestOtp} disabled={cooldown > 0 || loading}
                                className="text-[#5B6CF9] disabled:text-muted-foreground font-medium">
                                {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang OTP"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </div>
        <p className="text-center text-white/40 text-xs mt-8 w-full max-w-6xl">© 2026 ATSkolla — Platform Digital Sekolah</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-8 bg-white dark:bg-slate-950 rounded-t-[2rem] z-[5]" />
    </div>
  );
};

export default Login;
