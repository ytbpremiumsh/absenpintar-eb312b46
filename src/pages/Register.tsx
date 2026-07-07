import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { School, Eye, EyeOff, Loader2, Search, CheckCircle2, MapPin, GraduationCap, PenLine, ArrowLeft, Sparkles, ShieldCheck, Zap, User, Mail, Phone, Building2, Globe2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Fragment, type ReactNode } from "react";
// Animations disabled on this page — motion.* & AnimatePresence are inert passthroughs
type Easing = string;
const _stripMotionProps = ({
  initial, animate, exit, transition, variants, whileHover, whileTap, whileInView,
  whileFocus, whileDrag, layout, layoutId, drag, dragConstraints, viewport, custom, ...rest
}: any) => rest;
const _make = (Tag: any) => {
  const C = (props: any) => <Tag {..._stripMotionProps(props)} />;
  C.displayName = `motion.${typeof Tag === "string" ? Tag : "component"}`;
  return C;
};
const _motionCache: Record<string, any> = {};
const motion: any = new Proxy({}, {
  get: (_t, tag: string) => (_motionCache[tag] ||= _make(tag)),
});
const AnimatePresence = ({ children }: { children: ReactNode; mode?: string; initial?: boolean }) => <Fragment>{children}</Fragment>;
import { supabase } from "@/integrations/supabase/client";
import { getRootDomain } from "@/lib/tenant";
import atskollaLogo from "@/assets/atskolla-logo.png";

interface SchoolData {
  npsn: string;
  name: string;
  address: string;
  level: string;
  status: string;
  district: string;
  province: string;
}

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);

  const [inputMode, setInputMode] = useState<"npsn" | "manual" | null>(null);
  const [npsn, setNpsn] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);

  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualLevel, setManualLevel] = useState<string>("");
  const [manualStatus, setManualStatus] = useState<string>("");

  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState<string>("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralInput, setReferralInput] = useState(refCode);
  const [registering, setRegistering] = useState(false);
  const [logo, setLogo] = useState(atskollaLogo);
  const [agreeTos, setAgreeTos] = useState(false);

  // School-level extra info (required)
  const [principalName, setPrincipalName] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolWhatsapp, setSchoolWhatsapp] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolProvince, setSchoolProvince] = useState("");
  const [studentCountRange, setStudentCountRange] = useState<string>("");

  // Subdomain (school website slug) with live availability check
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "reserved" | "invalid">("idle");
  const rootDomain = typeof window !== "undefined" ? (getRootDomain() || "absenpintar.online") : "absenpintar.online";

  const slugify = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40);

  // Auto-suggest slug from school name (only if user hasn't manually edited)
  useEffect(() => {
    if (!slugTouched && schoolData?.name) {
      const s = slugify(schoolData.name);
      if (s.length >= 3) setSlug(s);
    }
  }, [schoolData, slugTouched]);

  // Debounced availability check — subdomains must be letters/digits only (no dashes).
  useEffect(() => {
    if (!slug) { setSlugStatus("idle"); return; }
    if (!/^[a-z0-9]{3,40}$/.test(slug)) {
      setSlugStatus("invalid"); return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const [{ data: reserved }, { data: existing }] = await Promise.all([
          supabase.rpc("is_reserved_slug", { _slug: slug }),
          supabase.from("schools").select("id").eq("slug", slug).maybeSingle(),
        ]);
        if (reserved === true) setSlugStatus("reserved");
        else if (existing) setSlugStatus("taken");
        else setSlugStatus("available");
      } catch { setSlugStatus("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

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

  const handleNpsnLookup = async () => {
    if (npsn.length !== 8 || !/^\d{8}$/.test(npsn)) {
      toast.error("NPSN harus 8 digit angka");
      return;
    }
    setLookingUp(true);
    setSchoolData(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-npsn?npsn=${npsn}`;
      const response = await fetch(url, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.error || "Sekolah tidak ditemukan");
        setLookingUp(false);
        return;
      }
      setSchoolData(data.school);
      toast.success(`Sekolah ditemukan: ${data.school.name}`);
    } catch (err: any) {
      toast.error("Gagal mencari data sekolah");
    }
    setLookingUp(false);
  };

  const handleManualConfirm = () => {
    if (!manualName.trim()) { toast.error("Nama sekolah wajib diisi"); return; }
    if (!manualLevel) { toast.error("Jenjang sekolah wajib dipilih"); return; }
    if (!manualStatus) { toast.error("Status sekolah wajib dipilih"); return; }
    setSchoolData({
      npsn: "",
      name: manualName.trim(),
      address: manualAddress.trim(),
      level: manualLevel,
      status: manualStatus,
      district: "",
      province: "",
    });
    toast.success("Data sekolah berhasil diisi");
  };

  const canProceed = !!schoolData;

  // Prefill school address/city/province whenever schoolData is (re)set
  useEffect(() => {
    if (schoolData) {
      setSchoolAddress((prev) => prev || schoolData.address || "");
      setSchoolCity((prev) => prev || schoolData.district || "");
      setSchoolProvince((prev) => prev || schoolData.province || "");
    }
  }, [schoolData]);

  const resetStep1 = () => {
    setInputMode(null);
    setNpsn("");
    setSchoolData(null);
    setManualName("");
    setManualAddress("");
    setManualLevel("");
    setManualStatus("");
  };

  const passwordHasUpper = /[A-Z]/.test(password);
  const passwordHasNumber = /[0-9]/.test(password);
  const passwordHasSymbol = /[^A-Za-z0-9]/.test(password);
  const passwordLongEnough = password.length >= 8;
  const passwordValid = passwordHasUpper && passwordHasNumber && passwordHasSymbol && passwordLongEnough;

  // Per-step validators for Next-button navigation
  const validateStep1Slug = (): boolean => {
    if (!slug || slugStatus !== "available") { toast.error("Pilih alamat website (subdomain) yang tersedia"); return false; }
    return true;
  };
  const validateStep2 = (): boolean => {
    if (!fullName.trim() || fullName.trim().length < 3) { toast.error("Nama lengkap wajib diisi"); return false; }
    if (!position) { toast.error("Jabatan wajib dipilih"); return false; }
    const personalWa = phone.replace(/\D/g, '');
    if (personalWa.length < 9 || personalWa.length > 15) { toast.error("Nomor WhatsApp pribadi tidak valid"); return false; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Email login tidak valid"); return false; }
    return true;
  };
  const goNext = () => {
    if (step === 1 && !validateStep1Slug()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => (s < 3 ? ((s + 1) as 2 | 3) : s));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };



  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData) { toast.error("Data sekolah belum diisi"); return; }

    if (!fullName.trim() || fullName.trim().length < 3) { toast.error("Nama lengkap penanggung jawab wajib diisi"); return; }
    if (!position) { toast.error("Jabatan penanggung jawab wajib dipilih"); return; }
    const personalWa = phone.replace(/\D/g, '');
    if (personalWa.length < 9 || personalWa.length > 15) {
      toast.error("Nomor WhatsApp pribadi tidak valid"); return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Email login tidak valid"); return;
    }

    if (!passwordValid) { toast.error("Password harus minimal 8 karakter, mengandung huruf besar, angka, dan simbol"); return; }
    if (password !== confirmPassword) { toast.error("Password tidak cocok"); return; }
    if (!slug || slugStatus !== "available") {
      toast.error("Silakan pilih alamat website sekolah (subdomain) yang tersedia");
      return;
    }
    if (!agreeTos) { toast.error("Anda harus menyetujui Syarat & Ketentuan"); return; }

    setRegistering(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role: 'school_admin',
          npsn: schoolData.npsn || undefined,
          school_name: schoolData.name,
          school_address: schoolData.address || undefined,
          phone: personalWa,
          position,
          referral_code: referralInput || undefined,
          desired_slug: slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Registrasi gagal");
        setRegistering(false);
        return;
      }

      if (data.school_slug) {
        // Use the school's own subdomain URL (wildcard SSL is provisioned on the root domain).
        const targetUrl = `${window.location.protocol}//${data.school_slug}.${rootDomain}/admin`;
        toast.success(`Registrasi berhasil! Login di ${data.school_slug}.${rootDomain}/admin`, { duration: 10000 });
        setTimeout(() => { window.location.href = targetUrl; }, 2500);
      } else {
        toast.success("Registrasi berhasil! Silakan login.");
        navigate("/admin");
      }

    } catch (err: any) {
      toast.error("Registrasi gagal: " + (err.message || "Unknown error"));
    }
    setRegistering(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as Easing } },
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-white text-[#0b1020]">
      {/* Back to home */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-50 inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-[#5B6CF9]/40 text-[#0b1020] px-3 py-2 rounded-xl text-sm font-medium transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        Beranda
      </button>

      {/* Subtle grid background — matches Login */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,16,32,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,16,32,.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at top, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at top, black 40%, transparent 80%)",
        }}
      />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <img src={logo} alt="ATSkolla" className="h-10 w-auto object-contain" />
        </div>

        {/* Title */}
        <div className="text-center mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0b1020]">Daftar Sekolah Baru</h1>
          <p className="text-[#0b1020]/60 text-sm mt-1.5">Mulai digitalisasi sekolah Anda dalam hitungan menit</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-5 flex-wrap">
          {[
            { n: 1, label: "Sekolah" },
            { n: 2, label: "Penanggung Jawab" },
            { n: 3, label: "Keamanan" },
          ].map((s, i) => (
            <Fragment key={s.n}>
              {i > 0 && <div className="w-4 sm:w-6 h-px bg-slate-200" />}
              <div className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-300 ${step === s.n ? "bg-[#5B6CF9] text-white shadow-md shadow-[#5B6CF9]/20" : step > s.n ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {step > s.n ? <CheckCircle2 className="h-3 w-3" /> : <span>{s.n}</span>} {s.label}
              </div>
            </Fragment>
          ))}
        </div>



        {/* Main Card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-[#5B6CF9]/10 rounded-[2rem] blur-xl" />

          <div className="relative bg-white border border-slate-200 rounded-[2rem] shadow-xl shadow-slate-900/5 overflow-hidden">
            {/* Top accent */}
            <div className="h-1 bg-[#5B6CF9]" />

            <div className="p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                    variants={containerVariants}
                    className="space-y-4"
                  >
                    {/* Mode selection */}
                    {!inputMode && !schoolData && (
                      <motion.div variants={itemVariants} className="space-y-3">
                        <p className="text-sm font-medium text-foreground text-center mb-1">Pilih cara memasukkan data sekolah</p>
                        <motion.button
                          type="button"
                          onClick={() => setInputMode("npsn")}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-indigo-400/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all text-left group"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                            <Search className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Cari dengan NPSN</p>
                            <p className="text-[11px] text-muted-foreground">Data sekolah otomatis terisi dari database Dapodik</p>
                          </div>
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => setInputMode("manual")}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-indigo-400/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all text-left group"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                            <PenLine className="h-5 w-5 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Isi Manual</p>
                            <p className="text-[11px] text-muted-foreground">Masukkan nama sekolah dan alamat secara manual</p>
                          </div>
                        </motion.button>
                      </motion.div>
                    )}

                    {/* NPSN Input */}
                    {inputMode === "npsn" && !schoolData && (
                      <motion.div variants={itemVariants} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="npsn">NPSN (Nomor Pokok Sekolah Nasional)</Label>
                          <div className="flex gap-2">
                            <Input
                              id="npsn"
                              placeholder="Masukkan 8 digit NPSN"
                              value={npsn}
                              onChange={(e) => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                                setNpsn(v);
                              }}
                              className="h-11 font-mono text-lg tracking-widest rounded-xl"
                              maxLength={8}
                            />
                            <Button
                              type="button"
                              onClick={handleNpsnLookup}
                              disabled={npsn.length !== 8 || lookingUp}
                              className="h-11 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl"
                            >
                              {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Masukkan NPSN untuk mencari data sekolah otomatis dari Dapodik</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={resetStep1} className="text-xs text-muted-foreground">
                          ← Pilih metode lain
                        </Button>
                      </motion.div>
                    )}

                    {/* Manual Input */}
                    {inputMode === "manual" && !schoolData && (
                      <motion.div variants={itemVariants} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="schoolName">Nama Sekolah <span className="text-red-500">*</span></Label>
                          <Input id="schoolName" placeholder="Contoh: SDN 1 Surabaya" value={manualName} onChange={(e) => setManualName(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Jenjang <span className="text-red-500">*</span></Label>
                            <Select value={manualLevel} onValueChange={setManualLevel}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
                              <SelectContent>
                                {["PAUD","TK","SD","MI","SMP","MTs","SMA","MA","SMK","SLB","Pesantren","Lainnya"].map((l) => (
                                  <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Status <span className="text-red-500">*</span></Label>
                            <Select value={manualStatus} onValueChange={setManualStatus}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih status" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Negeri">Negeri</SelectItem>
                                <SelectItem value="Swasta">Swasta</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="schoolAddressManual">Alamat Sekolah <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                          <Input id="schoolAddressManual" placeholder="Jl. Pendidikan No. 1, Kota ..." value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={resetStep1} className="text-xs text-muted-foreground">← Kembali</Button>
                          <Button type="button" onClick={handleManualConfirm} disabled={!manualName.trim() || !manualLevel || !manualStatus} className="flex-1 h-10 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl">Konfirmasi</Button>
                        </div>
                      </motion.div>
                    )}

                    {/* School Data Result */}
                    {schoolData && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/30 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-sm font-bold text-foreground">
                            {schoolData.npsn ? "Sekolah Ditemukan!" : "Data Sekolah Siap"}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <School className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{schoolData.name}</p>
                              {schoolData.npsn && <p className="text-xs text-muted-foreground">NPSN: {schoolData.npsn}</p>}
                            </div>
                          </div>
                          {schoolData.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-xs text-muted-foreground">{schoolData.address}</p>
                            </div>
                          )}
                          {(schoolData.level || schoolData.status || schoolData.district || schoolData.province) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {schoolData.level && <Badge variant="secondary" className="text-[10px]"><GraduationCap className="h-3 w-3 mr-0.5" />{schoolData.level}</Badge>}
                              {schoolData.status && <Badge variant="outline" className="text-[10px]">{schoolData.status}</Badge>}
                              {schoolData.district && <Badge variant="outline" className="text-[10px]">{schoolData.district}</Badge>}
                              {schoolData.province && <Badge variant="outline" className="text-[10px]">{schoolData.province}</Badge>}
                            </div>
                          )}
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={resetStep1} className="text-xs text-muted-foreground mt-1 px-0">Ubah data sekolah</Button>
                      </motion.div>
                    )}

                    {/* Subdomain / Alamat Website Sekolah — shown once schoolData is ready */}
                    {schoolData && (
                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="schoolSlug">Alamat Website Sekolah <span className="text-red-500">*</span></Label>
                        <div className="flex items-stretch rounded-xl overflow-hidden border border-input focus-within:ring-2 focus-within:ring-ring">
                          <Input
                            id="schoolSlug"
                            placeholder="namasekolah"
                            value={slug}
                            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                            maxLength={40}
                            className="h-11 border-0 rounded-none focus-visible:ring-0 flex-1"
                          />
                          <div className="flex items-center px-3 bg-muted/60 text-xs text-muted-foreground whitespace-nowrap font-mono">
                            .{rootDomain}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 min-h-[16px]">
                          {slugStatus === "checking" && (
                            <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Mengecek ketersediaan…</span></>
                          )}
                          {slugStatus === "available" && (
                            <><CheckCircle2 className="h-3 w-3 text-emerald-600" /><span className="text-[11px] text-emerald-600 font-medium">Tersedia — akses di <span className="font-mono">{slug}.{rootDomain}</span></span></>
                          )}
                          {slugStatus === "taken" && (
                            <span className="text-[11px] text-red-600 font-medium">✗ Sudah dipakai sekolah lain</span>
                          )}
                          {slugStatus === "reserved" && (
                            <span className="text-[11px] text-red-600 font-medium">✗ Kata ini dipesan sistem</span>
                          )}
                          {slugStatus === "invalid" && slug.length > 0 && (
                            <span className="text-[11px] text-amber-600 font-medium">Min 3 karakter — hanya huruf kecil &amp; angka.</span>
                          )}
                          {slugStatus === "idle" && !slug && (
                            <span className="text-[11px] text-muted-foreground">Contoh: <span className="font-mono">smpn1jakarta</span></span>
                          )}
                        </div>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <Button
                        type="button"
                        onClick={() => { if (validateStep1Slug()) setStep(2); }}
                        disabled={!canProceed || slugStatus !== "available"}
                        className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                      >
                        Lanjutkan
                      </Button>
                      {schoolData && (
                        <p className="text-[11px] text-muted-foreground text-center mt-2">
                          Data lain seperti kepala sekolah, email &amp; alamat lengkap dapat dilengkapi nanti di <span className="font-medium">Pengaturan → Identitas Sekolah</span>.
                        </p>
                      )}
                    </motion.div>

                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
                    variants={containerVariants}
                  >
                    <form onSubmit={handleRegister} className="space-y-4">
                      {/* School summary */}
                      <motion.div variants={itemVariants} className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200/40 dark:border-indigo-800/30 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                          <School className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{schoolData?.name}</p>
                          {schoolData?.npsn ? (
                            <p className="text-[10px] text-muted-foreground">NPSN: {schoolData.npsn}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Input manual</p>
                          )}
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs shrink-0" onClick={() => setStep(1)}>Ubah</Button>
                      </motion.div>

                      {step === 2 && (<>

                      {/* ===== SECTION B: Penanggung Jawab ===== */}
                      <motion.div variants={itemVariants} className="pt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Data Penanggung Jawab</p>
                            <p className="text-[11px] text-muted-foreground">Orang yang akan mengelola akun ATSkolla ini</p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="fullName">Nama Lengkap <span className="text-red-500">*</span></Label>
                        <Input id="fullName" placeholder="Nama lengkap sesuai identitas" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} className="h-11 rounded-xl" required />
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label>Jabatan <span className="text-red-500">*</span></Label>
                        <Select value={position} onValueChange={setPosition}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih jabatan" /></SelectTrigger>
                          <SelectContent>
                            {["Kepala Sekolah","Wakil Kepala Sekolah","Operator Sekolah","Tata Usaha (TU)","Guru","Admin IT","Lainnya"].map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="personalWa">No. WhatsApp Pribadi <span className="text-red-500">*</span></Label>
                        <Input id="personalWa" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} maxLength={16} className="h-11 rounded-xl" required />
                        <p className="text-[11px] text-muted-foreground">Untuk verifikasi akun & pemulihan password via OTP</p>
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="loginEmail">Email Login <span className="text-red-500">*</span></Label>
                        <Input id="loginEmail" type="email" placeholder="admin@sekolah.sch.id" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className="h-11 rounded-xl" required />
                        <p className="text-[11px] text-muted-foreground">Email ini digunakan untuk login ke dashboard</p>
                      </motion.div>
                      </>)}

                      {step === 3 && (<>
                      {/* ===== SECTION C: Keamanan ===== */}
                      <motion.div variants={itemVariants} className="pt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Keamanan Akun</p>
                            <p className="text-[11px] text-muted-foreground">Buat password yang kuat untuk melindungi data sekolah</p>
                          </div>
                        </div>
                      </motion.div>





                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="regPassword">Password</Label>
                        <div className="relative">
                          <Input
                            id="regPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min 8 karakter, huruf besar, angka, simbol"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11 pr-10 rounded-xl"
                            required
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {password.length > 0 && (
                          <div className="space-y-1 mt-1">
                            <div className="flex flex-wrap gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${passwordLongEnough ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {passwordLongEnough ? "✓" : "✗"} 8+ karakter
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${passwordHasUpper ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {passwordHasUpper ? "✓" : "✗"} Huruf besar
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${passwordHasNumber ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {passwordHasNumber ? "✓" : "✗"} Angka
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${passwordHasSymbol ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {passwordHasSymbol ? "✓" : "✗"} Simbol
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Ulangi password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-11 rounded-xl"
                          required
                        />
                      </motion.div>

                      <motion.div variants={itemVariants} className="space-y-2">
                        <Label htmlFor="referralCode">Kode Referral <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                        <Input
                          id="referralCode"
                          placeholder="Contoh: ATS-X7K29L"
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          className="h-11 font-mono tracking-wider rounded-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">Masukkan kode referral jika Anda mendapat undangan dari sekolah lain</p>
                      </motion.div>

                      <motion.div variants={itemVariants} className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <Checkbox id="tos" checked={agreeTos} onCheckedChange={(v) => setAgreeTos(v === true)} className="mt-0.5" />
                        <label htmlFor="tos" className="text-[12px] leading-relaxed text-muted-foreground cursor-pointer">
                          Saya menyatakan data yang diisi benar dan menyetujui{" "}
                          <a href="/terms" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Syarat & Ketentuan</a>{" "}
                          serta{" "}
                          <a href="/privacy" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Kebijakan Privasi</a>{" "}
                          ATSkolla.
                        </label>
                      </motion.div>
                      </>)}

                      {/* Navigation buttons */}
                      <motion.div variants={itemVariants} className="flex gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s))} className="h-11 rounded-xl">
                          Kembali
                        </Button>
                        {step < 3 ? (

                          <Button type="button" onClick={goNext} className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                            Lanjut →
                          </Button>
                        ) : (
                          <Button type="submit" disabled={registering || slugStatus !== "available" || !agreeTos} className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                            {registering ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Mendaftar...</> : "Daftar Sekarang"}
                          </Button>
                        )}
                      </motion.div>


                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-5 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  Sudah punya akun?{" "}
                  <Link to="/admin" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Masuk di sini</Link>
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          © 2026 ATSkolla — Platform Digital Sekolah
        </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
