import { ReactNode, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtIDR } from "../_shared";

export type Row = Record<string, any>;
export type Header = { key: string; label: string; type?: "money" | "status" | "date" | "number"; className?: string };

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

/**
 * Konsisten dengan modul Bendahara: PageHeader gradient primary + actions inline,
 * lalu card filter tipis `border-0 shadow-sm` dengan input h-9.
 */
export function ReportShell({
  title, subtitle, icon, from, to, onFromChange, onToChange, onDownload,
  summary, children, extraFilters, headerActions,
}: {
  title: string; subtitle: string; icon: any;
  from: string; to: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
  onDownload: () => void;
  summary?: ReactNode;
  extraFilters?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        variant="primary"
        actions={
          <div className="flex gap-2">
            {headerActions}
            <Button
              size="sm"
              onClick={onDownload}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/20"
            >
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
          </div>
        }
      />

      {summary}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 items-end">
          <div>
            <Label className="text-[10px] text-muted-foreground">Dari Tanggal</Label>
            <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Sampai Tanggal</Label>
            <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="h-9" />
          </div>
          {extraFilters}
        </CardContent>
      </Card>

      {children}
    </div>
  );
}

/**
 * Tabel bergaya Bendahara: shadcn Table, teks kecil, badge sekunder,
 * money mono kanan, hover, empty state, pagination client-side.
 */
export function ReportTable({
  loading, rows, headers, empty = "Belum ada data pada periode ini", pageSize: initialPageSize = 25,
}: {
  loading: boolean; rows: Row[]; headers: Header[]; empty?: string; pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead
                  key={h.key}
                  className={`whitespace-nowrap text-[11px] uppercase tracking-wider ${
                    h.type === "money" || h.type === "number" ? "text-right" : ""
                  } ${h.className || ""}`}
                >
                  {h.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center py-10 text-sm text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : visible.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/40">
                {headers.map((h) => {
                  const v = row[h.key];
                  const isMoney = h.type === "money";
                  const isNum = h.type === "number";
                  return (
                    <TableCell
                      key={h.key}
                      className={`${isMoney || isNum ? "text-right font-mono text-sm" : "text-sm"} ${h.className || ""}`}
                    >
                      {h.type === "status" ? (
                        <StatusBadge value={v} />
                      ) : isMoney ? (
                        typeof v === "number" ? (
                          <span className={v < 0 ? "text-rose-600" : v > 0 ? "" : "text-muted-foreground"}>
                            {fmtIDR(v)}
                          </span>
                        ) : <span className="text-muted-foreground">-</span>
                      ) : (
                        v === null || v === undefined || v === "" ? <span className="text-muted-foreground">-</span> : String(v)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2.5 border-t border-border/40 bg-muted/20 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Menampilkan {start + 1}–{Math.min(start + pageSize, total)} dari {total}</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-7 w-[80px] text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / hal</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 font-medium text-foreground">{safePage} / {totalPages}</span>
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function StatusBadge({ value }: { value: any }) {
  const v = String(value || "").toLowerCase();
  if (["paid", "success", "hadir", "approved", "completed", "settled", "lunas"].includes(v))
    return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border-0">{value}</Badge>;
  if (["pending", "menunggu", "processing"].includes(v))
    return <Badge className="text-[10px] bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border-0">{value}</Badge>;
  if (["unpaid", "failed", "alfa", "rejected", "expired", "belum bayar"].includes(v))
    return <Badge className="text-[10px] bg-rose-500/15 text-rose-700 hover:bg-rose-500/15 border-0">{value}</Badge>;
  if (["izin", "sakit"].includes(v))
    return <Badge className="text-[10px] bg-sky-500/15 text-sky-700 hover:bg-sky-500/15 border-0">{value}</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{value ?? "-"}</Badge>;
}

type StatItem = { label: string; value: string | number; sub?: string; tone?: string; icon?: any };
/**
 * Stat cards bergaya Bendahara BukuKas: `border-0 shadow-sm`, icon dalam
 * kotak berwarna 15%, value ekstra bold, subteks kecil.
 */
export function StatsRow({ items }: { items: StatItem[] }) {
  const tones: Record<string, { icon: string; value: string; bg?: string }> = {
    primary: { icon: "bg-[#5B6CF9]/15 text-[#5B6CF9]", value: "text-[#5B6CF9]", bg: "bg-gradient-to-br from-[#5B6CF9]/10 to-transparent" },
    emerald: { icon: "bg-emerald-500/15 text-emerald-600", value: "text-emerald-600" },
    rose: { icon: "bg-rose-500/15 text-rose-600", value: "text-rose-600" },
    sky: { icon: "bg-sky-500/15 text-sky-600", value: "text-sky-600" },
    amber: { icon: "bg-amber-500/15 text-amber-600", value: "text-amber-600" },
    violet: { icon: "bg-violet-500/15 text-violet-600", value: "text-violet-600" },
    indigo: { icon: "bg-indigo-500/15 text-indigo-600", value: "text-indigo-600" },
    slate: { icon: "bg-slate-500/15 text-slate-600", value: "text-slate-600" },
  };
  const cols =
    items.length <= 4 ? "grid-cols-2 md:grid-cols-4" :
    items.length === 5 ? "grid-cols-2 md:grid-cols-5" :
    "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
  return (
    <div className={`grid ${cols} gap-3`}>
      {items.map((it) => {
        const t = tones[it.tone || "primary"];
        const Icon = it.icon;
        return (
          <Card key={it.label} className={`border-0 shadow-sm overflow-hidden ${t.bg || ""}`}>
            <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
              <div className="flex items-center gap-2">
                {Icon && (
                  <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${t.icon}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                )}
                <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
                  {it.label}
                </p>
              </div>
              <div className="min-w-0">
                <p className={`text-base sm:text-lg font-extrabold ${t.value} break-words leading-tight`}>
                  {it.value}
                </p>
                {it.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{it.sub}</p>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function useMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { first, last };
}
