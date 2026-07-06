import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Database, Download, Upload, RefreshCw, Shield, Clock, HardDrive, Loader2,
  CheckCircle, AlertTriangle, Table2, BarChart3, FileDown, FileUp, Cloud,
  BookOpen, ExternalLink, Key, FolderOpen, Folder, FileText, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BackupStats {
  tables: number;
  total_rows: number;
  stats: Record<string, number>;
}

const SuperAdminBackup = () => {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [currentStats, setCurrentStats] = useState<BackupStats | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastBackupStats, setLastBackupStats] = useState<BackupStats | null>(null);
  const [lastBackupErrors, setLastBackupErrors] = useState<Record<string, string>>({});
  const [gdriveBackingUp, setGdriveBackingUp] = useState(false);
  const [lastGdriveBackupAt, setLastGdriveBackupAt] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string>("");
  const [showAllTables, setShowAllTables] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"upsert" | "replace">("upsert");
  const [importResult, setImportResult] = useState<any>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsRes, gdriveRes, clientIdRes] = await Promise.all([
        supabase.functions.invoke("database-backup", { body: { action: "stats" } }),
        supabase.functions.invoke("gdrive-backup", { body: { action: "check-gdrive-status" } }),
        supabase.from("platform_settings").select("value").eq("key", "google_client_id").maybeSingle(),
      ]);
      
      if (statsRes.data?.success) {
        setCurrentStats(statsRes.data.current);
        setLastBackupAt(statsRes.data.last_backup_at);
        setLastBackupStats(statsRes.data.last_backup_stats);
      }
      if (gdriveRes.data?.success) {
        setLastGdriveBackupAt(gdriveRes.data.last_backup_at);
      }
      if (clientIdRes.data?.value) {
        setGoogleClientId(clientIdRes.data.value);
      }
    } catch (err: any) {
      toast.error("Gagal memuat statistik: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(10);
    try {
      setExportProgress(30);
      const { data, error } = await supabase.functions.invoke("database-backup", {
        body: { action: "export" },
      });
      setExportProgress(80);
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Export gagal");

      // Wrap in a portable envelope { meta, backup } so import knows the schema/version
      const envelope = { meta: data.meta, backup: data.backup };
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atskolla-backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      const errCount = data.meta.errors ? Object.keys(data.meta.errors).length : 0;
      if (errCount > 0) {
        toast.warning(`Backup selesai dengan ${errCount} tabel error. ${data.meta.total_rows} baris dari ${data.meta.tables} tabel.`);
      } else {
        toast.success(`Backup berhasil! ${data.meta.total_rows} baris dari ${data.meta.tables} tabel`);
      }
      setLastBackupAt(data.meta.exported_at);
      setLastBackupStats({ tables: data.meta.tables, total_rows: data.meta.total_rows, stats: data.meta.stats });
      setLastBackupErrors(data.meta.errors || {});
    } catch (err: any) {
      toast.error("Gagal export: " + err.message);
    }
    setTimeout(() => { setExporting(false); setExportProgress(0); }, 1500);
  };

  const handleGdriveBackup = async () => {
    if (!googleClientId || googleClientId === "YOUR_GOOGLE_CLIENT_ID") {
      toast.error("Google Client ID belum dikonfigurasi. Lihat tutorial di bawah.");
      setShowTutorial(true);
      return;
    }

    setGdriveBackingUp(true);
    try {
      // Use Google OAuth implicit flow to get access token
      const redirectUri = window.location.origin + "/super-admin/backup";
      const scope = "https://www.googleapis.com/auth/drive.file";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;
      
      // Open popup for auth
      const popup = window.open(authUrl, "google_auth", "width=500,height=600,scrollbars=yes");
      
      if (!popup) {
        toast.error("Popup diblokir browser. Izinkan popup untuk situs ini.");
        setGdriveBackingUp(false);
        return;
      }

      // Poll for token from popup redirect
      const pollTimer = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(pollTimer);
            setGdriveBackingUp(false);
            return;
          }
          const popupUrl = popup.location.href;
          if (popupUrl.includes("access_token=")) {
            clearInterval(pollTimer);
            const hash = popupUrl.split("#")[1];
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            popup.close();

            if (!accessToken) {
              toast.error("Gagal mendapatkan token Google");
              setGdriveBackingUp(false);
              return;
            }

            // Now do the backup
            toast.info("Mengupload backup ke Google Drive...");
            const { data, error } = await supabase.functions.invoke("gdrive-backup", {
              body: { action: "backup-to-gdrive", google_access_token: accessToken },
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Backup gagal");

            toast.success(`Backup ke Google Drive berhasil! Folder: ${data.meta.folder}`);
            setLastGdriveBackupAt(data.meta.exported_at);
            setGdriveBackingUp(false);
          }
        } catch (_) {
          // Cross-origin error is expected until redirect happens
        }
      }, 1000);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollTimer);
        if (!popup.closed) popup.close();
        setGdriveBackingUp(false);
      }, 120000);

    } catch (err: any) {
      toast.error("Gagal backup ke Google Drive: " + err.message);
      setGdriveBackingUp(false);
    }
  };

  const handleSaveClientId = async () => {
    const input = prompt("Masukkan Google OAuth Client ID:");
    if (!input) return;

    const { error } = await supabase.from("platform_settings").upsert({
      key: "google_client_id",
      value: input.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" } as any);

    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      setGoogleClientId(input.trim());
      toast.success("Google Client ID berhasil disimpan!");
    }
  };

  const handleImport = async () => {
    if (!importFile) { toast.error("Pilih file backup JSON terlebih dahulu"); return; }
    if (importMode === "replace") {
      const ok = window.confirm(
        "MODE REPLACE akan MENGHAPUS semua data yang ada di tabel yang di-import lalu menggantinya dengan isi backup.\n\nAksi ini TIDAK DAPAT DIBATALKAN.\n\nLanjutkan?"
      );
      if (!ok) return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      // Accept envelope { meta, backup } or raw { table: [...] }
      const backup = parsed?.backup && typeof parsed.backup === "object" ? parsed.backup : parsed;
      const tableCount = Object.keys(backup || {}).length;
      if (!tableCount) throw new Error("File tidak berisi data tabel yang valid");

      toast.info(`Mengimport ${tableCount} tabel (mode ${importMode})...`);
      const { data, error } = await supabase.functions.invoke("database-backup", {
        body: { action: "import", backup, mode: importMode },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Import gagal");

      setImportResult(data);
      const { inserted, failed, tables } = data.summary || {};
      if (failed > 0) {
        toast.warning(`Import selesai: ${inserted} baris masuk, ${failed} gagal (${tables} tabel).`);
      } else {
        toast.success(`Import berhasil! ${inserted} baris di ${tables} tabel.`);
      }
      fetchStats();
    } catch (err: any) {
      toast.error("Gagal import: " + (err.message || String(err)));
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" }); }
    catch { return iso; }
  };

  const allTables = currentStats?.stats
    ? Object.entries(currentStats.stats).sort((a, b) => (b[1] as number) - (a[1] as number))
    : [];
  const topTables = showAllTables ? allTables : allTables.slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        icon={Database}
        title="Backup & Migrasi"
        subtitle="Export data platform, backup otomatis ke Google Drive, dan sistem pemulihan"
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? "—" : currentStats?.total_rows?.toLocaleString("id-ID") || "0"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">Total Record</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Table2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? "—" : currentStats?.tables || "0"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">Tabel Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${lastBackupAt ? "bg-success/10" : "bg-amber-500/10"}`}>
                <Clock className={`h-5 w-5 ${lastBackupAt ? "text-success" : "text-amber-500"}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground truncate max-w-[160px]">
                  {loading ? "—" : lastBackupAt ? formatDate(lastBackupAt) : "Belum pernah"}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">Backup Terakhir</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Backup */}
      <Card className="border-0 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Backup Manual (Download JSON)
          </h3>
        </div>
        <CardContent className="p-4 space-y-4">
          {exporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Mengexport data...</span>
                <span className="text-primary font-bold">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleExport}
              disabled={exporting || loading}
              className="gradient-primary hover:opacity-90 shadow-md h-10 px-6 gap-2"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : exportProgress === 100 ? <CheckCircle className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
              {exporting ? "Mengexport..." : exportProgress === 100 ? "Selesai!" : "Download Backup JSON"}
            </Button>
            <Button variant="outline" onClick={fetchStats} disabled={loading} className="h-10 gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {lastBackupStats && (
            <div className="rounded-xl border border-success/15 bg-success/[0.02] p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                <p className="text-xs font-semibold text-foreground">Backup Terakhir Berhasil</p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {lastBackupStats.total_rows?.toLocaleString("id-ID")} record dari {lastBackupStats.tables} tabel •{" "}
                {lastBackupAt && formatDate(lastBackupAt)}
              </p>
            </div>
          )}

          {Object.keys(lastBackupErrors).length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                {Object.keys(lastBackupErrors).length} tabel gagal di-backup
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {Object.entries(lastBackupErrors).slice(0, 5).map(([t, e]) => (
                  <li key={t}><code className="text-foreground">{t}</code>: {e}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import / Restore */}
      <Card className="border-0 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Import / Restore Database
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Pindahkan seluruh data ke website / instance lain. Upload file backup JSON hasil export.
          </p>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <p className="font-semibold">Peringatan:</p>
              <p><strong>Upsert</strong> menambah / memperbarui baris berdasarkan ID (aman, idempotent). <strong>Replace</strong> akan MENGHAPUS seluruh isi tabel sebelum mengisi ulang — hanya untuk migrasi ke database kosong.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                <FileUp className="h-3.5 w-3.5" /> File Backup JSON
              </label>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer hover:file:bg-primary/20"
              />
              {importFile && (
                <p className="text-[10px] text-muted-foreground truncate">{importFile.name} • {(importFile.size / 1024).toFixed(1)} KB</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium text-foreground">Mode</label>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
                className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
              >
                <option value="upsert">Upsert (aman)</option>
                <option value="replace">Replace (hapus & ganti)</option>
              </select>
            </div>
            <Button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="h-9 gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Mengimport..." : "Mulai Import"}
            </Button>
          </div>

          {importResult && (
            <div className="rounded-xl border border-success/15 bg-success/[0.03] p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                <p className="text-xs font-semibold text-foreground">Import Selesai</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {importResult.summary?.inserted?.toLocaleString("id-ID")} baris masuk •{" "}
                {importResult.summary?.failed || 0} gagal •{" "}
                {importResult.summary?.tables} tabel • mode {importResult.mode}
              </p>
              {importResult.stats && (
                <details className="text-[11px]">
                  <summary className="cursor-pointer text-primary font-medium">Lihat detail per tabel</summary>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/40 p-2 font-mono space-y-0.5">
                    {Object.entries(importResult.stats).map(([t, s]: any) => (
                      <div key={t} className="flex justify-between gap-2">
                        <span className="truncate">{t}</span>
                        <span className={s.failed > 0 ? "text-amber-600" : "text-muted-foreground"}>
                          {s.inserted}✓ {s.failed > 0 && `• ${s.failed}✗`}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>



      {/* Google Drive Backup */}
      <Card className="border-0 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            Backup ke Google Drive
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Upload backup otomatis ke Google Drive dengan folder per tanggal
          </p>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
            <div className="flex items-start gap-3">
              <FolderOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Struktur Folder di Google Drive</p>
                <div className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-lg p-3 space-y-0.5">
                  <p className="flex items-center gap-1.5"><Folder className="h-3 w-3" /> ATSkolla Backup/</p>
                  <p className="pl-4 flex items-center gap-1.5"><Folder className="h-3 w-3" /> 2026-04-11/</p>
                  <p className="pl-8 flex items-center gap-1.5"><FileText className="h-3 w-3" /> backup_2026-04-11T08-00-00.json</p>
                  <p className="pl-4 flex items-center gap-1.5"><Folder className="h-3 w-3" /> 2026-04-12/</p>
                  <p className="pl-8 flex items-center gap-1.5"><FileText className="h-3 w-3" /> backup_2026-04-12T08-00-00.json</p>
                </div>
              </div>
            </div>
          </div>

          {/* Google Client ID Status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Google Client ID:</span>
              {googleClientId && googleClientId !== "YOUR_GOOGLE_CLIENT_ID" ? (
                <span className="text-xs text-success font-medium inline-flex items-center gap-1">Terkonfigurasi <Check className="h-3 w-3" /></span>
              ) : (
                <span className="text-xs text-amber-500 font-medium">Belum dikonfigurasi</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSaveClientId} className="h-7 text-xs gap-1">
              <Key className="h-3 w-3" />
              {googleClientId && googleClientId !== "YOUR_GOOGLE_CLIENT_ID" ? "Ubah" : "Set"} Client ID
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleGdriveBackup}
              disabled={gdriveBackingUp || loading}
              className="bg-[#4285F4] hover:bg-[#3367D6] text-white shadow-md h-10 px-6 gap-2"
            >
              {gdriveBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              {gdriveBackingUp ? "Mengupload..." : "Backup ke Google Drive"}
            </Button>
          </div>

          {lastGdriveBackupAt && (
            <div className="rounded-xl border border-[#4285F4]/15 bg-[#4285F4]/[0.02] p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-[#4285F4]" />
                <p className="text-xs font-semibold text-foreground">Google Drive Backup Terakhir</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{formatDate(lastGdriveBackupAt)}</p>
            </div>
          )}

          <Button variant="ghost" onClick={() => setShowTutorial(!showTutorial)} className="text-xs gap-1.5 h-8 text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            {showTutorial ? "Sembunyikan" : "Lihat"} Tutorial Konfigurasi Google Drive
          </Button>

          {showTutorial && (
            <div className="rounded-xl border border-border bg-muted/10 p-5 space-y-4">
              <h4 className="text-sm font-bold text-foreground">Tutorial: Menghubungkan Google Drive</h4>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Buka Google Cloud Console</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Kunjungi{" "}
                      <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                        console.cloud.google.com <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      dan login dengan akun Google Anda.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Buat Project Baru</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Klik "Select a project" → "New Project" → beri nama (misal: "ATSkolla Backup") → klik "Create".
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Aktifkan Google Drive API</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Buka menu "APIs & Services" → "Library" → cari "Google Drive API" → klik "Enable".
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Buat OAuth Consent Screen</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Buka "APIs & Services" → "OAuth consent screen" → pilih "External" → isi nama aplikasi "ATSkolla Backup" → tambahkan scope <code className="bg-muted px-1 rounded text-[10px]">drive.file</code> → simpan.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">5</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Buat OAuth Client ID</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Buka "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" → pilih "Web application" → 
                      tambahkan Authorized redirect URIs:
                    </p>
                    <div className="bg-muted/50 rounded-lg p-2 mt-1.5">
                      <code className="text-[10px] text-primary break-all">{window.location.origin}/super-admin/backup</code>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Setelah dibuat, salin <strong>Client ID</strong> (format: xxx.apps.googleusercontent.com).
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">6</div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Simpan Client ID di ATSkolla</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Klik tombol "Set Client ID" di atas, lalu paste Client ID yang sudah disalin. Setelah itu, klik "Backup ke Google Drive" dan login dengan akun Google Anda.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-success text-white flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3.5 w-3.5" /></div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Selesai!</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Backup akan otomatis tersimpan di folder <strong>"ATSkolla Backup"</strong> di Google Drive Anda, 
                      terorganisir per tanggal (misal: ATSkolla Backup/2026-04-11/backup_xxx.json).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Stats */}
      {topTables.length > 0 && (
        <Card className="border-0 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Statistik Tabel
            </h3>
          </div>
          <CardContent className="p-4">
            <div className="space-y-2.5">
              {topTables.map(([table, count]) => {
                const maxCount = (allTables[0]?.[1] as number) || 1;
                const pct = maxCount > 0 ? ((count as number) / maxCount) * 100 : 0;
                return (
                  <div key={table} className="flex items-center gap-3">
                    <div className="w-36 sm:w-44 shrink-0">
                      <p className="text-xs font-medium text-foreground truncate">{table}</p>
                    </div>
                    <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-16 text-right">
                      {(count as number).toLocaleString("id-ID")}
                    </span>
                  </div>
                );
              })}
            </div>

            {allTables.length > 10 && (
              <div className="mt-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAllTables(!showAllTables)} className="text-[11px] h-7">
                  {showAllTables ? "Tampilkan 10 teratas" : `Tampilkan semua ${allTables.length} tabel`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="border-0 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Tips Keamanan Data
          </h3>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { icon: Shield, text: "Simpan backup di min. 2 lokasi berbeda" },
              { icon: Clock, text: "Lakukan backup rutin setiap minggu" },
              { icon: Cloud, text: "Gunakan Google Drive untuk keamanan cloud" },
              { icon: Database, text: "Verifikasi backup bisa di-restore" },
            ].map((tip, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-background p-2.5 border border-border/50">
                <tip.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground">{tip.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminBackup;
