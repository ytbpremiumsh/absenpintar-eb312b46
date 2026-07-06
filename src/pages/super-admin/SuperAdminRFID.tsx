import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Radio, Plus, Copy, RefreshCw, Trash2, ShieldOff, Building2, Users, Cpu, AlertTriangle, Activity,
  Nfc, CheckCircle2, XCircle, Search, User as UserIcon, Loader2, School as SchoolIcon,
} from "lucide-react";

// ---------- helpers ----------
const genDeviceId = () =>
  `ATS-RFID-${Math.floor(100000 + Math.random() * 900000)}`;
const genActivationCode = () =>
  String(Math.floor(10000000 + Math.random() * 90000000));
const genSerial = () =>
  `SN${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random()*1e4).toString(36).toUpperCase()}`;

const statusMeta: Record<string, { label: string; cls: string }> = {
  unassigned:  { label: "Belum Ditugaskan", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  assigned:    { label: "Menunggu Aktivasi", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  active:      { label: "Aktif",             cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  inactive:    { label: "Offline",           cls: "bg-orange-100 text-orange-700 border-orange-200" },
  revoked:     { label: "Dicabut",           cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta[status] || { label: status, cls: "bg-slate-100 text-slate-700" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function timeAgo(iso: string | null) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))} dtk lalu`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return `${Math.floor(diff / 86_400_000)} hari lalu`;
}

// ---------- page ----------
export default function SuperAdminRFID() {
  const [tab, setTab] = useState("register");

  // ===== Student RFID registration state =====
  const [regSchoolId, setRegSchoolId] = useState<string>("");
  const [regSearch, setRegSearch] = useState("");
  const [regStudents, setRegStudents] = useState<any[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regTarget, setRegTarget] = useState<any | null>(null);
  const [regUid, setRegUid] = useState("");
  const [regSaving, setRegSaving] = useState(false);

  // ===== Test RFID state =====
  const [testSchoolId, setTestSchoolId] = useState<string>("");
  const [testUid, setTestUid] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; student?: any } | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const [devices, setDevices] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    device_id: "", serial_number: "", mac_address: "", school_id: "",
    location_label: "", notes: "",
  });
  const [createdToken, setCreatedToken] = useState<{ code: string } | null>(null);

  // detail dialog (logs)
  const [detail, setDetail] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  // tier form
  const [tierForm, setTierForm] = useState({ min_students: "", max_students: "", min_devices: "" });

  const load = async () => {
    setLoading(true);
    const [d, s, l, t] = await Promise.all([
      supabase.from("rfid_devices").select("*").order("created_at", { ascending: false }),
      supabase.from("schools").select("id, name, slug, rfid_mode").order("name"),
      supabase.from("rfid_device_licenses").select("*"),
      supabase.from("rfid_size_tiers").select("*").order("min_students"),
    ]);
    setDevices(d.data || []);
    setSchools(s.data || []);
    setLicenses(l.data || []);
    setTiers(t.data || []);

    // student counts per school
    const sc: Record<string, number> = {};
    if (s.data) {
      const ids = s.data.map((x: any) => x.id);
      if (ids.length) {
        const { data: st } = await supabase.from("students").select("id, school_id").in("school_id", ids);
        (st || []).forEach((r: any) => { sc[r.school_id] = (sc[r.school_id] || 0) + 1; });
      }
    }
    setStudentCounts(sc);

    // active device counts (active or inactive = licensed devices "in play")
    const ac: Record<string, number> = {};
    (d.data || []).forEach((r: any) => {
      if (r.school_id && (r.status === "active" || r.status === "inactive")) {
        ac[r.school_id] = (ac[r.school_id] || 0) + 1;
      }
    });
    setActiveCounts(ac);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const schoolById = useMemo(() => Object.fromEntries(schools.map((s) => [s.id, s])), [schools]);
  const licenseBySchool = useMemo(
    () => Object.fromEntries(licenses.map((l: any) => [l.school_id, l.license_count])),
    [licenses],
  );

  const minDevicesFor = (n: number) => {
    for (const t of [...tiers].sort((a, b) => b.min_students - a.min_students)) {
      if (n >= t.min_students && (t.max_students == null || n <= t.max_students)) return t.min_devices;
    }
    return 1;
  };

  const stats = useMemo(() => {
    const total = devices.length;
    const active = devices.filter((d) => d.status === "active").length;
    const offline = devices.filter((d) => d.status === "inactive").length;
    const revoked = devices.filter((d) => d.status === "revoked").length;
    const under = schools.filter((s) => {
      const req = minDevicesFor(studentCounts[s.id] || 0);
      const have = activeCounts[s.id] || 0;
      const lic = licenseBySchool[s.id] || 0;
      return have < req || lic < req;
    }).length;
    return { total, active, offline, revoked, under };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, schools, studentCounts, activeCounts, licenseBySchool, tiers]);

  // ------- add device -------
  const openAdd = () => {
    setAddForm({
      device_id: genDeviceId(),
      serial_number: genSerial(),
      mac_address: "",
      school_id: "",
      location_label: "",
      notes: "",
    });
    setCreatedToken(null);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const activation_code = genActivationCode();
    const { error } = await supabase.from("rfid_devices").insert({
      device_id: addForm.device_id,
      serial_number: addForm.serial_number,
      mac_address: addForm.mac_address || null,
      school_id: addForm.school_id || null,
      location_label: addForm.location_label || null,
      notes: addForm.notes || null,
      activation_code,
      status: addForm.school_id ? "assigned" : "unassigned",
    });
    if (error) return toast.error(error.message);
    setCreatedToken({ code: activation_code });
    toast.success("Perangkat berhasil dibuat");
    load();
  };

  const assignSchool = async (deviceId: string, schoolId: string | null) => {
    const { error } = await supabase
      .from("rfid_devices")
      .update({ school_id: schoolId || null, status: schoolId ? "assigned" : "unassigned" })
      .eq("id", deviceId);
    if (error) return toast.error(error.message);
    toast.success("Sekolah diperbarui");
    load();
  };

  const regenActivation = async (dev: any) => {
    const activation_code = genActivationCode();
    const { error } = await supabase
      .from("rfid_devices")
      .update({ activation_code, secret_token_hash: null, status: dev.school_id ? "assigned" : "unassigned" })
      .eq("id", dev.id);
    if (error) return toast.error(error.message);
    toast.success(`Kode aktivasi baru: ${activation_code}`);
    load();
  };

  const revokeDevice = async (dev: any) => {
    if (!confirm(`Cabut perangkat ${dev.device_id}?`)) return;
    const { error } = await supabase
      .from("rfid_devices")
      .update({ status: "revoked", secret_token_hash: null })
      .eq("id", dev.id);
    if (error) return toast.error(error.message);
    toast.success("Perangkat dicabut");
    load();
  };

  const deleteDevice = async (dev: any) => {
    if (!confirm(`Hapus permanen perangkat ${dev.device_id}? Log terkait juga akan dihapus.`)) return;
    const { error } = await supabase.from("rfid_devices").delete().eq("id", dev.id);
    if (error) return toast.error(error.message);
    toast.success("Perangkat dihapus");
    load();
  };

  const openDetail = async (dev: any) => {
    setDetail(dev);
    const { data } = await supabase
      .from("rfid_device_logs")
      .select("*")
      .eq("device_ref", dev.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs(data || []);
  };

  // ------- licenses -------
  const setLicense = async (school_id: string, license_count: number) => {
    const existing = licenses.find((l: any) => l.school_id === school_id);
    if (existing) {
      const { error } = await supabase
        .from("rfid_device_licenses")
        .update({ license_count: Math.max(0, license_count) })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("rfid_device_licenses")
        .insert({ school_id, license_count: Math.max(0, license_count) });
      if (error) return toast.error(error.message);
    }
    load();
  };

  // ------- tiers -------
  const addTier = async () => {
    const min = parseInt(tierForm.min_students, 10);
    const max = tierForm.max_students === "" ? null : parseInt(tierForm.max_students, 10);
    const dev = parseInt(tierForm.min_devices, 10);
    if (isNaN(min) || isNaN(dev)) return toast.error("Isi minimal siswa & minimal perangkat");
    const { error } = await supabase.from("rfid_size_tiers").insert({
      min_students: min, max_students: max, min_devices: dev,
    });
    if (error) return toast.error(error.message);
    setTierForm({ min_students: "", max_students: "", min_devices: "" });
    load();
  };

  const deleteTier = async (id: string) => {
    if (!confirm("Hapus aturan tier ini?")) return;
    const { error } = await supabase.from("rfid_size_tiers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // ------- Student RFID registration (Super Admin helper) -------
  const loadRegStudents = async (schoolId: string) => {
    if (!schoolId) { setRegStudents([]); return; }
    setRegLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, name, class, student_id, rfid_uid, school_id, photo_url")
      .eq("school_id", schoolId)
      .order("class", { ascending: true })
      .order("name", { ascending: true });
    setRegLoading(false);
    if (error) return toast.error(error.message);
    setRegStudents(data || []);
  };

  useEffect(() => { loadRegStudents(regSchoolId); }, [regSchoolId]);

  const openRegister = (s: any) => {
    setRegTarget(s);
    setRegUid(s.rfid_uid || "");
  };

  const saveStudentRfid = async () => {
    if (!regTarget) return;
    const uid = regUid.trim();
    if (uid.length < 4) return toast.error("UID RFID minimal 4 karakter");
    setRegSaving(true);
    // Cek konflik di sekolah yang sama
    const { data: existing } = await supabase
      .from("students")
      .select("id, name, class")
      .eq("school_id", regTarget.school_id)
      .eq("rfid_uid", uid)
      .neq("id", regTarget.id)
      .maybeSingle();
    if (existing) {
      setRegSaving(false);
      return toast.error(`UID sudah dipakai: ${existing.name} (${existing.class})`);
    }
    const { error } = await (supabase as any).from("students")
      .update({ rfid_uid: uid }).eq("id", regTarget.id);
    setRegSaving(false);
    if (error) return toast.error("Gagal simpan: " + error.message);
    toast.success(`RFID ${regTarget.name} tersimpan`);
    setRegTarget(null); setRegUid("");
    loadRegStudents(regSchoolId);
  };

  const removeStudentRfid = async () => {
    if (!regTarget) return;
    setRegSaving(true);
    const { error } = await (supabase as any).from("students")
      .update({ rfid_uid: null }).eq("id", regTarget.id);
    setRegSaving(false);
    if (error) return toast.error(error.message);
    toast.success("RFID dilepas");
    setRegTarget(null); setRegUid("");
    loadRegStudents(regSchoolId);
  };

  // ------- Test RFID -------
  const runTest = async () => {
    const uid = testUid.trim();
    if (!uid) return setTestResult({ ok: false, msg: "Tempelkan kartu terlebih dahulu" });
    setTestBusy(true);
    let q = supabase.from("students")
      .select("id, name, class, student_id, rfid_uid, school_id, schools(name)")
      .eq("rfid_uid", uid);
    if (testSchoolId) q = q.eq("school_id", testSchoolId);
    const { data, error } = await q.maybeSingle();
    setTestBusy(false);
    if (error) return setTestResult({ ok: false, msg: error.message });
    if (data) setTestResult({ ok: true, msg: "Kartu dikenali", student: data });
    else setTestResult({ ok: false, msg: `UID "${uid}" belum terdaftar${testSchoolId ? " di sekolah ini" : ""}` });
  };

  const filteredRegStudents = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    if (!q) return regStudents;
    return regStudents.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      s.class?.toLowerCase().includes(q) ||
      s.student_id?.toLowerCase().includes(q) ||
      (s.rfid_uid || "").toLowerCase().includes(q),
    );
  }, [regStudents, regSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
          <Radio className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">USB RFID</h1>
          <p className="text-sm text-muted-foreground">Manajemen perangkat, lisensi, mode RFID per sekolah, dan aktivitas perangkat resmi ATSkolla.</p>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Cpu}    color="from-slate-500 to-slate-700"    label="Total"   value={stats.total} />
        <StatCard icon={Activity} color="from-emerald-500 to-emerald-600" label="Aktif"   value={stats.active} />
        <StatCard icon={ShieldOff} color="from-orange-500 to-amber-600" label="Offline" value={stats.offline} />
        <StatCard icon={Trash2}  color="from-rose-500 to-red-600"      label="Dicabut" value={stats.revoked} />
        <StatCard icon={AlertTriangle} color="from-yellow-500 to-amber-600" label="Sekolah Kurang" value={stats.under} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="register">Kartu Siswa</TabsTrigger>
          <TabsTrigger value="test">Test Kartu</TabsTrigger>
          <TabsTrigger value="devices">Perangkat</TabsTrigger>
          <TabsTrigger value="licenses">Lisensi Sekolah</TabsTrigger>
          <TabsTrigger value="tiers">Aturan Ukuran</TabsTrigger>
        </TabsList>

        {/* ===== Register student RFID (Super Admin helper) ===== */}
        <TabsContent value="register" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Nfc className="h-4 w-4 text-emerald-600" /> Daftarkan Kartu RFID Siswa
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Bantu sekolah mendaftarkan kartu siswa dengan USB RFID Reader. Pilih sekolah, cari siswa, lalu tempelkan kartu pada reader.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label className="text-xs">Sekolah</Label>
                  <Select value={regSchoolId || "__none"} onValueChange={(v) => setRegSchoolId(v === "__none" ? "" : v)}>
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="Pilih sekolah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Pilih sekolah —</SelectItem>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Cari Siswa</Label>
                  <div className="relative mt-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={regSearch}
                      onChange={(e) => setRegSearch(e.target.value)}
                      placeholder="Nama, NIS, kelas, atau UID..."
                      className="pl-9 h-10"
                      disabled={!regSchoolId}
                    />
                  </div>
                </div>
              </div>

              {!regSchoolId ? (
                <div className="text-sm text-muted-foreground text-center py-10 border border-dashed rounded-lg">
                  <SchoolIcon className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  Pilih sekolah untuk memuat daftar siswa.
                </div>
              ) : regLoading ? (
                <div className="text-sm text-muted-foreground text-center py-10">Memuat siswa…</div>
              ) : filteredRegStudents.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">Tidak ada siswa cocok.</div>
              ) : (
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Siswa</th>
                        <th className="text-left px-3 py-2">Kelas</th>
                        <th className="text-left px-3 py-2">NIS</th>
                        <th className="text-left px-3 py-2">UID RFID</th>
                        <th className="text-right px-3 py-2">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegStudents.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                                {s.photo_url ? <img src={s.photo_url} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                              </div>
                              <span className="font-medium">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs">{s.class}</td>
                          <td className="px-3 py-2 text-xs font-mono">{s.student_id}</td>
                          <td className="px-3 py-2 text-xs">
                            {s.rfid_uid ? (
                              <span className="inline-flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {s.rfid_uid}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">belum ada</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant={s.rfid_uid ? "outline" : "default"} className="gap-1.5" onClick={() => openRegister(s)}>
                              <Nfc className="h-3.5 w-3.5" />
                              {s.rfid_uid ? "Ubah" : "Daftar"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Test card ===== */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Nfc className="h-4 w-4 text-[#5B6CF9]" /> Test Kartu RFID
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Verifikasi reader & pastikan kartu sudah terdaftar untuk siswa yang benar.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Batasi Sekolah (opsional)</Label>
                  <Select value={testSchoolId || "__all"} onValueChange={(v) => { setTestSchoolId(v === "__all" ? "" : v); setTestResult(null); }}>
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="Semua sekolah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">— Semua sekolah —</SelectItem>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">UID Kartu</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      autoFocus
                      value={testUid}
                      onChange={(e) => { setTestUid(e.target.value); setTestResult(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") runTest(); }}
                      placeholder="Tempel kartu pada reader…"
                      className="font-mono tracking-wider h-10"
                    />
                    <Button onClick={runTest} disabled={testBusy || !testUid.trim()} className="h-10 gap-1.5">
                      {testBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Cek
                    </Button>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={`rounded-lg border p-3 ${testResult.ok ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"}`}>
                  <div className="flex items-start gap-2">
                    {testResult.ok
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                      : <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />}
                    <div className="text-sm">
                      <p className={`font-semibold ${testResult.ok ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
                        {testResult.msg}
                      </p>
                      {testResult.student && (
                        <div className="mt-2 space-y-0.5 text-muted-foreground text-xs">
                          <p><b className="text-foreground">{testResult.student.name}</b> — {testResult.student.class}</p>
                          <p>NIS: <span className="font-mono">{testResult.student.student_id}</span></p>
                          <p>UID: <span className="font-mono">{testResult.student.rfid_uid}</span></p>
                          {testResult.student.schools?.name && (
                            <p>Sekolah: {testResult.student.schools.name}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Devices ===== */}
        <TabsContent value="devices" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Tambah Perangkat
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Device ID</th>
                    <th className="text-left px-3 py-2">Serial / MAC</th>
                    <th className="text-left px-3 py-2">Sekolah</th>
                    <th className="text-left px-3 py-2">Lokasi</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Last Online</th>
                    <th className="text-right px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Memuat…</td></tr>
                  )}
                  {!loading && devices.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada perangkat.</td></tr>
                  )}
                  {devices.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">
                        <button className="hover:underline text-left" onClick={() => openDetail(d)}>{d.device_id}</button>
                        <div className="text-[10px] text-muted-foreground">Kode: {d.activation_code}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-mono">{d.serial_number}</div>
                        <div className="text-muted-foreground">{d.mac_address || "-"}</div>
                      </td>
                      <td className="px-3 py-2 min-w-[180px]">
                        <Select
                          value={d.school_id || "__none"}
                          onValueChange={(v) => assignSchool(d.id, v === "__none" ? null : v)}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Belum ditugaskan" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">— Belum ditugaskan —</SelectItem>
                            {schools.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-xs">{d.location_label || "-"}</td>
                      <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                      <td className="px-3 py-2 text-xs">{timeAgo(d.last_online_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => regenActivation(d)} title="Reset kode aktivasi & token">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => revokeDevice(d)} title="Cabut">
                            <ShieldOff className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteDevice(d)} title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Licenses ===== */}
        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Lisensi per Sekolah</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Sekolah</th>
                    <th className="text-left px-3 py-2">Siswa</th>
                    <th className="text-left px-3 py-2">Mode</th>
                    <th className="text-left px-3 py-2">Min. Perangkat</th>
                    <th className="text-left px-3 py-2">Terpasang</th>
                    <th className="text-left px-3 py-2">Lisensi</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s) => {
                    const nStu = studentCounts[s.id] || 0;
                    const need = minDevicesFor(nStu);
                    const have = activeCounts[s.id] || 0;
                    const lic = licenseBySchool[s.id] || 0;
                    const ok = lic >= need && have >= need;
                    const overLicensed = have > lic;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2"><span className="inline-flex items-center gap-1 text-xs"><Users className="h-3 w-3" />{nStu}</span></td>
                        <td className="px-3 py-2">
                          <Select
                            value={(s as any).rfid_mode || "online"}
                            onValueChange={async (v) => {
                              const { error } = await (supabase as any).from("schools").update({ rfid_mode: v }).eq("id", s.id);
                              if (error) return toast.error(error.message);
                              setSchools((prev) => prev.map((x: any) => x.id === s.id ? { ...x, rfid_mode: v } : x));
                              toast.success("Mode RFID diperbarui");
                            }}
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="online">RFID Online</SelectItem>
                              <SelectItem value="usb">USB RFID Reader</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-xs">{need}</td>
                        <td className="px-3 py-2 text-xs">{have}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setLicense(s.id, lic - 1)}>-</Button>
                            <span className="min-w-[28px] text-center text-sm font-medium">{lic}</span>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setLicense(s.id, lic + 1)}>+</Button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {ok
                            ? <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">OK</Badge>
                            : overLicensed
                              ? <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">Melebihi</Badge>
                              : <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Kurang</Badge>}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          Butuh {Math.max(0, need - have)} perangkat lagi
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Tiers ===== */}
        <TabsContent value="tiers" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Tambah Aturan Tier</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Min. Siswa</Label>
                <Input value={tierForm.min_students} onChange={(e) => setTierForm({ ...tierForm, min_students: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Max. Siswa (kosong = tanpa batas)</Label>
                <Input value={tierForm.max_students} onChange={(e) => setTierForm({ ...tierForm, max_students: e.target.value })} placeholder="300" />
              </div>
              <div>
                <Label className="text-xs">Min. Perangkat</Label>
                <Input value={tierForm.min_devices} onChange={(e) => setTierForm({ ...tierForm, min_devices: e.target.value })} placeholder="1" />
              </div>
              <div className="flex items-end"><Button onClick={addTier} className="w-full">Tambah</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Rentang Siswa</th>
                    <th className="text-left px-3 py-2">Min. Perangkat</th>
                    <th className="text-right px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2">{t.min_students} – {t.max_students ?? "∞"}</td>
                      <td className="px-3 py-2">{t.min_devices}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => deleteTier(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Add device dialog ===== */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setCreatedToken(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdToken ? "Perangkat Berhasil Dibuat" : "Tambah Perangkat RFID"}</DialogTitle>
            <DialogDescription>
              {createdToken
                ? "Simpan kode aktivasi ini. Perangkat akan menerima Secret Token setelah proses aktivasi."
                : "Isi detail perangkat. Kode aktivasi 8 digit akan dibuat otomatis."}
            </DialogDescription>
          </DialogHeader>

          {!createdToken ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Device ID</Label><Input value={addForm.device_id} onChange={(e) => setAddForm({ ...addForm, device_id: e.target.value })} /></div>
              <div><Label>Serial Number</Label><Input value={addForm.serial_number} onChange={(e) => setAddForm({ ...addForm, serial_number: e.target.value })} /></div>
              <div><Label>MAC Address</Label><Input value={addForm.mac_address} onChange={(e) => setAddForm({ ...addForm, mac_address: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" /></div>
              <div>
                <Label>Sekolah</Label>
                <Select value={addForm.school_id || "__none"} onValueChange={(v) => setAddForm({ ...addForm, school_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Belum ditugaskan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Belum ditugaskan —</SelectItem>
                    {schools.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Lokasi</Label><Input value={addForm.location_label} onChange={(e) => setAddForm({ ...addForm, location_label: e.target.value })} placeholder="Gerbang Utama" /></div>
              <div className="md:col-span-2"><Label>Catatan</Label><Textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} /></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 bg-muted/40">
                <div className="text-xs text-muted-foreground">Device ID</div>
                <div className="font-mono font-bold">{addForm.device_id}</div>
              </div>
              <div className="rounded-lg border p-3 bg-emerald-50 border-emerald-200">
                <div className="text-xs text-emerald-800">Kode Aktivasi (bagikan ke teknisi)</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="font-mono text-2xl font-bold tracking-widest text-emerald-800">{createdToken.code}</div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdToken.code); toast.success("Disalin"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Secret Token akan dihasilkan otomatis saat perangkat melakukan aktivasi pertama ke endpoint <code>/functions/v1/rfid-device</code>. Token asli hanya ditampilkan sekali kepada perangkat.
              </div>
            </div>
          )}

          <DialogFooter>
            {!createdToken
              ? <><Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button><Button onClick={submitAdd}>Buat Perangkat</Button></>
              : <Button onClick={() => setAddOpen(false)}>Tutup</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Detail / Logs dialog ===== */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setLogs([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">{detail?.device_id}</DialogTitle>
            <DialogDescription>
              {schoolById[detail?.school_id]?.name || "Belum ditugaskan"} • Serial {detail?.serial_number} • Status <StatusBadge status={detail?.status} />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <div className="text-xs uppercase text-muted-foreground font-semibold">Log Aktivitas (100 terakhir)</div>
            {logs.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Belum ada aktivitas.</div>}
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border p-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">{l.event_type}</span>
                  <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("id-ID")}</span>
                </div>
                {l.payload && Object.keys(l.payload).length > 0 && (
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">{JSON.stringify(l.payload, null, 0)}</pre>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Register student RFID dialog ===== */}
      <Dialog open={!!regTarget} onOpenChange={(o) => { if (!o) { setRegTarget(null); setRegUid(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Nfc className="h-5 w-5 text-emerald-600" /> Daftarkan Kartu RFID
            </DialogTitle>
            <DialogDescription>
              {regTarget && (<>Tempelkan kartu pada USB RFID Reader untuk <b>{regTarget.name}</b> — {regTarget.class}.</>)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>UID Kartu</Label>
              <Input
                autoFocus
                value={regUid}
                onChange={(e) => setRegUid(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && regUid.trim().length >= 4) saveStudentRfid(); }}
                placeholder="Tempel kartu atau ketik UID…"
                className="font-mono tracking-wider text-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Reader USB umumnya otomatis mengetik UID lalu menekan Enter.
              </p>
            </div>
            <div className="flex gap-2">
              {regTarget?.rfid_uid && (
                <Button variant="outline" onClick={removeStudentRfid} disabled={regSaving} className="text-destructive hover:text-destructive">
                  Lepas RFID
                </Button>
              )}
              <Button onClick={saveStudentRfid} disabled={regSaving || regUid.trim().length < 4} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {regSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Nfc className="h-4 w-4 mr-1" />}
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: any) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${color} text-white flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
