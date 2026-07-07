import { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { fmtIDR } from "../_shared";

export type Row = Record<string, any>;
export type Header = { key: string; label: string; type?: "money" | "status" | "date" | "number" };

export function toCSV(rows: Row[], headers: Header[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadCSV(name: string, rows: Row[], headers: Header[]) {
  if (!rows.length) { toast.error("Tidak ada data untuk diunduh"); return; }
  const blob = new Blob(["\ufeff" + toCSV(rows, headers)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function ReportShell({
  title, subtitle, icon, from, to, onFromChange, onToChange, onDownload,
  summary, children, extraFilters,
}: {
  title: string; subtitle: string; icon: any;
  from: string; to: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
  onDownload: () => void;
  summary?: ReactNode;
  extraFilters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} icon={icon} />

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Filter Periode</CardTitle>
              <CardDescription>Semua data disinkronkan dari sistem sekolah</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {extraFilters}
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Dari</label>
                <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Sampai</label>
                <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <Button size="sm" onClick={onDownload}>
                <Download className="h-4 w-4 mr-1.5" /> Unduh CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {summary}

      {children}
    </div>
  );
}

export function ReportTable({
  loading, rows, headers, empty = "Belum ada data pada periode ini", maxRows = 1000,
}: {
  loading: boolean; rows: Row[]; headers: Header[]; empty?: string; maxRows?: number;
}) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!rows.length) return (
    <Card className="rounded-2xl"><CardContent className="p-10 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>
  );
  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="max-h-[620px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              {headers.map((h) => (
                <th key={h.key} className="text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground whitespace-nowrap">{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, maxRows).map((row, i) => (
              <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                {headers.map((h) => {
                  const v = row[h.key];
                  return (
                    <td key={h.key} className="px-3 py-2 whitespace-nowrap">
                      {h.type === "status" ? (
                        <StatusBadge value={v} />
                      ) : h.type === "money" ? (
                        typeof v === "number" ? fmtIDR(v) : "-"
                      ) : (
                        v === null || v === undefined || v === "" ? "-" : String(v)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div className="text-[11px] text-muted-foreground px-3 py-2 bg-muted/20 border-t">
          Menampilkan {maxRows} dari {rows.length} baris. Unduh CSV untuk data lengkap.
        </div>
      )}
    </Card>
  );
}

export function StatusBadge({ value }: { value: any }) {
  const v = String(value || "").toLowerCase();
  const tone =
    ["paid", "success", "hadir", "approved", "completed", "settled"].includes(v) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
    ["pending", "menunggu", "processing"].includes(v) ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
    ["unpaid", "failed", "alfa", "rejected", "expired"].includes(v) ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" :
    ["izin", "sakit"].includes(v) ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" :
    "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${tone}`}>{value ?? "-"}</span>;
}

export function StatsRow({ items }: { items: { label: string; value: string | number; tone?: string; icon?: any }[] }) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-600",
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {items.map((it) => (
        <div key={it.label} className={`p-3 rounded-2xl border border-border/50 bg-gradient-to-br ${tones[it.tone || "primary"]}`}>
          <div className="flex items-center justify-between mb-1">
            {it.icon && <it.icon className="h-4 w-4" />}
          </div>
          <div className="text-lg font-bold text-foreground">{it.value}</div>
          <div className="text-[11px] text-muted-foreground">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export function useMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { first, last };
}
