import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Loader2, Mail, Lock, ShieldCheck, KeyRound, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import atskollaLogo from "@/assets/atskolla-logo.png";

type Step = "email" | "otp" | "new-password" | "done";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [logo, setLogo] = useState(atskollaLogo);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["login_logo_url"])
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map((d) => [d.key, d.value]));
          if (map.login_logo_url) setLogo(map.login_logo_url);
        }
      });
  }, []);

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { email },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      if (!data.has_wa_integration) {
        toast.error("Belum ada integrasi WhatsApp yang aktif. Hubungi admin.");
        return;
      }
      if (!data.has_phone) {
        toast.error("Nomor WhatsApp belum terdaftar di profil Anda. Hubungi admin untuk menambahkan nomor.");
        return;
      }

      setUserName(data.user_name || "");
      setSchoolId(data.school_id || "");
      setMaskedPhone(data.masked_phone || "");

      const { data: otpData, error: otpError } = await supabase.functions.invoke("send-otp", {
        body: { email, school_id: data.school_id },
      });
      if (otpError) throw otpError;
      if (otpData.error) { toast.error(otpData.error); return; }

      toast.success("Kode OTP berhasil dikirim ke WhatsApp!");
      setStep("otp");
      setOtpCooldown(60);
      const timer = setInterval(() => {
        setOtpCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || loading) return;
    setLoading(true);
    setOtpError("");
    try {
      const { data: otpData, error: otpError } = await supabase.functions.invoke("send-otp", {
        body: { email, school_id: schoolId },
      });
      if (otpError) throw otpError;
      if (otpData.error) { toast.error(otpData.error); return; }
      toast.success("Kode OTP baru berhasil dikirim!");
      setOtp("");
      setOtpCooldown(60);
      const timer = setInterval(() => {
        setOtpCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim ulang OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Masukkan 6 digit kode OTP"); return; }
    setLoading(true);
    setOtpError("");
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp-reset", {
        body: { email, otp_code: otp, verify_only: true },
      });
      if (error) throw error;
      if (data.error) { setOtpError(data.error); toast.error(data.error); return; }
      toast.success("OTP terverifikasi!");
      setStep("new-password");
    } catch (err: any) {
      setOtpError(err.message || "OTP tidak valid");
      toast.error(err.message || "OTP tidak valid");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    if (newPassword !== confirmPassword) { toast.error("Password tidak cocok"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp-reset", {
        body: { email, otp_code: otp, new_password: newPassword },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      toast.success("Password berhasil diubah!");
      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Gagal reset password");
    } finally {
      setLoading(false);
    }
  };
  const stepConfig: Record<Step, { title: string; subtitle: string; icon: typeof KeyRound }> = {
    email: {
      title: "Lupa Password?",
      subtitle: "Tenang, kami bantu pulihkan akses akun Anda.",
      icon: KeyRound,
    },
    otp: {
      title: "Verifikasi OTP",
      subtitle: `Kami kirim kode 6 digit ke WhatsApp ${maskedPhone}`,
      icon: MessageCircle,
    },
    "new-password": {
      title: "Buat Password Baru",
      subtitle: "Buat kata sandi baru yang aman dan mudah diingat.",
      icon: Lock,
    },
    done: {
      title: "Berhasil!",
      subtitle: "Password Anda telah diperbarui dengan aman.",
      icon: CheckCircle2,
    },
  };

  const StepIcon = stepConfig[step].icon;
  const stepIndex = ["email", "otp", "new-password"].indexOf(step);

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-[#5B6CF9]">
      {/* Back to home */}
      <button
        onClick={() => navigate("/admin")}
        className="absolute top-4 left-4 z-50 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Login
      </button>

      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Floating decorative blobs */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-300/10 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating circles */}
      <motion.div
        className="hidden lg:flex absolute left-[12%] top-[18%] h-20 w-20 rounded-2xl bg-white/10 border border-white/15 items-center justify-center backdrop-blur-md"
        animate={{ y: [0, -12, 0], rotate: [0, 6, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <KeyRound className="h-9 w-9 text-white/70" />
      </motion.div>
      <motion.div
        className="hidden lg:flex absolute left-[6%] bottom-[18%] h-14 w-14 rounded-xl bg-white/10 border border-white/15 items-center justify-center backdrop-blur-md"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 4, repeat: Infinity, delay: 1 }}
      >
        <ShieldCheck className="h-6 w-6 text-white/70" />
      </motion.div>
      <motion.div
        className="hidden lg:flex absolute right-[8%] top-[22%] h-16 w-16 rounded-2xl bg-white/10 border border-white/15 items-center justify-center backdrop-blur-md"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, delay: 0.5 }}
      >
        <MessageCircle className="h-7 w-7 text-white/70" />
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <img src={logo} alt="ATSkolla" className="h-11 w-11 rounded-xl shadow-lg" />
            <span className="font-bold text-xl text-white tracking-tight">ATSkolla</span>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-center mb-6"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{stepConfig[step].title}</h2>
            <p className="text-white/70 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">{stepConfig[step].subtitle}</p>
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="relative"
          >
            <div className="absolute -inset-1 bg-white/10 rounded-[2rem] blur-xl" />

            <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-7 sm:p-8 shadow-2xl shadow-black/20">
              {/* Big icon */}
              <div className="flex justify-center -mt-14 mb-3">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 200 }}
                  className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl ${
                    step === "done"
                      ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/40"
                      : "bg-gradient-to-br from-[#5B6CF9] to-indigo-700 shadow-indigo-500/40"
                  }`}
                >
                  <StepIcon className="h-8 w-8 text-white" />
                </motion.div>
              </div>

              {/* Progress dots */}
              {step !== "done" && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i <= stepIndex ? "w-8 bg-[#5B6CF9]" : "w-4 bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* Step 1: Email */}
                {step === "email" && (
                  <motion.form
                    key="email"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleCheckEmail}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Email Akun
                      </Label>
                      <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@sekolah.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 pl-10 bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 transition-all duration-300 rounded-xl"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-1">Kami kirim kode OTP ke WhatsApp terdaftar Anda.</p>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 transition-all rounded-xl"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Kirim Kode OTP
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.form>
                )}

                {/* Step 2: OTP */}
                {step === "otp" && (
                  <motion.form
                    key="otp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleVerifyOtp}
                    className="space-y-5"
                  >
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center block">
                        Masukkan 6 Digit Kode
                      </Label>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otp} onChange={(v) => { setOtp(v); setOtpError(""); }}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} className="h-12 w-12 text-lg font-bold rounded-xl border-2" />
                            <InputOTPSlot index={1} className="h-12 w-12 text-lg font-bold rounded-xl border-2" />
                            <InputOTPSlot index={2} className="h-12 w-12 text-lg font-bold rounded-xl border-2" />
                            <InputOTPSlot index={3} className="h-12 w-12 text-lg font-bold rounded-xl border-2" />
                            <InputOTPSlot index={4} className="h-12 w-12 text-lg font-bold rounded-xl border-2" />
                            <InputOTPSlot index={5} className="h-12 w-12 text-lg font-bold rounded-xl border-2" />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      {otpError && (
                        <p className="text-xs text-center text-red-500 font-medium">{otpError}</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 transition-all rounded-xl"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verifikasi"}
                    </Button>
                    <div className="text-center text-sm">
                      <span className="text-muted-foreground">Tidak menerima kode? </span>
                      <button
                        type="button"
                        disabled={otpCooldown > 0 || loading}
                        onClick={handleResendOtp}
                        className="font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                      >
                        {otpCooldown > 0 ? `Kirim ulang (${otpCooldown}s)` : "Kirim ulang"}
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* Step 3: New Password */}
                {step === "new-password" && (
                  <motion.form
                    key="newpw"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleResetPassword}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="new-pw" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Password Baru
                      </Label>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="new-pw"
                          type="password"
                          placeholder="Minimal 6 karakter"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-12 pl-10 bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 transition-all duration-300 rounded-xl"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-pw" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Konfirmasi Password
                      </Label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="confirm-pw"
                          type="password"
                          placeholder="Ketik ulang password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-12 pl-10 bg-secondary/50 border-border focus:bg-background focus:border-primary focus:ring-primary/20 transition-all duration-300 rounded-xl"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 transition-all rounded-xl"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Password Baru"}
                    </Button>
                  </motion.form>
                )}

                {/* Done */}
                {step === "done" && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-5 text-center"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Silakan login menggunakan password baru Anda dan jaga kerahasiaannya.
                    </p>
                    <Button
                      onClick={() => navigate("/admin")}
                      className="w-full h-12 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white font-semibold text-sm uppercase tracking-wide shadow-lg shadow-indigo-500/20 transition-all rounded-xl"
                    >
                      Ke Halaman Login
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {step !== "done" && (
                <div className="mt-6 text-center">
                  <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    ← Kembali ke Login
                  </Link>
                </div>
              )}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-white/40 text-xs mt-6"
          >
            © 2026 ATSkolla — Platform Digital Sekolah
          </motion.p>
        </motion.div>
      </div>

      {/* Bottom rounded accent */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-white dark:bg-slate-950 rounded-t-[2rem] z-[5]" />
    </div>
  );
};

export default ForgotPassword;
