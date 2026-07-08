import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  TrendingUp, Wallet, AlertCircle, CheckCircle2, Loader2, Plus, Search, Link as LinkIcon,
  Receipt, ArrowDownToLine, Banknote, RefreshCw, FileText, MessageCircle, Mail, Copy,
  Download, Upload, ArrowLeft, User, Users, ChevronRight, ChevronDown, Eye, GraduationCap, Send, BarChart3, Landmark,
  Home, LayoutGrid, Grid3x3, CreditCard, ArrowUpRight, X, Pencil, Trash2, Percent,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { downloadSppInvoicePDF, generateSppInvoicePDF } from "@/lib/sppInvoicePDF";
import { PaymentIframeDialog } from "@/components/PaymentIframeDialog";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import type { PaymentChannelId } from "@/lib/paymentChannels";
import { brandPaymentUrl } from "@/lib/utils";
import { formatPaymentMethodLabel } from "@/lib/paymentMethod";
import { InstallmentDialog } from "@/components/bendahara/InstallmentDialog";

const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// Helper: format payment_method jadi label rapi
const formatPaymentMethod = (m?: string | null): { label: string; isOffline: boolean } => {
  const v = (m || "").toLowerCase();
  const isOffline = v === "offline_cash" || v === "offline_transfer";
  return { label: formatPaymentMethodLabel(m), isOffline };
};

// Helper: hitung tahun ajaran (Juli-Juni). Bulan 7-12 = year/year+1, bulan 1-6 = year-1/year
const academicYearOf = (month: number, year: number) => {
  if (month >= 7) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
};
const academicYearList = (currentYear: number) => {
  const arr: string[] = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) arr.push(`${y}/${y + 1}`);
  return arr;
};

// ============ Helpers Export Profesional (PDF & Excel) ============
const CURRENCY_KEYS = new Set(["Nominal","Denda","Total","Total Tagihan","Total Diterima","Total Bayar","Jumlah","Amount"]);
const IDR_FMT = '"Rp"#,##0;[Red]"Rp"#,##0;"-"';

/** Buat worksheet ber-style: header biru, zebra, border, format IDR, freeze, auto width. */
function buildStyledSheet(rows: Record<string, any>[], opts?: { title?: string; subtitle?: string; totalsLabel?: string }) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const header = opts?.title;
  const sub = opts?.subtitle;
  const preRows: any[][] = [];
  if (header) preRows.push([header]);
  if (sub) preRows.push([sub]);
  if (header || sub) preRows.push([]);
  const headerRowIdx = preRows.length; // 0-based
  const dataStart = headerRowIdx + 1;
  const aoa: any[][] = [
    ...preRows,
    keys,
    ...rows.map((r) => keys.map((k) => r[k])),
  ];
  // Baris total untuk kolom currency
  const totalsRow: any[] = [];
  let hasTotal = false;
  keys.forEach((k, i) => {
    if (CURRENCY_KEYS.has(k)) {
      hasTotal = true;
      totalsRow[i] = rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    } else if (i === 0) {
      totalsRow[i] = opts?.totalsLabel || "TOTAL";
    } else {
      totalsRow[i] = "";
    }
  });
  if (hasTotal) aoa.push(totalsRow);
  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  const border = {
    top: { style: "thin", color: { rgb: "D9DDE8" } },
    bottom: { style: "thin", color: { rgb: "D9DDE8" } },
    left: { style: "thin", color: { rgb: "D9DDE8" } },
    right: { style: "thin", color: { rgb: "D9DDE8" } },
  } as any;

  // Style baris judul & subjudul
  if (header) {
    const c = XLSXStyle.utils.encode_cell({ r: 0, c: 0 });
    (ws as any)[c].s = {
      font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "1F2437" } },
      alignment: { vertical: "center" },
    };
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, keys.length - 1) } });
  }
  if (sub) {
    const rIdx = header ? 1 : 0;
    const c = XLSXStyle.utils.encode_cell({ r: rIdx, c: 0 });
    (ws as any)[c].s = {
      font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "6B7280" } },
    };
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: Math.max(0, keys.length - 1) } });
  }

  // Header kolom
  keys.forEach((_k, ci) => {
    const addr = XLSXStyle.utils.encode_cell({ r: headerRowIdx, c: ci });
    (ws as any)[addr].s = {
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "5B6CF9" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border,
    };
  });

  // Body rows (zebra + currency)
  rows.forEach((r, ri) => {
    keys.forEach((k, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: dataStart + ri, c: ci });
      if (!(ws as any)[addr]) return;
      const isCurrency = CURRENCY_KEYS.has(k);
      (ws as any)[addr].s = {
        font: { name: "Calibri", sz: 10, color: { rgb: "1F2437" } },
        fill: { patternType: "solid", fgColor: { rgb: ri % 2 === 0 ? "FFFFFF" : "F5F7FB" } },
        alignment: { horizontal: isCurrency ? "right" : (typeof r[k] === "number" ? "right" : "left"), vertical: "center", wrapText: false },
        border,
        ...(isCurrency ? { numFmt: IDR_FMT } : {}),
      };
    });
  });

  // Totals row style
  if (hasTotal) {
    const rIdx = dataStart + rows.length;
    keys.forEach((k, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: rIdx, c: ci });
      if (!(ws as any)[addr]) (ws as any)[addr] = { t: "s", v: "" };
      const isCurrency = CURRENCY_KEYS.has(k);
      (ws as any)[addr].s = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "1F2437" } },
        alignment: { horizontal: isCurrency ? "right" : "left", vertical: "center" },
        border,
        ...(isCurrency ? { numFmt: IDR_FMT } : {}),
      };
    });
  }

  // Kolom width
  ws["!cols"] = keys.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...rows.map((r) => String(r[k] ?? "").length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 32) };
  });
  // Baris tinggi header
  ws["!rows"] = [];
  ws["!rows"][headerRowIdx] = { hpt: 22 };

  // Freeze pane di bawah header
  ws["!freeze"] = { xSplit: 0, ySplit: dataStart } as any;
  (ws as any)["!autofilter"] = { ref: XLSXStyle.utils.encode_range({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx + rows.length, c: Math.max(0, keys.length - 1) } }) };

  return ws;
}

/** PDF profesional: header brand, sub info, tabel grid berwarna, footer halaman + total. */
function buildStyledPdf(opts: {
  title: string;
  subtitle?: string;
  schoolName?: string;
  schoolNpsn?: string;
  meta?: string[]; // baris info tambahan
  orientation?: "l" | "p";
  columns: { header: string; dataKey: string; align?: "left" | "right" | "center"; isCurrency?: boolean; width?: number }[];
  rows: Record<string, any>[];
  fileName: string;
}) {
  const doc = new jsPDF(opts.orientation || "l", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header band brand
  doc.setFillColor(91, 108, 249);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(opts.title.toUpperCase(), 12, 10);
  if (opts.schoolName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(opts.schoolName, 12, 16.5);
  }
  // Accent bar
  doc.setFillColor(255, 214, 88);
  doc.rect(0, 22, pageW, 1.5, "F");

  // Meta block
  let y = 30;
  doc.setTextColor(31, 36, 55);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  if (opts.subtitle) { doc.text(opts.subtitle, 12, y); y += 5; }
  doc.setFont("helvetica", "normal");
  if (opts.schoolNpsn) { doc.text(`NPSN: ${opts.schoolNpsn}`, 12, y); y += 4.5; }
  (opts.meta || []).forEach((m) => { doc.text(m, 12, y); y += 4.5; });
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 12, y);
  y += 3;

  // Totals summary
  const currencyCols = opts.columns.filter((c) => c.isCurrency);
  const totals: Record<string, number> = {};
  currencyCols.forEach((c) => {
    totals[c.dataKey] = opts.rows.reduce((s, r) => s + (Number(r[c.dataKey]) || 0), 0);
  });

  autoTable(doc, {
    startY: y + 3,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => {
      const v = r[c.dataKey];
      if (c.isCurrency) return `Rp ${Number(v || 0).toLocaleString("id-ID")}`;
      return v == null ? "" : String(v);
    })),
    foot: currencyCols.length
      ? [opts.columns.map((c, i) => {
          if (i === 0) return "TOTAL";
          if (c.isCurrency) return `Rp ${(totals[c.dataKey] || 0).toLocaleString("id-ID")}`;
          return "";
        })]
      : undefined,
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: [217, 221, 232], lineWidth: 0.15, textColor: [31, 36, 55] },
    headStyles: { fillColor: [91, 108, 249], textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
    bodyStyles: { valign: "middle" },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    footStyles: { fillColor: [31, 36, 55], textColor: 255, fontStyle: "bold", halign: "right" },
    columnStyles: Object.fromEntries(opts.columns.map((c, i) => [i, { halign: c.align || (c.isCurrency ? "right" : "left"), cellWidth: c.width || "auto" }])) as any,
    margin: { left: 10, right: 10 },
    theme: "grid",
    didDrawPage: () => {
      // Footer
      const str = `Halaman ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(120, 125, 140);
      doc.text(str, pageW - 12, pageH - 6, { align: "right" });
      doc.text(opts.schoolName || "", 12, pageH - 6);
    },
  });

  doc.save(`${opts.fileName}.pdf`);
}


const monthsOfAcademicYear = (ay: string): { month: number; year: number; label: string }[] => {
  const [y1, y2] = ay.split("/").map(Number);
  const arr: { month: number; year: number; label: string }[] = [];
  for (let m = 7; m <= 12; m++) arr.push({ month: m, year: y1, label: `${MONTHS[m - 1]} ${y1}` });
  for (let m = 1; m <= 6; m++) arr.push({ month: m, year: y2, label: `${MONTHS[m - 1]} ${y2}` });
  return arr;
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: any = {
    paid: { c: "bg-emerald-500 hover:bg-emerald-500", t: "Lunas" },
    pending: { c: "bg-amber-500 hover:bg-amber-500", t: "Pending" },
    unpaid: { c: "bg-slate-400 hover:bg-slate-400", t: "Belum Bayar" },
    failed: { c: "bg-red-500 hover:bg-red-500", t: "Gagal" },
    expired: { c: "bg-slate-500 hover:bg-slate-500", t: "Expired" },
  };
  const v = map[status] || map.unpaid;
  return <Badge className={`${v.c} text-white whitespace-nowrap`}>{v.t}</Badge>;
};

export function StatCard({ label, value, icon: Icon, gradient = "from-emerald-500 to-teal-600", sub }: any) {
  // Unified card style matching Buku Kas: pastel icon square + colored value
  const toneMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-600" },
    teal:    { bg: "bg-teal-500/15",    text: "text-teal-600" },
    sky:     { bg: "bg-sky-500/15",     text: "text-sky-600" },
    indigo:  { bg: "bg-indigo-500/15",  text: "text-indigo-600" },
    violet:  { bg: "bg-violet-500/15",  text: "text-violet-600" },
    amber:   { bg: "bg-amber-500/15",   text: "text-amber-600" },
    orange:  { bg: "bg-orange-500/15",  text: "text-orange-600" },
    rose:    { bg: "bg-rose-500/15",    text: "text-rose-600" },
    red:     { bg: "bg-red-500/15",     text: "text-red-600" },
    slate:   { bg: "bg-slate-500/15",   text: "text-slate-600" },
    blue:    { bg: "bg-blue-500/15",    text: "text-blue-600" },
    cyan:    { bg: "bg-cyan-500/15",    text: "text-cyan-600" },
  };
  const m = (gradient || "").match(/from-([a-z]+)-/);
  const tone = toneMap[m?.[1] ?? "emerald"] || toneMap.emerald;
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-3 sm:p-4 flex flex-col gap-2 h-full">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 shrink-0 rounded-xl ${tone.bg} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${tone.text}`} />
          </div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{label}</p>
        </div>
        <div className="min-w-0">
          <p className={`text-base sm:text-lg font-extrabold break-words leading-tight ${tone.text}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Feature Flags (per-sekolah, dikontrol Super Admin) ============
const bendaharaFlagsCache: Record<string, { wa: boolean; offline: boolean; installment: boolean }> = {};
async function fetchBendaharaFlags(schoolId: string): Promise<{ wa: boolean; offline: boolean; installment: boolean }> {
  if (bendaharaFlagsCache[schoolId]) return bendaharaFlagsCache[schoolId];
  const { data } = await supabase
    .from("schools")
    .select("bendahara_wa_enabled, bendahara_offline_enabled, installment_enabled")
    .eq("id", schoolId)
    .maybeSingle();
  const flags = {
    wa: (data as any)?.bendahara_wa_enabled !== false,
    offline: (data as any)?.bendahara_offline_enabled !== false,
    installment: (data as any)?.installment_enabled !== false,
  };
  bendaharaFlagsCache[schoolId] = flags;
  return flags;
}
function useBendaharaFlags(schoolId?: string | null) {
  const [flags, setFlags] = useState<{ wa: boolean; offline: boolean; installment: boolean }>({ wa: true, offline: true, installment: true });
  useEffect(() => {
    if (!schoolId) return;
    let alive = true;
    // Invalidate cache on mount so toggles by super admin ter-refresh saat halaman dibuka ulang
    delete bendaharaFlagsCache[schoolId];
    fetchBendaharaFlags(schoolId).then(f => { if (alive) setFlags(f); });
    return () => { alive = false; };
  }, [schoolId]);
  return flags;
}

// ============ DASHBOARD ============
export function BendaharaDashboard() {
  const { profile } = useAuth();
  const flags = useBendaharaFlags(profile?.school_id);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [cashBook, setCashBook] = useState<any[]>([]);
  const [studentGender, setStudentGender] = useState<Record<string, string>>({});
  const [showRecentPaid, setShowRecentPaid] = useState<boolean>(() => {
    const v = localStorage.getItem("bendahara_show_recent_paid");
    return v === null ? true : v === "1";
  });
  const toggleShowRecentPaid = () => {
    const next = !showRecentPaid;
    setShowRecentPaid(next);
    localStorage.setItem("bendahara_show_recent_paid", next ? "1" : "0");
  };
  // Detail pembayaran (klik siswa di Riwayat)
  const [detailInv, setDetailInv] = useState<any | null>(null);
  const [detailBusy, setDetailBusy] = useState<string | null>(null);

  // Kirim WA konfirmasi (teks SAMA untuk semua metode, hanya field "Metode" yang berbeda)
  const sendPaidConfirmationWa = async (inv: any) => {
    if (!inv?.parent_phone) { toast.error("Wali murid tidak punya nomor WA"); return; }
    const flags = await fetchBendaharaFlags(profile!.school_id);
    if (!flags.wa) { toast.error("Pengiriman WA dinonaktifkan Super Admin untuk sekolah ini"); return; }
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", profile!.school_id).maybeSingle();
    const schoolName = schoolRow?.name || "Sekolah";
    const tgl = inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
    const metode = formatPaymentMethod(inv.payment_method).label;
    const msg = `*${schoolName} — Konfirmasi Pembayaran SPP*\n\nYth. Bapak/Ibu *${inv.parent_name || "Wali"}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : ${fmtIDR(inv.total_amount)}\n• Metode  : ${metode}\n• Tanggal : ${tgl}\n\nTerima kasih atas pembayarannya.`;
    setDetailBusy(`wa-${inv.id}`);
    toast.loading("Mengirim WA konfirmasi...");
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { school_id: profile!.school_id, phone: inv.parent_phone, message: msg, message_type: "spp_paid" },
    });
    toast.dismiss(); setDetailBusy(null);
    if (error) toast.error("Gagal kirim WA"); else toast.success("Konfirmasi terkirim ke WA wali");
  };

  const downloadDetailPdf = async (inv: any) => {
    if (!profile?.school_id) return;
    setDetailBusy(`pdf-${inv.id}`);
    try {
      const { data: schoolRow } = await supabase.from("schools").select("name, address, city, province, npsn").eq("id", profile.school_id).maybeSingle();
      await downloadSppInvoicePDF({
        invoice: {
          invoice_number: inv.invoice_number,
          student_name: inv.student_name,
          class_name: inv.class_name,
          period_label: inv.period_label,
          amount: inv.amount ?? inv.total_amount,
          denda: inv.denda || 0,
          total_amount: inv.total_amount,
          due_date: inv.due_date,
          paid_at: inv.paid_at,
          payment_method: inv.payment_method,
          status: inv.status,
          created_at: inv.created_at,
        },
        student: { student_id: inv.student_id, nisn: inv.nisn, parent_name: inv.parent_name },
        school: { name: schoolRow?.name || "Sekolah", address: schoolRow?.address, npsn: schoolRow?.npsn },
      });
      toast.success("Invoice diunduh");
    } catch (e: any) {
      toast.error("Gagal unduh invoice");
    } finally {
      setDetailBusy(null);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!profile?.school_id) { setLoading(false); return; }
    const [i, s, st, cb] = await Promise.all([
      supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id),
      supabase.from("spp_settlements").select("*").eq("school_id", profile.school_id),
      supabase.from("students").select("id, gender").eq("school_id", profile.school_id),
      supabase.from("cash_book_entries").select("direction, amount, entry_date").eq("school_id", profile.school_id),
    ]);
    setInvoices(i.data || []);
    setSettlements(s.data || []);
    setCashBook(cb.data || []);
    const map: Record<string, string> = {};
    (st.data || []).forEach((x: any) => { map[x.id] = (x.gender || "").toString().toUpperCase(); });
    setStudentGender(map);
    setLoading(false);
  }, [profile?.school_id]);

  // Render dashboard segera dari DB lokal (cepat). Sync gateway Mayar dijalankan
  // di background — realtime channel akan auto-refresh kalau ada invoice baru lunas.
  useEffect(() => {
    fetchDashboardData();
    if (profile?.school_id) {
      supabase.functions.invoke("spp-mayar", { body: { action: "sync_paid_invoices" } }).catch(() => null);
    }
  }, [fetchDashboardData, profile?.school_id]);

  useEffect(() => {
    if (!profile?.school_id) return;
    const channel = supabase
      .channel("bendahara-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices", filter: `school_id=eq.${profile.school_id}` }, () => fetchDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_settlements", filter: `school_id=eq.${profile.school_id}` }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.school_id, fetchDashboardData]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthInv = invoices.filter(i => i.period_year === now.getFullYear() && i.period_month === now.getMonth() + 1);
    const paid = invoices.filter(i => i.status === "paid");
    const pending = invoices.filter(i => i.status === "pending");
    const totalGross = paid.reduce((s, i) => s + (i.total_amount || 0), 0);
    const totalFee = paid.reduce((s, i) => s + (i.gateway_fee || 0), 0);
    const totalNet = paid.reduce((s, i) => s + (i.net_amount || 0), 0);
    const settled = settlements.filter(s => s.status === "paid").reduce((s, x) => s + (x.final_payout || 0), 0);
    const settleFee = settlements.filter(s => s.status === "paid").length * 3000;
    // Saldo siap cair = invoice online (bukan offline) yang sudah paid & belum di-settle
    const isOffline = (m: any) => {
      const v = (m || "").toString().toLowerCase();
      return v === "offline_cash" || v === "offline_transfer";
    };
    const readyToSettle = paid.filter((i: any) => !i.settlement_id && !isOffline(i.payment_method));
    // Saldo siap cair = BRUTO (sinkron dengan halaman Pencairan yang sudah tidak memotong gateway fee)
    const availableBalance = readyToSettle.reduce((s, i: any) => s + (i.total_amount || 0), 0);
    return {
      monthBills: monthInv.reduce((s, i) => s + (i.total_amount || 0), 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      tunggakan: pending.filter(i => new Date(i.due_date) < now).reduce((s, i) => s + (i.total_amount || 0), 0),
      totalGross, totalFee, totalNet, settled, settleFee,
      availableBalance: Math.max(0, availableBalance),
      pendingBalance: pending.reduce((s, i) => s + (i.total_amount || 0), 0),
    };
  }, [invoices, settlements]);

  const monthlyChart = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter(i => i.status === "paid" && i.paid_at).forEach(i => {
      const d = new Date(i.paid_at);
      const k = `${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear().toString().slice(2)}`;
      map[k] = (map[k] || 0) + (i.total_amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).slice(-6);
  }, [invoices]);

  const classChart = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter(i => i.status === "paid").forEach(i => {
      map[i.class_name] = (map[i.class_name] || 0) + (i.total_amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const tunggakanList = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { name: string; class: string; total: number; count: number }>();
    invoices.filter(i => i.status === "pending" && new Date(i.due_date) < now).forEach(i => {
      const e = map.get(i.student_id) || { name: i.student_name, class: i.class_name, total: 0, count: 0 };
      e.total += i.total_amount || 0; e.count += 1;
      map.set(i.student_id, e);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [invoices]);

  // Riwayat Siswa Membayar SPP (10 transaksi paid terakhir)
  const recentPaidList = useMemo(() => {
    return invoices
      .filter(i => i.status === "paid" && i.paid_at)
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      .slice(0, 10);
  }, [invoices]);

  const completionRate = useMemo(() => {
    if (invoices.length === 0) return 0;
    return Math.round((invoices.filter(i => i.status === "paid").length / invoices.length) * 100);
  }, [invoices]);

  // ============ Ringkasan Cepat (Hari/Bulan/Tahun/Jatuh Tempo/Saldo Kas) ============
  const quickMetrics = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const paid = invoices.filter(i => i.status === "paid" && i.paid_at);
    const incomeToday = paid.filter(i => (i.paid_at || "").slice(0, 10) === today).reduce((s, i) => s + (i.total_amount || 0), 0);
    const incomeMonth = paid.filter(i => {
      const d = new Date(i.paid_at); return d.getFullYear() === y && d.getMonth() + 1 === m;
    }).reduce((s, i) => s + (i.total_amount || 0), 0);
    const incomeYear = paid.filter(i => new Date(i.paid_at).getFullYear() === y).reduce((s, i) => s + (i.total_amount || 0), 0);
    const dueTodayList = invoices.filter(i => i.status !== "paid" && (i.due_date || "").slice(0, 10) === today);
    const monthInv = invoices.filter(i => i.period_year === y && i.period_month === m);
    const paidStudentsMonth = new Set(monthInv.filter(i => i.status === "paid").map(i => i.student_id)).size;
    const unpaidStudentsMonth = new Set(monthInv.filter(i => i.status !== "paid").map(i => i.student_id)).size;
    const cashIn = cashBook.filter((c: any) => c.direction === "in").reduce((s: number, c: any) => s + (c.amount || 0), 0);
    const cashOut = cashBook.filter((c: any) => c.direction === "out").reduce((s: number, c: any) => s + (c.amount || 0), 0);
    // Saldo kas total = kas manual (in - out) + saldo online siap dicairkan
    const readyOnline = invoices
      .filter((i: any) => i.status === "paid" && !i.settlement_id)
      .filter((i: any) => {
        const v = (i.payment_method || "").toString().toLowerCase();
        return v !== "offline_cash" && v !== "offline_transfer";
      })
      .reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
    const saldoKas = (cashIn - cashOut) + readyOnline;
    return {
      incomeToday, incomeMonth, incomeYear,
      dueTodayCount: dueTodayList.length,
      dueTodayTotal: dueTodayList.reduce((s, i) => s + (i.total_amount || 0), 0),
      dueTodayList: dueTodayList.slice(0, 5),
      paidStudentsMonth, unpaidStudentsMonth,
      saldoKas,
    };
  }, [invoices, cashBook]);

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <>
      {/* ==================== MOBILE — Fintech Payou-style (emerald) ==================== */}
      <BendaharaMobileDashboard
        stats={stats}
        completionRate={completionRate}
        recentPaidList={recentPaidList}
        tunggakanList={tunggakanList}
        onSelectPaid={(t) => setDetailInv(t)}
      />

      {/* ==================== DESKTOP / TABLET (md+) ==================== */}
      <div className="hidden md:block space-y-6">
      <PageHeader
        icon={Wallet}
        title="Dashboard Bendahara"
        subtitle="Ringkasan keuangan sekolah"
        variant="primary"
      />

      {/* Ringkasan utama — 6 metrik esensial (tanpa duplikasi) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Saldo Siap Cair" value={fmtIDR(stats.availableBalance)} sub="Online, belum di-settle" icon={Wallet} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Pemasukan Hari Ini" value={fmtIDR(quickMetrics.incomeToday)} icon={TrendingUp} gradient="from-emerald-500 to-lime-600" />
        <StatCard label="Pemasukan Bulan Ini" value={fmtIDR(quickMetrics.incomeMonth)} sub={`${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`} icon={BarChart3} gradient="from-[#5B6CF9] to-[#4c5ded]" />
        <StatCard label="Tunggakan" value={fmtIDR(stats.tunggakan)} sub={`${stats.pendingCount} pending`} icon={AlertCircle} gradient="from-rose-500 to-red-600" />
        <StatCard label="Jatuh Tempo Hari Ini" value={quickMetrics.dueTodayCount} sub={fmtIDR(quickMetrics.dueTodayTotal)} icon={AlertCircle} gradient="from-amber-500 to-orange-600" />
        <StatCard label="Total Saldo Kas" value={fmtIDR(quickMetrics.saldoKas)} sub="Kas manual + siap cair" icon={Banknote} gradient="from-sky-500 to-blue-600" />
      </div>

      {/* Progress pelunasan (ringkas, tanpa card berat) */}
      <div className="rounded-2xl bg-white dark:bg-card ring-1 ring-slate-200/70 dark:ring-slate-800/60 p-4 flex items-center gap-4">
        <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Persentase Pelunasan</p>
            <p className="text-sm font-extrabold text-emerald-600">{completionRate}% <span className="text-[10px] font-medium text-muted-foreground">• {stats.paidCount} lunas / {stats.pendingCount} pending</span></p>
          </div>
          <Progress value={completionRate} className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-600" />
        </div>
      </div>

      {quickMetrics.dueTodayList.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-600" /> Tagihan Jatuh Tempo Hari Ini</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {quickMetrics.dueTodayList.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{i.student_name} <span className="text-muted-foreground font-normal">• {i.class_name}</span></p>
                    <p className="text-[11px] text-muted-foreground">{i.period_label}</p>
                  </div>
                  <p className="font-mono font-semibold text-amber-600 shrink-0">{fmtIDR(i.total_amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Pembayaran Bulanan */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-card shadow-lg shadow-indigo-900/5 ring-1 ring-indigo-100 dark:ring-indigo-900/30">
          <div className="bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Pembayaran Bulanan</p>
                <p className="text-[10px] text-white/80 leading-tight">Tren 6 bulan terakhir</p>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20 text-[10px]">Total {fmtIDR(stats.totalGross)}</Badge>
          </div>
          <div className="p-4 bg-gradient-to-b from-indigo-50/40 to-transparent dark:from-indigo-950/10">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyChart}>
                <defs>
                  <linearGradient id="lineSky" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(243 75% 59%)" />
                    <stop offset="100%" stopColor="hsl(262 83% 58%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000000).toFixed(1)}jt`} />
                <Tooltip formatter={(v: any) => fmtIDR(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(243 60% 88%)" }} />
                <Line type="monotone" dataKey="value" stroke="url(#lineSky)" strokeWidth={3} dot={{ r: 4, fill: "hsl(243 75% 59%)" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pembayaran per Kelas */}
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-card shadow-lg shadow-indigo-900/5 ring-1 ring-indigo-100 dark:ring-indigo-900/30">
          <div className="bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Pembayaran per Kelas</p>
                <p className="text-[10px] text-white/80 leading-tight">Distribusi setoran per rombel</p>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20 text-[10px]">{classChart.length} kelas</Badge>
          </div>
          <div className="p-4 bg-gradient-to-b from-indigo-50/40 to-transparent dark:from-indigo-950/10">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={classChart}>
                <defs>
                  <linearGradient id="barIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(243 75% 59%)" />
                    <stop offset="100%" stopColor="hsl(262 83% 58%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000000).toFixed(1)}jt`} />
                <Tooltip formatter={(v: any) => fmtIDR(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(243 60% 88%)" }} />
                <Bar dataKey="value" fill="url(#barIndigo)" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      {/* RIWAYAT SISWA MEMBAYAR */}
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-card shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-100 dark:ring-emerald-900/30">
        <div className="bg-gradient-to-r from-[#5B6CF9] to-[#4c5ded] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Riwayat Siswa Membayar SPP</p>
              <p className="text-[10px] text-white/80 leading-tight">10 transaksi terbaru</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showRecentPaid && <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20 text-[10px]">{recentPaidList.length}</Badge>}
            <Button variant="ghost" size="sm" onClick={toggleShowRecentPaid} className="h-7 px-2 text-xs text-white hover:bg-white/15 hover:text-white">
              {showRecentPaid ? "Sembunyikan" : "Tampilkan"}
            </Button>
          </div>
        </div>
        {showRecentPaid && (
          <div>
            {recentPaidList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada pembayaran</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 [&_th]:whitespace-nowrap">
                    <TableHead className="text-emerald-800 dark:text-emerald-300 font-semibold">Tanggal</TableHead>
                    <TableHead className="text-emerald-800 dark:text-emerald-300 font-semibold">Siswa</TableHead>
                    <TableHead className="text-emerald-800 dark:text-emerald-300 font-semibold">Kelas</TableHead>
                    <TableHead className="text-emerald-800 dark:text-emerald-300 font-semibold">Periode</TableHead>
                    <TableHead className="text-emerald-800 dark:text-emerald-300 font-semibold">Metode</TableHead>
                    <TableHead className="text-emerald-800 dark:text-emerald-300 font-semibold text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPaidList.map((t, idx) => {
                    const m = formatPaymentMethod(t.payment_method);
                    return (
                    <TableRow key={t.id} onClick={() => setDetailInv(t)} className={`cursor-pointer transition-colors [&>td]:whitespace-nowrap ${idx % 2 === 0 ? "bg-white dark:bg-card" : "bg-emerald-50/30 dark:bg-emerald-950/10"} hover:bg-indigo-50/70 dark:hover:bg-indigo-950/20`}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{new Date(t.paid_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const g = studentGender[t.student_id] || "";
                            const isFemale = g === "P" || g === "F" || g.startsWith("PEREMPUAN") || g.startsWith("FEMALE");
                            const grad = isFemale
                              ? "from-rose-400 to-red-600"
                              : "from-[#5B6CF9] via-indigo-500 to-violet-600";
                            return (
                              <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-[11px] font-bold shadow-sm`}>
                                {(t.student_name || "?")[0]}
                              </div>
                            );
                          })()}
                          <span className="hover:underline">{t.student_name}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 hover:bg-indigo-100 border-0">{t.class_name}</Badge></TableCell>
                      <TableCell className="text-xs">{t.period_label}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={m.isOffline ? "border-slate-400 text-slate-700 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300" : "border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"}>
                          {m.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{fmtIDR(t.total_amount)}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* ============ DIALOG DETAIL PEMBAYARAN ============ */}
      <Dialog open={!!detailInv} onOpenChange={(o) => { if (!o) setDetailInv(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Detail Pembayaran SPP
            </DialogTitle>
            <DialogDescription>Informasi lengkap transaksi yang sudah lunas.</DialogDescription>
          </DialogHeader>
          {detailInv && (() => {
            const m = formatPaymentMethod(detailInv.payment_method);
            return (
              <div className="space-y-4 pt-1">
                {/* Header siswa */}
                <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-[#5B6CF9]/8 to-indigo-50 dark:from-indigo-950/30 dark:to-indigo-950/10 p-3 ring-1 ring-[#5B6CF9]/20">
                  {(() => {
                    const g = studentGender[detailInv.student_id] || "";
                    const isFemale = g === "P" || g === "F" || g.startsWith("PEREMPUAN") || g.startsWith("FEMALE");
                    const grad = isFemale ? "from-rose-400 to-red-600" : "from-[#5B6CF9] via-indigo-500 to-violet-600";
                    return (
                      <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-base font-bold shadow-md shrink-0`}>
                        {(detailInv.student_name || "?")[0]}
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{detailInv.student_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{detailInv.class_name} • {detailInv.period_label}</p>
                  </div>
                  <p className="font-extrabold text-sm text-emerald-600 shrink-0">{fmtIDR(detailInv.total_amount)}</p>
                </div>

                {/* Detail rinci */}
                <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-mono font-semibold">{detailInv.invoice_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tgl. Bayar</span><span className="font-semibold">{detailInv.paid_at ? new Date(detailInv.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Metode</span>
                    <Badge variant="outline" className={m.isOffline ? "border-slate-400 text-slate-700 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300" : "border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"}>
                      {m.isOffline ? <Banknote className="h-3 w-3 mr-1 inline" /> : <CreditCard className="h-3 w-3 mr-1 inline" />}
                      {m.label}
                    </Badge>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Wali Murid</span><span className="font-semibold truncate max-w-[60%] text-right">{detailInv.parent_name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">No. WA</span><span className="font-semibold">{detailInv.parent_phone || "-"}</span></div>
                </div>

                {m.isOffline && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 p-2.5 text-[11px] text-amber-800 dark:text-amber-200 flex gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Pembayaran offline — uang sudah diterima sekolah, tidak menambah saldo pencairan online.</span>
                  </div>
                )}

                {/* Aksi */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" disabled={detailBusy === `pdf-${detailInv.id}`} onClick={() => downloadDetailPdf(detailInv)}>
                    {detailBusy === `pdf-${detailInv.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Invoice PDF
                  </Button>
                  {flags.wa && (
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!detailInv.parent_phone || detailBusy === `wa-${detailInv.id}`} onClick={() => sendPaidConfirmationWa(detailInv)} title={!detailInv.parent_phone ? "Wali tidak punya nomor WA" : "Kirim konfirmasi via WA"}>
                      {detailBusy === `wa-${detailInv.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <MessageCircle className="h-4 w-4 mr-1.5" />}
                      Notif WA
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

// =================== MOBILE DASHBOARD (Bendahara) — Payou-style emerald ===================
function BendaharaMobileDashboard({
  stats, completionRate, recentPaidList, tunggakanList, onSelectPaid,
}: {
  stats: any; completionRate: number; recentPaidList: any[]; tunggakanList: any[]; onSelectPaid?: (t: any) => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="md:hidden -mx-4 -mt-4 pb-32 min-h-screen bg-gradient-to-b from-indigo-50/60 via-background to-background">
      {/* Top bar greeting */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bendahara</p>
          <p className="text-sm font-bold">Sistem Keuangan Sekolah</p>
        </div>
        <button
          onClick={() => navigate("/bendahara/laporan")}
          className="h-9 w-9 rounded-full bg-white shadow-sm ring-1 ring-border/60 flex items-center justify-center active:scale-95 transition"
          aria-label="Laporan"
        >
          <BarChart3 className="h-4 w-4 text-[#5B6CF9]" />
        </button>
      </div>

      <div className="px-4 space-y-4">
        {/* HERO CARD — primary brand gradient */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#5B6CF9] via-[#4c5ded] to-[#3D4FE0] text-white p-5 shadow-[0_20px_50px_-15px_rgba(91,108,249,0.55)]">
          <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 25% 0%, white 1.2px, transparent 1.2px), radial-gradient(circle at 75% 100%, white 1.2px, transparent 1.2px)", backgroundSize: "28px 28px" }} />

          <div className="relative flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur ring-1 ring-white/30 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Saldo Tersedia</p>
              <p className="text-[11px] text-white/80 truncate">Bisa dicairkan ke rekening</p>
            </div>
          </div>

          <div className="relative mt-4">
            <p className="text-[28px] font-extrabold tracking-tight leading-none break-all">{fmtIDR(stats.availableBalance)}</p>
            <p className="text-[11px] text-white/80 mt-1.5">
              Pelunasan {completionRate}% • {stats.paidCount} transaksi lunas
            </p>
          </div>

          {/* 3 quick actions */}
          <div className="relative mt-5 flex items-center justify-around">
            <button onClick={() => navigate("/bendahara/pencairan")} className="flex flex-col items-center gap-1.5 group">
              <div className="h-11 w-11 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center group-hover:bg-white/25 transition-all group-active:scale-95">
                <ArrowDownToLine className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-white/90">Cairkan</span>
            </button>
            <button onClick={() => navigate("/bendahara/transaksi")} className="flex flex-col items-center gap-1.5 group">
              <div className="h-11 w-11 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center group-hover:bg-white/25 transition-all group-active:scale-95">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-white/90">Pembayaran</span>
            </button>
            <button onClick={() => navigate("/bendahara/generate")} className="flex flex-col items-center gap-1.5 group">
              <div className="h-11 w-11 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/30 flex items-center justify-center group-hover:bg-white/25 transition-all group-active:scale-95">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-white/90">Tagihan</span>
            </button>
          </div>

          {/* Tunggakan banner pill */}
          {stats.tunggakan > 0 && (
            <button
              onClick={() => navigate("/bendahara/transaksi")}
              className="relative mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-rose-400 to-red-500 text-white font-semibold text-xs shadow-lg hover:opacity-95 transition-all active:scale-[0.98]"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Tunggakan: {fmtIDR(stats.tunggakan)} • {stats.pendingCount} pending
            </button>
          )}
        </div>

        {/* Mini stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3.5 bg-white dark:bg-card ring-1 ring-border/60 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tagihan Bln Ini</p>
                <p className="text-sm font-bold truncate">{fmtIDR(stats.monthBills)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-3.5 bg-white dark:bg-card ring-1 ring-border/60 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Lunas</p>
                <p className="text-sm font-bold truncate">{fmtIDR(stats.totalGross)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Service grid 4x2 — professional gradient tiles */}
        <div className="grid grid-cols-4 gap-3">
          <BendServiceIcon icon={Users} label="Siswa" gradient="from-indigo-500 to-violet-600" onClick={() => navigate("/bendahara/siswa")} />
          <BendServiceIcon icon={Receipt} label="Tarif SPP" gradient="from-indigo-500 to-violet-600" onClick={() => navigate("/bendahara/tarif")} />
          <BendServiceIcon icon={FileText} label="Generate" gradient="from-amber-500 to-orange-600" onClick={() => navigate("/bendahara/generate")} />
          <BendServiceIcon icon={CreditCard} label="Pembayaran" gradient="from-pink-500 to-rose-600" onClick={() => navigate("/bendahara/transaksi")} />
          <BendServiceIcon icon={Upload} label="Import" gradient="from-violet-500 to-purple-600" onClick={() => navigate("/bendahara/import-export")} />
          <BendServiceIcon icon={Wallet} label="Saldo" gradient="from-sky-500 to-blue-600" onClick={() => navigate("/bendahara/saldo")} />
          <BendServiceIcon icon={ArrowDownToLine} label="Pencairan" gradient="from-rose-500 to-red-600" onClick={() => navigate("/bendahara/pencairan")} />
          <BendServiceIcon icon={BarChart3} label="Laporan" gradient="from-slate-600 to-slate-800" onClick={() => navigate("/bendahara/laporan")} />
        </div>

        {/* Persentase pelunasan */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 ring-1 ring-emerald-200/60 dark:ring-emerald-900/30">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Persentase Pelunasan</p>
              <p className="text-2xl font-extrabold text-emerald-600">{completionRate}%</p>
            </div>
            <CheckCircle2 className="h-9 w-9 text-emerald-500/40" />
          </div>
          <Progress value={completionRate} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-600" />
        </div>

        {/* Tunggakan terbesar */}
        {tunggakanList.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/20 border-b border-rose-100 dark:border-rose-900/30">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Tunggakan Terbesar</p>
              </div>
              <span className="text-[10px] font-semibold text-rose-600">{tunggakanList.length} siswa</span>
            </div>
            <div className="divide-y divide-border/40">
              {tunggakanList.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/bendahara/transaksi`)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 active:bg-muted/60 transition text-left"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-rose-400 to-red-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {(t.name || "?")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.class} • {t.count} bulan</p>
                  </div>
                  <p className="text-xs font-bold text-rose-600 shrink-0">{fmtIDR(t.total)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent paid */}
        <div className="rounded-2xl bg-white dark:bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border-b border-indigo-100 dark:border-indigo-900/30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#5B6CF9]" />
              <p className="text-xs font-bold text-[#3D4FE0] dark:text-indigo-300">Pembayaran Terbaru</p>
            </div>
            <span className="text-[10px] font-semibold text-[#5B6CF9]">{recentPaidList.length}</span>
          </div>
          {recentPaidList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Belum ada pembayaran</p>
          ) : (
            <div className="divide-y divide-border/40">
              {recentPaidList.slice(0, 6).map((t) => {
                const m = formatPaymentMethod(t.payment_method);
                return (
                <button key={t.id} onClick={() => onSelectPaid?.(t)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 active:bg-indigo-50 dark:active:bg-indigo-950/20 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#5B6CF9] to-[#3D4FE0] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {(t.student_name || "?")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{t.student_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.class_name} • {t.period_label}</p>
                    <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded border ${m.isOffline ? "border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300" : "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{m.label}</span>
                  </div>
                  <p className="text-xs font-bold text-[#3D4FE0] shrink-0">{fmtIDR(t.total_amount)}</p>
                </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating bottom nav now mounted globally in BendaharaLayout */}
    </div>
  );
}

function BendServiceIcon({ icon: Icon, label, gradient, onClick }: { icon: any; label: string; gradient: string; onClick: () => void }) {
  // Outline 1-line style with green accent dot — inspired by modern fintech iconography.
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
      <div className="relative h-14 w-14 rounded-2xl bg-white dark:bg-card flex items-center justify-center ring-1 ring-border/60 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.18)] group-hover:shadow-[0_10px_24px_-8px_rgba(15,23,42,0.25)] group-hover:-translate-y-0.5 transition-all">
        <Icon className="h-6 w-6 text-[#3D4FE0]" strokeWidth={1.75} />
        {/* brand accent dot */}
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#5B6CF9] ring-2 ring-white dark:ring-card shadow-sm" />
      </div>
      <span className="text-[10px] font-semibold text-foreground/80 text-center leading-tight">{label}</span>
    </button>
  );
}

// ============ DATA SISWA ============
export function BendaharaSiswa() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [classList, setClassList] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.school_id) { setLoading(false); return; }
    Promise.all([
      supabase.from("students").select("*").eq("school_id", profile.school_id),
      supabase.from("spp_invoices").select("student_id, status, total_amount").eq("school_id", profile.school_id),
      supabase.from("classes").select("name").eq("school_id", profile.school_id),
    ]).then(([s, i, c]) => {
      setStudents(s.data || []);
      setInvoices(i.data || []);
      setClassList((c.data || []).map((x: any) => x.name));
      setLoading(false);
    });
  }, [profile?.school_id]);

  const enriched = useMemo(() => {
    const map = new Map<string, { paid: number; pending: number; tunggakan: number }>();
    invoices.forEach(i => {
      const e = map.get(i.student_id) || { paid: 0, pending: 0, tunggakan: 0 };
      if (i.status === "paid") e.paid++;
      else { e.pending++; e.tunggakan += i.total_amount || 0; }
      map.set(i.student_id, e);
    });
    return students
      .filter(s => filterClass === "all" || s.class === filterClass)
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.student_id || "").toLowerCase().includes(search.toLowerCase()) || (s.card_number || "").toLowerCase().includes(search.toLowerCase().replace(/\s+/g,"")))
      .map(s => ({ ...s, ...(map.get(s.id) || { paid: 0, pending: 0, tunggakan: 0 }) }));
  }, [students, invoices, search, filterClass]);

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    enriched.forEach(s => {
      const k = s.class || "Tanpa Kelas";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [enriched]);

  // Auto-expand first 2 classes
  useEffect(() => {
    if (grouped.length && expanded.size === 0) {
      setExpanded(new Set(grouped.slice(0, 2).map(([k]) => k)));
    }
  }, [grouped.length]);

  const toggle = (k: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const summary = useMemo(() => ({
    total: enriched.length,
    lunas: enriched.filter(s => s.tunggakan === 0 && s.paid > 0).length,
    nunggak: enriched.filter(s => s.tunggakan > 0).length,
    totalSisa: enriched.reduce((sum, s) => sum + s.tunggakan, 0),
  }), [enriched]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={User}
        title="Data Siswa Keuangan"
        subtitle="Ringkasan pembayaran SPP per siswa, dikelompokkan per kelas"
        variant="primary"
      />

      {/* Summary mini */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Siswa" value={summary.total} icon={User} gradient="from-[#5B6CF9] to-[#4c5ded]" />
        <StatCard label="Lunas" value={summary.lunas} icon={CheckCircle2} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Menunggak" value={summary.nunggak} icon={AlertCircle} gradient="from-red-500 to-rose-600" />
        <StatCard label="Total Tunggakan" value={fmtIDR(summary.totalSisa)} icon={Banknote} gradient="from-amber-500 to-orange-600" />
      </div>

      {/* Filter Bar */}
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari nama / NIS / Nomor Kartu Identitas" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Filter Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classList.map(c => <SelectItem key={c} value={c}>Kelas {c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Per-Class Cards */}
      {loading ? (
        <Card className="border border-border/50 shadow-sm"><CardContent className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-[#5B6CF9] mx-auto" /></CardContent></Card>
      ) : grouped.length === 0 ? (
        <Card className="border border-border/50 shadow-sm"><CardContent className="p-12 text-center text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Belum ada data siswa</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([cls, list]) => {
            const isOpen = expanded.has(cls);
            const lunas = list.filter(s => s.tunggakan === 0 && s.paid > 0).length;
            const nunggak = list.filter(s => s.tunggakan > 0).length;
            return (
              <Card key={cls} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <button onClick={() => toggle(cls)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="h-9 w-9 rounded-lg bg-[#5B6CF9] flex items-center justify-center shrink-0 shadow-sm">
                    <GraduationCap className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground">Kelas {cls}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{list.length} siswa</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Lunas {lunas}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-rose-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      Nunggak {nunggak}
                    </span>
                  </div>
                  <div className="flex sm:hidden items-center gap-2 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{lunas}
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />{nunggak}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border/50 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map(s => {
                      const isLunas = s.tunggakan === 0 && s.paid > 0;
                      const isNunggak = s.tunggakan > 0;
                      const accent = isNunggak
                        ? "hover:border-red-300 hover:shadow-red-500/20 hover:bg-red-50/40 dark:hover:bg-red-500/5"
                        : isLunas
                          ? "hover:border-emerald-300 hover:shadow-emerald-500/20 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5"
                          : "hover:border-slate-300 hover:shadow-slate-500/10";
                      const cornerColor = isNunggak ? "bg-red-500/5 group-hover:bg-red-500/15" : isLunas ? "bg-emerald-500/5 group-hover:bg-emerald-500/15" : "bg-slate-500/5 group-hover:bg-slate-500/10";
                      return (
                      <Card key={s.id}
                        onClick={() => navigate(`/bendahara/transaksi/${s.id}`)}
                        className={`group relative border border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden ${accent}`}>
                        <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-[2.5rem] transition-all duration-500 group-hover:w-24 group-hover:h-24 ${cornerColor}`} />
                        <CardContent className="relative p-3.5 space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            {(() => {
                              const g = (s.gender || "").toString().toUpperCase();
                              const isFemale = g === "P" || g === "F" || g.startsWith("PEREMPUAN") || g.startsWith("FEMALE");
                              const ag = isFemale ? "from-rose-400 to-red-600" : "from-[#5B6CF9] via-indigo-500 to-violet-600";
                              return (
                                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${ag} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
                                  {s.name[0]?.toUpperCase()}
                                </div>
                              );
                            })()}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate hover:underline">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">NIS {s.student_id}</p>
                            </div>
                          </div>
                          {s.parent_name && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              Wali: {s.parent_name}{s.parent_phone ? ` · ${s.parent_phone}` : ""}
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Tunggakan</p>
                              <p className={`text-sm font-bold ${isNunggak ? "text-red-600" : "text-emerald-600"}`}>
                                {isNunggak ? fmtIDR(s.tunggakan) : "Lunas"}
                              </p>
                            </div>
                            <Button size="sm" className="h-7 px-2.5 bg-[#5B6CF9] hover:bg-[#4c5ded] text-white text-xs shadow-sm">
                              <Eye className="h-3.5 w-3.5 mr-1" /> Detail
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ TARIF SPP ============
export function BendaharaTarif() {
  const { profile } = useAuth();
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ school_year: academicYearOf(new Date().getMonth() + 1, new Date().getFullYear()), amount: 0, due_date_day: 10, denda: 0 });
  const currentAY = academicYearOf(new Date().getMonth() + 1, new Date().getFullYear());
  const [filterAY, setFilterAY] = useState<string>(currentAY);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ id: "" as string | "", school_year: currentAY, class_name: "", amount: 0, due_date_day: 10, denda: 0, is_active: true });
  const [loading, setLoading] = useState(true);

  // Per-student discounts
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [discountForm, setDiscountForm] = useState<{ student_id: string; category: string; discount_type: "nominal" | "percent"; amount: number; percent: number }>({ student_id: "", category: "Beasiswa", discount_type: "nominal", amount: 0, percent: 0 });
  const [discountsLoading, setDiscountsLoading] = useState(false);

  const load = () => {
    if (!profile?.school_id) { setLoading(false); return; }
    Promise.all([
      supabase.from("spp_tariffs").select("*").eq("school_id", profile.school_id).order("class_name"),
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("students").select("id, name, student_id, class").eq("school_id", profile.school_id).order("name"),
    ]).then(([t, c, s]) => {
      setTariffs(t.data || []);
      setClasses((c.data || []).map((x: any) => x.name));
      setAllStudents(s.data || []);
      setLoading(false);
    });
  };
  useEffect(load, [profile?.school_id]);

  const ayOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const set = new Set<string>(academicYearList(cy));
    tariffs.forEach(t => set.add(t.school_year));
    return Array.from(set).sort();
  }, [tariffs]);

  const loadDiscounts = async (tariffId: string) => {
    setDiscountsLoading(true);
    const { data } = await supabase.from("spp_tariff_discounts").select("*").eq("tariff_id", tariffId).order("created_at", { ascending: false });
    setDiscounts(data || []);
    setDiscountsLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setDiscounts([]);
    setForm({ id: "", school_year: filterAY, class_name: "", amount: 0, due_date_day: 10, denda: 0, is_active: true });
    setOpen(true);
  };
  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ id: t.id, school_year: t.school_year, class_name: t.class_name, amount: t.amount, due_date_day: t.due_date_day, denda: t.denda, is_active: t.is_active });
    setDiscounts([]);
    setDiscountForm({ student_id: "", category: "Beasiswa", discount_type: "nominal", amount: 0, percent: 0 });
    loadDiscounts(t.id);
    setOpen(true);
  };

  const classStudents = useMemo(
    () => allStudents.filter(s => s.class === form.class_name),
    [allStudents, form.class_name]
  );
  const availableStudents = useMemo(() => {
    const used = new Set(discounts.map(d => d.student_id));
    return classStudents.filter(s => !used.has(s.id));
  }, [classStudents, discounts]);

  const addDiscount = async () => {
    if (!editing || !discountForm.student_id) { toast.error("Pilih siswa"); return; }
    if (discountForm.discount_type === "nominal" && discountForm.amount <= 0) { toast.error("Isi nominal potongan"); return; }
    if (discountForm.discount_type === "percent" && (discountForm.percent <= 0 || discountForm.percent > 100)) { toast.error("Persen harus 1-100"); return; }
    const { error } = await (supabase.from("spp_tariff_discounts") as any).insert({
      school_id: profile!.school_id,
      tariff_id: editing.id,
      student_id: discountForm.student_id,
      category: discountForm.category || "Potongan",
      discount_type: discountForm.discount_type,
      amount: discountForm.discount_type === "nominal" ? discountForm.amount : 0,
      percent: discountForm.discount_type === "percent" ? discountForm.percent : 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Potongan ditambahkan");
    setDiscountForm({ student_id: "", category: discountForm.category, discount_type: discountForm.discount_type, amount: 0, percent: 0 });
    loadDiscounts(editing.id);
  };
  const removeDiscount = async (id: string) => {
    const { error } = await supabase.from("spp_tariff_discounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    loadDiscounts(editing.id);
  };
  const updateDiscount = async (id: string, patch: { category?: string; amount?: number; percent?: number; discount_type?: "nominal" | "percent" }) => {
    const { error } = await (supabase.from("spp_tariff_discounts") as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else loadDiscounts(editing.id);
  };

  // Compute effective discount amount given base and a discount row
  const effDisc = (base: number, d: any): number => {
    if (!d) return 0;
    if (d.discount_type === "percent") return Math.round(((base || 0) * (Number(d.percent) || 0)) / 100);
    return d.amount || 0;
  };

  const save = async () => {
    if (!form.class_name || form.amount <= 0) { toast.error("Lengkapi data"); return; }
    const payload = { school_id: profile!.school_id, school_year: form.school_year, class_name: form.class_name, amount: form.amount, due_date_day: form.due_date_day, denda: form.denda, is_active: form.is_active };
    const { error } = editing
      ? await supabase.from("spp_tariffs").update(payload).eq("id", editing.id)
      : await supabase.from("spp_tariffs").upsert(payload, { onConflict: "school_id,school_year,class_name" });
    if (error) toast.error(error.message); else { toast.success(editing ? "Tarif diperbarui" : "Tarif tersimpan"); setOpen(false); load(); }
  };

  const remove = async (t: any) => {
    if (!confirm(`Hapus tarif ${t.class_name} (${t.school_year})?`)) return;
    const { error } = await supabase.from("spp_tariffs").delete().eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success("Tarif dihapus"); load(); }
  };

  const toggle = async (t: any) => {
    await supabase.from("spp_tariffs").update({ is_active: !t.is_active }).eq("id", t.id);
    load();
  };

  const bulkApply = async () => {
    if (bulkForm.amount <= 0 || classes.length === 0) { toast.error("Tidak ada kelas / nominal kosong"); return; }
    const rows = classes.map(c => ({ school_id: profile!.school_id, school_year: bulkForm.school_year, class_name: c, amount: bulkForm.amount, due_date_day: bulkForm.due_date_day, denda: bulkForm.denda, is_active: true }));
    const { error } = await supabase.from("spp_tariffs").upsert(rows, { onConflict: "school_id,school_year,class_name" });
    if (error) toast.error(error.message); else { toast.success(`${rows.length} tarif diterapkan ke semua kelas`); setBulkOpen(false); load(); }
  };

  const filtered = useMemo(() =>
    tariffs
      .filter(t => filterAY === "all" || t.school_year === filterAY)
      .filter(t => !search || t.class_name.toLowerCase().includes(search.toLowerCase())),
    [tariffs, filterAY, search]
  );

  const summary = useMemo(() => ({
    total: filtered.length,
    aktif: filtered.filter(t => t.is_active).length,
    rata: filtered.length > 0 ? Math.round(filtered.reduce((a, t) => a + t.amount, 0) / filtered.length) : 0,
    kelasBelum: classes.filter(c => !filtered.some(t => t.class_name === c)).length,
  }), [filtered, classes]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Banknote}
        title="Tarif SPP"
        subtitle="Kelola nominal SPP per tahun ajaran & kelas"
        variant="primary"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)} className="bg-white/15 hover:bg-white/25 text-white border border-white/20"><Copy className="h-4 w-4 mr-1.5" /> Set Massal</Button>
            <Button size="sm" onClick={openAdd} className="bg-white text-[#3D4FE0] hover:bg-white/90"><Plus className="h-4 w-4 mr-1.5" /> Tambah</Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Tarif" value={summary.total} icon={Receipt} gradient="from-indigo-500 to-indigo-600" />
        <StatCard label="Aktif" value={summary.aktif} icon={CheckCircle2} gradient="from-emerald-500 to-emerald-600" />
        <StatCard label="Rata-rata" value={fmtIDR(summary.rata)} icon={TrendingUp} gradient="from-sky-500 to-sky-600" />
        <StatCard label="Kelas Belum" value={summary.kelasBelum} icon={AlertCircle} gradient="from-amber-500 to-amber-600" />
      </div>

      {/* Filter bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari kelas…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filterAY} onValueChange={setFilterAY}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahun Ajaran</SelectItem>
              {ayOptions.map(ay => <SelectItem key={ay} value={ay}>{ay}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#5B6CF9]" /></div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Tahun Ajaran</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Kelas</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Nominal</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Jatuh Tempo</TableHead>
                    <TableHead className="font-semibold">Denda</TableHead>
                    <TableHead className="font-semibold">Aktif</TableHead>
                    <TableHead className="font-semibold text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Belum ada tarif. Klik <strong>Tambah</strong> atau <strong>Set Massal</strong>.</TableCell></TableRow>}
                  {filtered.map(t => (
                    <TableRow key={t.id} className="hover:bg-muted/30 [&>td]:whitespace-nowrap">
                      <TableCell className="text-sm"><Badge variant="outline" className="border-[#5B6CF9]/30 text-[#5B6CF9]">{t.school_year}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap"><Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{t.class_name}</Badge></TableCell>
                      <TableCell className="font-bold text-[#5B6CF9] whitespace-nowrap">{fmtIDR(t.amount)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">Tanggal {t.due_date_day}</TableCell>
                      <TableCell className="text-sm">{t.denda > 0 ? fmtIDR(t.denda) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Switch checked={t.is_active} onCheckedChange={() => toggle(t)} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-8 px-2 text-[#5B6CF9] hover:text-[#5B6CF9] hover:bg-[#5B6CF9]/10" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(t)} className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Tarif SPP" : "Tambah Tarif SPP"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tahun Ajaran</Label>
              <Select value={form.school_year} onValueChange={v => setForm({ ...form, school_year: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ayOptions.map(ay => <SelectItem key={ay} value={ay}>{ay}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kelas</Label>
              <Select value={form.class_name} onValueChange={v => setForm({ ...form, class_name: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nominal SPP (Rp)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Jatuh Tempo (tgl)</Label><Input type="number" min={1} max={28} value={form.due_date_day} onChange={e => setForm({ ...form, due_date_day: parseInt(e.target.value) || 10 })} /></div>
              <div><Label>Denda (Rp)</Label><Input type="number" value={form.denda} onChange={e => setForm({ ...form, denda: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="text-sm font-medium">Status Aktif</p><p className="text-xs text-muted-foreground">Hanya tarif aktif yang bisa di-generate</p></div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
            <Button onClick={save} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded]">Simpan</Button>

            {editing && (
              <div className="rounded-xl border-2 border-dashed border-[#5B6CF9]/30 bg-[#5B6CF9]/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#3D4FE0]">Potongan Per Siswa</p>
                    <p className="text-[11px] text-muted-foreground">Kurangi nominal SPP untuk siswa tertentu (mis. beasiswa, anak guru, kakak-adik).</p>
                  </div>
                  <Badge className="bg-[#5B6CF9]/10 text-[#5B6CF9] hover:bg-[#5B6CF9]/10 border-0">{discounts.length}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_110px_120px_auto] gap-2 items-end">
                  <div>
                    <Label className="text-[11px]">Siswa</Label>
                    <Select value={discountForm.student_id} onValueChange={v => setDiscountForm({ ...discountForm, student_id: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder={availableStudents.length ? "Pilih siswa" : "Semua siswa sudah ada"} /></SelectTrigger>
                      <SelectContent>
                        {availableStudents.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} <span className="text-muted-foreground">• {s.student_id}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Kategori</Label>
                    <Input className="h-9" placeholder="Beasiswa" value={discountForm.category} onChange={e => setDiscountForm({ ...discountForm, category: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Jenis</Label>
                    <Select value={discountForm.discount_type} onValueChange={(v: "nominal" | "percent") => setDiscountForm({ ...discountForm, discount_type: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                        <SelectItem value="percent">Persen (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">{discountForm.discount_type === "percent" ? "Persen (%)" : "Nominal (Rp)"}</Label>
                    {discountForm.discount_type === "percent" ? (
                      <Input className="h-9" type="number" min={0} max={100} step="0.01" value={discountForm.percent} onChange={e => setDiscountForm({ ...discountForm, percent: parseFloat(e.target.value) || 0 })} />
                    ) : (
                      <Input className="h-9" type="number" min={0} value={discountForm.amount} onChange={e => setDiscountForm({ ...discountForm, amount: parseInt(e.target.value) || 0 })} />
                    )}
                  </div>
                  <Button size="sm" onClick={addDiscount} className="bg-[#5B6CF9] hover:bg-[#4c5ded] h-9"><Plus className="h-4 w-4 mr-1" />Tambah</Button>
                </div>

                <div className="rounded-lg bg-background/60 border">
                  {discountsLoading ? (
                    <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-[#5B6CF9]" /></div>
                  ) : discounts.length === 0 ? (
                    <p className="p-4 text-xs text-center text-muted-foreground">Belum ada potongan.</p>
                  ) : (
                    <div className="divide-y">
                      {discounts.map(d => {
                        const s = allStudents.find(x => x.id === d.student_id);
                        const cut = effDisc(form.amount || 0, d);
                        const net = Math.max(0, (form.amount || 0) - cut);
                        const isPct = d.discount_type === "percent";
                        return (
                          <div key={d.id} className="p-2.5 flex flex-wrap items-center gap-2">
                            <div className="flex-1 min-w-[140px]">
                              <p className="text-sm font-medium leading-tight">{s?.name || "—"}</p>
                              <p className="text-[10px] text-muted-foreground">{s?.student_id} • Potong {isPct ? `${d.percent}%` : fmtIDR(d.amount)} • Bayar {fmtIDR(net)}</p>
                            </div>
                            <Input className="h-8 w-28" defaultValue={d.category} onBlur={e => { if (e.target.value !== d.category) updateDiscount(d.id, { category: e.target.value || "Potongan" }); }} />
                            <Select value={d.discount_type || "nominal"} onValueChange={(v: "nominal" | "percent") => updateDiscount(d.id, { discount_type: v })}>
                              <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nominal">Nominal</SelectItem>
                                <SelectItem value="percent">Persen</SelectItem>
                              </SelectContent>
                            </Select>
                            {isPct ? (
                              <Input className="h-8 w-24" type="number" min={0} max={100} step="0.01" defaultValue={d.percent} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== Number(d.percent)) updateDiscount(d.id, { percent: v }); }} />
                            ) : (
                              <Input className="h-8 w-28" type="number" min={0} defaultValue={d.amount} onBlur={e => { const v = parseInt(e.target.value) || 0; if (v !== d.amount) updateDiscount(d.id, { amount: v }); }} />
                            )}
                            <Button size="sm" variant="ghost" onClick={() => removeDiscount(d.id)} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Apply Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Tarif Massal</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Terapkan satu nominal yang sama ke <strong>{classes.length} kelas</strong> sekaligus.</p>
          <div className="space-y-3">
            <div>
              <Label>Tahun Ajaran</Label>
              <Select value={bulkForm.school_year} onValueChange={v => setBulkForm({ ...bulkForm, school_year: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ayOptions.map(ay => <SelectItem key={ay} value={ay}>{ay}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nominal SPP (Rp)</Label><Input type="number" value={bulkForm.amount} onChange={e => setBulkForm({ ...bulkForm, amount: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Jatuh Tempo (tgl)</Label><Input type="number" min={1} max={28} value={bulkForm.due_date_day} onChange={e => setBulkForm({ ...bulkForm, due_date_day: parseInt(e.target.value) || 10 })} /></div>
              <div><Label>Denda (Rp)</Label><Input type="number" value={bulkForm.denda} onChange={e => setBulkForm({ ...bulkForm, denda: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <Button onClick={bulkApply} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded]">Terapkan ke {classes.length} Kelas</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ GENERATE TAGIHAN ============
export function BendaharaGenerate() {
  const { profile } = useAuth();
  const flags = useBendaharaFlags(profile?.school_id);
  const [classes, setClasses] = useState<string[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existingInvs, setExistingInvs] = useState<any[]>([]);
  const [discountMap, setDiscountMap] = useState<Map<string, { category: string; amount: number; discount_type?: string; percent?: number }>>(new Map());
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "range">("single");
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  // Auto-derive AY from month/year — fully synced
  const schoolYear = useMemo(() => academicYearOf(month, year), [month, year]);
  const ayMonths = useMemo(() => monthsOfAcademicYear(schoolYear), [schoolYear]);
  const [rangeFrom, setRangeFrom] = useState(0);
  const [rangeTo, setRangeTo] = useState(ayMonths.length - 1);
  const [skipExisting, setSkipExisting] = useState(true);
  const [autoSendWa, setAutoSendWa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; phase: string } | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    Promise.all([
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("spp_tariffs").select("*").eq("school_id", profile.school_id).eq("is_active", true),
      supabase.from("students").select("id, name, student_id, class, parent_name, parent_phone").eq("school_id", profile.school_id),
      supabase.from("spp_invoices").select("student_id, period_month, period_year").eq("school_id", profile.school_id),
      (supabase.from("spp_tariff_discounts") as any).select("tariff_id, student_id, category, amount, discount_type, percent").eq("school_id", profile.school_id),
    ]).then(([c, t, s, inv, d]) => {
      const cls = (c.data || []).map((x: any) => x.name);
      setClasses(cls);
      setSelectedClasses(cls);
      setTariffs(t.data || []);
      setStudents(s.data || []);
      setExistingInvs(inv.data || []);
      setDiscountMap(() => {
        const m = new Map<string, { category: string; amount: number; discount_type?: string; percent?: number }>();
        (d.data || []).forEach((x: any) => m.set(`${x.tariff_id}|${x.student_id}`, { category: x.category, amount: x.amount, discount_type: x.discount_type, percent: x.percent }));
        return m;
      });
    });
  }, [profile?.school_id]);

  // Reset range when AY changes
  useEffect(() => { setRangeFrom(0); setRangeTo(ayMonths.length - 1); }, [schoolYear]);

  const tariffByClass = useMemo(() => {
    const map = new Map<string, any>();
    tariffs.filter(t => t.school_year === schoolYear).forEach(t => map.set(t.class_name, t));
    return map;
  }, [tariffs, schoolYear]);

  const periods = useMemo(() => {
    if (mode === "single") return [{ month, year, label: `${MONTHS[month - 1]} ${year}` }];
    return ayMonths.slice(rangeFrom, rangeTo + 1).map(p => ({ month: p.month, year: p.year, label: p.label }));
  }, [mode, month, year, rangeFrom, rangeTo, ayMonths]);

  const targetStudents = useMemo(() =>
    students.filter(s => selectedClasses.includes(s.class)),
    [students, selectedClasses]
  );

  const preview = useMemo(() => {
    const list: any[] = [];
    let skipped = 0;
    let noTariff = 0;
    for (const s of targetStudents) {
      const tariff = tariffByClass.get(s.class);
      if (!tariff) { noTariff++; continue; }
      const disc = discountMap.get(`${tariff.id}|${s.id}`);
      const discCut = disc
        ? (disc.discount_type === "percent"
            ? Math.round(((tariff.amount || 0) * (Number(disc.percent) || 0)) / 100)
            : (disc.amount || 0))
        : 0;
      const netAmount = Math.max(0, (tariff.amount || 0) - discCut);
      for (const p of periods) {
        const exists = existingInvs.some(i => i.student_id === s.id && i.period_month === p.month && i.period_year === p.year);
        if (exists && skipExisting) { skipped++; continue; }
        list.push({ student: s, tariff, period: p, exists, discount: disc, discCut, netAmount });
      }
    }
    const total = list.reduce((a, x) => a + (x.netAmount || 0), 0);
    return { list, skipped, noTariff, total };
  }, [targetStudents, tariffByClass, periods, existingInvs, skipExisting, discountMap]);

  const toggleClass = (c: string) => {
    setSelectedClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const generate = async () => {
    if (!profile?.school_id) return;
    if (preview.list.length === 0) { toast.error("Tidak ada tagihan untuk dibuat"); return; }
    setLoading(true);
    try {
      const rows = preview.list.map(({ student, tariff, period, discount, discCut, netAmount }) => {
        const due = new Date(period.year, period.month - 1, tariff.due_date_day);
        const descBase = `${student.name} - ${student.class} - ${period.label}`;
        const discLabel = discount && discCut > 0
          ? (discount.discount_type === "percent"
              ? `${discount.percent}% = -${fmtIDR(discCut)}`
              : `-${fmtIDR(discCut)}`)
          : null;
        return {
          school_id: profile.school_id,
          student_id: student.id,
          invoice_number: `SPP/${period.year}${String(period.month).padStart(2, "0")}/${student.student_id}`,
          student_name: student.name,
          class_name: student.class,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone,
          period_month: period.month, period_year: period.year, period_label: period.label,
          description: discLabel
            ? `${descBase} (Potongan ${discount.category}: ${discLabel})`
            : descBase,
          amount: netAmount, denda: 0, total_amount: netAmount,
          due_date: due.toISOString().slice(0, 10),
        };
      });
      // Filter out periods already having an active (non-expired, non-paid is fine to skip too) invoice
      const { data: existingForPeriod } = await supabase
        .from("spp_invoices")
        .select("student_id, period_month, period_year, status")
        .eq("school_id", profile.school_id)
        .in("student_id", rows.map(r => r.student_id));
      const existsKey = new Set(
        (existingForPeriod || [])
          .filter((e: any) => e.status !== "expired")
          .map((e: any) => `${e.student_id}|${e.period_year}|${e.period_month}`)
      );
      const toInsert = rows.filter(r => !existsKey.has(`${r.student_id}|${r.period_year}|${r.period_month}`));
      if (toInsert.length === 0) { toast.info("Semua tagihan untuk periode ini sudah ada"); return; }
      const { data: inserted, error } = await supabase.from("spp_invoices").insert(toInsert).select("*");
      if (error) { toast.error(error.message); return; }
      const created = inserted || [];
      toast.success("Tagihan SPP berhasil dibuat");

      // Tutup dialog langsung — proses link Mayar + WA berjalan di background
      setPreviewOpen(false);

      // === Background: generate Mayar link + kirim WA (tidak menahan UI) ===
      if (created.length > 0) {
        const schoolId = profile.school_id;
        const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
        const schoolName = schoolRow?.name || "Sekolah";
        (async () => {
          let linkOk = 0, linkFail = 0, waOk = 0, waFail = 0, waSkip = 0;

          const processOne = async (inv: any) => {
            try {
              const { data: linkRes } = await supabase.functions.invoke("spp-mayar", {
                body: { action: "create_payment_link", invoice_id: inv.id },
              });
              const paymentUrl = linkRes?.payment_url;
              if (paymentUrl) {
                linkOk++;
                const phone = inv.parent_phone;
                if (!flags.wa) {
                  waSkip++;
                } else if (phone) {
                  const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString("id-ID") : "-";
                  const msg = `*${schoolName} — Tagihan SPP Baru*\n\nYth. Bapak/Ibu *${inv.parent_name || "Wali"}*,\n\nTagihan SPP ananda:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : ${fmtIDR(inv.total_amount)}\n• Jatuh tempo: ${due}\n\nSilakan lakukan pembayaran via *QRIS / Transfer Bank* pada link berikut:\n${paymentUrl}\n\nTerima kasih.`;
                  const { error: waErr } = await supabase.functions.invoke("send-whatsapp", {
                    body: { school_id: schoolId, phone, message: msg, message_type: "spp_invoice" },
                  });
                  if (waErr) waFail++; else waOk++;
                } else {
                  waSkip++;
                }
                return true;
              }
              return false;
            } catch { return false; }
          };

          // Proses paralel dalam batch kecil agar tidak overload Mayar (max 4 paralel)
          const BATCH = 4;
          const failedInvs: any[] = [];
          for (let i = 0; i < created.length; i += BATCH) {
            const slice = created.slice(i, i + BATCH);
            const results = await Promise.all(slice.map(processOne));
            results.forEach((ok, idx) => { if (!ok) failedInvs.push(slice[idx]); });
          }

          // Retry yang gagal sekali lagi (paralel juga)
          if (failedInvs.length > 0) {
            await new Promise((r) => setTimeout(r, 1500));
            for (let i = 0; i < failedInvs.length; i += BATCH) {
              const slice = failedInvs.slice(i, i + BATCH);
              const results = await Promise.all(slice.map(processOne));
              results.forEach((ok) => { if (!ok) linkFail++; });
            }
          }

          toast.success(
            `Selesai: ${linkOk} link dibuat • ${waOk} WA terkirim` +
            `${waFail ? ` • ${waFail} WA gagal` : ""}` +
            `${waSkip ? ` • ${waSkip} tanpa nomor` : ""}` +
            `${linkFail ? ` • ${linkFail} link gagal` : ""}`,
            { duration: 6000 }
          );
        })();
      }
      // refresh existing invs to reflect new state
      const { data } = await supabase.from("spp_invoices").select("student_id, period_month, period_year").eq("school_id", profile.school_id);
      setExistingInvs(data || []);
    } finally { setLoading(false); }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Buat Tagihan"
        subtitle="SPP bulanan atau tagihan lainnya (Ujian, Praktek, Daftar Ulang, dll)"
        variant="primary"
      />

      <Tabs defaultValue="spp" className="w-full">
        <TabsList className="grid grid-cols-2 w-full md:w-fit gap-1 bg-indigo-50 dark:bg-indigo-950/40 p-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
          <TabsTrigger value="spp" className="gap-2 text-xs data-[state=active]:bg-[#5B6CF9] data-[state=active]:text-white">
            <Receipt className="h-3.5 w-3.5" /> SPP Bulanan
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2 text-xs data-[state=active]:bg-[#5B6CF9] data-[state=active]:text-white">
            <FileText className="h-3.5 w-3.5" /> Tagihan Lainnya
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spp" className="space-y-4 mt-4">


      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-[#5B6CF9]/10 to-transparent"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Tahun Ajaran</p><p className="text-base font-bold mt-0.5">{schoolYear}</p></div><div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/15 flex items-center justify-center"><GraduationCap className="h-4 w-4 text-[#5B6CF9]" /></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Kelas Dipilih</p><p className="text-xl font-bold mt-0.5">{selectedClasses.length}<span className="text-xs text-muted-foreground font-normal">/{classes.length}</span></p></div><div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center"><User className="h-4 w-4 text-sky-600" /></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Siswa</p><p className="text-xl font-bold mt-0.5">{targetStudents.length}</p></div><div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Akan Dibuat</p><p className="text-xl font-bold mt-0.5 text-[#5B6CF9]">{preview.list.length}</p></div><div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/15 flex items-center justify-center"><Receipt className="h-4 w-4 text-[#5B6CF9]" /></div></div></CardContent></Card>
      </div>

      {/* Mode picker */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mode Generate</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => setMode("single")} className={`rounded-lg border-2 p-3 text-left transition ${mode === "single" ? "border-[#5B6CF9] bg-[#5B6CF9]/5" : "border-muted hover:border-muted-foreground/30"}`}>
              <div className="flex items-center gap-2"><Receipt className={`h-4 w-4 ${mode === "single" ? "text-[#5B6CF9]" : "text-muted-foreground"}`} /><p className="font-semibold text-sm">Satu Bulan</p></div>
              <p className="text-xs text-muted-foreground mt-1">Generate untuk 1 periode tertentu</p>
            </button>
            <button onClick={() => setMode("range")} className={`rounded-lg border-2 p-3 text-left transition ${mode === "range" ? "border-[#5B6CF9] bg-[#5B6CF9]/5" : "border-muted hover:border-muted-foreground/30"}`}>
              <div className="flex items-center gap-2"><FileText className={`h-4 w-4 ${mode === "range" ? "text-[#5B6CF9]" : "text-muted-foreground"}`} /><p className="font-semibold text-sm">Rentang Bulan</p></div>
              <p className="text-xs text-muted-foreground mt-1">Generate beberapa bulan sekaligus dalam 1 TA</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Period selector */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Periode</Label>
            <Badge variant="outline" className="border-[#5B6CF9]/30 text-[#5B6CF9]">TA {schoolYear}</Badge>
          </div>
          {mode === "single" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Bulan</Label>
                <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tahun</Label>
                <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Mulai dari</Label>
                <Select value={String(rangeFrom)} onValueChange={v => setRangeFrom(parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{ayMonths.map((m, i) => <SelectItem key={i} value={String(i)} disabled={i > rangeTo}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sampai</Label>
                <Select value={String(rangeTo)} onValueChange={v => setRangeTo(parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{ayMonths.map((m, i) => <SelectItem key={i} value={String(i)} disabled={i < rangeFrom}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                <strong>{periods.length} bulan</strong> akan di-generate: {periods.map(p => p.label).join(" • ")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class picker */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Kelas Tujuan</Label>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedClasses(classes)}>Pilih semua</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedClasses([])}>Kosongkan</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {classes.map(c => {
              const tariff = tariffByClass.get(c);
              const sel = selectedClasses.includes(c);
              const studentCount = students.filter(s => s.class === c).length;
              return (
                <button key={c} onClick={() => toggleClass(c)} className={`rounded-lg border-2 p-2.5 text-left transition ${sel ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-muted hover:border-muted-foreground/30"} ${!tariff ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{c}</p>
                    {sel && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{studentCount} siswa</p>
                  {tariff ? <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">{fmtIDR(tariff.amount)}</p> : <p className="text-[11px] text-amber-600 mt-0.5">Tarif belum diatur</p>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Lewati tagihan yang sudah ada</p>
              <p className="text-xs text-muted-foreground">Hindari duplikat untuk siswa yang sudah punya tagihan di periode yang sama</p>
            </div>
            <Switch checked={skipExisting} onCheckedChange={setSkipExisting} />
          </div>
          {flags.wa && (
            <div className="flex items-center justify-between rounded-lg border p-3 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200"><Send className="h-3.5 w-3.5" /> Otomatis buat link & kirim WA</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">Setelah generate, sistem langsung membuat link pembayaran (QRIS / Transfer Bank) dan mengirim tagihan ke WA wali murid — tidak perlu langkah tambahan</p>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-white/70 dark:bg-emerald-900/40 px-2 py-1 rounded-md">Aktif</span>
            </div>
          )}
          {(preview.skipped > 0 || preview.noTariff > 0) && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-xs space-y-1">
              {preview.skipped > 0 && <p className="text-amber-800 dark:text-amber-200"><strong>{preview.skipped}</strong> tagihan akan dilewati (sudah ada)</p>}
              {preview.noTariff > 0 && <p className="text-amber-800 dark:text-amber-200"><strong>{preview.noTariff}</strong> siswa tidak punya tarif aktif untuk TA {schoolYear}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="sticky bottom-4 z-10">
        <Card className="border-0 shadow-xl bg-gradient-to-r from-[#5B6CF9] to-[#3D4FE0] text-white">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-white/70">Total estimasi</p>
              <p className="text-2xl font-bold">{fmtIDR(preview.total)}</p>
              <p className="text-xs text-white/70 mt-0.5">{preview.list.length} tagihan • {periods.length} bulan • {selectedClasses.length} kelas</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={preview.list.length === 0} className="bg-white/15 hover:bg-white/25 text-white border border-white/20"><Eye className="h-4 w-4 mr-1.5" /> Pratinjau</Button>
              <Button onClick={generate} disabled={loading || preview.list.length === 0} className="bg-white text-[#3D4FE0] hover:bg-white/90">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate Sekarang
              </Button>
            </div>
          </CardContent>
          {bulkProgress && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between text-xs text-white/90 mb-1">
                <span>{bulkProgress.phase}</span>
                <span className="font-semibold">{bulkProgress.done}/{bulkProgress.total}</span>
              </div>
              <Progress value={(bulkProgress.done / Math.max(1, bulkProgress.total)) * 100} className="h-1.5 bg-white/20" />
            </div>
          )}
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Pratinjau Tagihan</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 sticky top-0 [&_th]:whitespace-nowrap">
                  <TableHead>Siswa</TableHead><TableHead>Kelas</TableHead><TableHead>Periode</TableHead><TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.list.slice(0, 200).map((x, i) => (
                  <TableRow key={i} className="[&>td]:whitespace-nowrap">
                    <TableCell className="text-sm">{x.student.name}</TableCell>
                    <TableCell className="text-sm"><Badge variant="secondary">{x.student.class}</Badge></TableCell>
                    <TableCell className="text-sm">{x.period.label}</TableCell>
                    <TableCell className="text-sm font-semibold text-right">
                      {x.discCut > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="line-through text-muted-foreground text-[10px]">{fmtIDR(x.tariff.amount)}</span>
                          <span className="text-[#5B6CF9]">{fmtIDR(x.netAmount)}</span>
                          <span className="text-[9px] text-emerald-600">
                            −{fmtIDR(x.discCut)} {x.discount.category}
                            {x.discount.discount_type === "percent" ? ` (${x.discount.percent}%)` : ""}
                          </span>
                        </div>
                      ) : fmtIDR(x.netAmount ?? x.tariff.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.list.length > 200 && <p className="text-xs text-center py-2 text-muted-foreground">+{preview.list.length - 200} baris lagi…</p>}
          </div>
          <Button onClick={generate} disabled={loading} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Konfirmasi Generate {preview.list.length} Tagihan
          </Button>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <BendaharaGenerateCustom />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ GENERATE CUSTOM (Ujian / Praktek / dll) ============
function BendaharaGenerateCustom() {
  const { profile } = useAuth();
  const flags = useBendaharaFlags(profile?.school_id);
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existingInvs, setExistingInvs] = useState<any[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [billName, setBillName] = useState("");
  const [category, setCategory] = useState("Ujian");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [autoSendWa, setAutoSendWa] = useState(true);
  const [allowInstallment, setAllowInstallment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reloadCustom = async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from("spp_invoices")
      .select("id, student_id, student_name, class_name, period_label, bill_category, total_amount, status, due_date, created_at, bill_type")
      .eq("school_id", profile.school_id)
      .eq("bill_type", "custom")
      .order("created_at", { ascending: false });
    setExistingInvs(data || []);
  };

  useEffect(() => {
    if (!profile?.school_id) return;
    Promise.all([
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("students").select("id, name, student_id, class, parent_name, parent_phone").eq("school_id", profile.school_id),
    ]).then(([c, s]) => {
      const cls = (c.data || []).map((x: any) => x.name);
      setClasses(cls);
      setSelectedClasses(cls);
      setStudents(s.data || []);
    });
    reloadCustom();
  }, [profile?.school_id]);

  const effectiveCategory = category === "Lainnya" ? (customCategory.trim() || "Lainnya") : category;

  const targetStudents = useMemo(
    () => students.filter(s => selectedClasses.includes(s.class)),
    [students, selectedClasses]
  );

  const preview = useMemo(() => {
    const list: any[] = [];
    let skipped = 0;
    for (const s of targetStudents) {
      const exists = existingInvs.some(i => i.student_id === s.id && i.period_label === billName);
      if (exists) { skipped++; continue; }
      list.push({ student: s });
    }
    return { list, skipped, total: list.length * (amount || 0) };
  }, [targetStudents, existingInvs, billName, amount]);

  const toggleClass = (c: string) =>
    setSelectedClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "custom";

  const generate = async () => {
    if (!profile?.school_id) return;
    if (!billName.trim()) { toast.error("Nama tagihan wajib diisi"); return; }
    if (!amount || amount <= 0) { toast.error("Nominal tagihan harus lebih dari 0"); return; }
    if (preview.list.length === 0) { toast.error("Tidak ada siswa untuk dibuat tagihan"); return; }
    setLoading(true);
    try {
      const due = new Date(dueDate);
      const periodMonth = due.getMonth() + 1;
      const periodYear = due.getFullYear();
      const slug = slugify(billName);
      const rows = preview.list.map(({ student }) => ({
        school_id: profile.school_id,
        student_id: student.id,
        invoice_number: `Tagihan/${periodYear}${String(periodMonth).padStart(2, "0")}/${student.student_id}/${slug}`,
        student_name: student.name,
        class_name: student.class,
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
        period_month: periodMonth,
        period_year: periodYear,
        period_label: billName.trim(),
        description: `${billName.trim()} - ${student.class} - ${student.name}`,
        amount, denda: 0, total_amount: amount,
        due_date: due.toISOString().slice(0, 10),
        bill_type: "custom" as const,
        bill_category: effectiveCategory,
        allow_installment: allowInstallment && flags.installment,
      }));

      // Server-side dedup by (student, period_label, bill_type='custom')
      const { data: existsRows } = await supabase
        .from("spp_invoices")
        .select("student_id, period_label, bill_type")
        .eq("school_id", profile.school_id)
        .eq("bill_type", "custom")
        .eq("period_label", billName.trim())
        .in("student_id", rows.map(r => r.student_id));
      const existKey = new Set((existsRows || []).map((e: any) => `${e.student_id}|${e.period_label}`));
      const toInsert = rows.filter(r => !existKey.has(`${r.student_id}|${r.period_label}`));
      if (toInsert.length === 0) { toast.info("Semua siswa sudah punya tagihan dengan nama yang sama"); return; }

      const { data: inserted, error } = await supabase.from("spp_invoices").insert(toInsert).select("*");
      if (error) { toast.error(error.message); return; }
      const created = inserted || [];
      toast.success(`${created.length} tagihan custom berhasil dibuat`);
      setPreviewOpen(false);

      // Background: Mayar link + WA
      if (created.length > 0 && autoSendWa && flags.wa) {
        const schoolId = profile.school_id;
        const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
        const schoolName = schoolRow?.name || "Sekolah";
        (async () => {
          let linkOk = 0, linkFail = 0, waOk = 0, waFail = 0, waSkip = 0;
          const processOne = async (inv: any) => {
            try {
              const { data: linkRes } = await supabase.functions.invoke("spp-mayar", {
                body: { action: "create_payment_link", invoice_id: inv.id },
              });
              const paymentUrl = linkRes?.payment_url;
              if (!paymentUrl) return false;
              linkOk++;
              const phone = inv.parent_phone;
              if (!phone) { waSkip++; return true; }
              const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString("id-ID") : "-";
              const msg = `*${schoolName} — Tagihan ${effectiveCategory} Baru*\n\nYth. Bapak/Ibu *${inv.parent_name || "Wali"}*,\n\nTagihan ananda:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Jenis   : ${inv.period_label}\n• Nominal : ${fmtIDR(inv.total_amount)}\n• Jatuh tempo: ${dueStr}\n\nSilakan lakukan pembayaran via *QRIS / Transfer Bank* pada link berikut:\n${paymentUrl}\n\nTerima kasih.`;
              const { error: waErr } = await supabase.functions.invoke("send-whatsapp", {
                body: { school_id: schoolId, phone, message: msg, message_type: "spp_invoice" },
              });
              if (waErr) waFail++; else waOk++;
              return true;
            } catch { return false; }
          };
          const BATCH = 4;
          const failed: any[] = [];
          for (let i = 0; i < created.length; i += BATCH) {
            const slice = created.slice(i, i + BATCH);
            const results = await Promise.all(slice.map(processOne));
            results.forEach((ok, idx) => { if (!ok) failed.push(slice[idx]); });
          }
          if (failed.length > 0) {
            await new Promise((r) => setTimeout(r, 1500));
            for (let i = 0; i < failed.length; i += BATCH) {
              const slice = failed.slice(i, i + BATCH);
              const results = await Promise.all(slice.map(processOne));
              results.forEach((ok) => { if (!ok) linkFail++; });
            }
          }
          toast.success(
            `Selesai: ${linkOk} link • ${waOk} WA` +
            `${waFail ? ` • ${waFail} WA gagal` : ""}` +
            `${waSkip ? ` • ${waSkip} tanpa nomor` : ""}` +
            `${linkFail ? ` • ${linkFail} link gagal` : ""}`,
            { duration: 6000 }
          );
        })();
      }

      // Refresh local cache
      await reloadCustom();
      setBillName("");
    } finally { setLoading(false); }
  };

  const CATEGORIES = ["Ujian", "Praktek", "Daftar Ulang", "Study Tour", "Seragam", "Buku", "Lainnya"];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-[#5B6CF9]/10 to-transparent"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Kategori</p><p className="text-base font-bold mt-0.5 truncate">{effectiveCategory}</p></div><div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/15 flex items-center justify-center"><FileText className="h-4 w-4 text-[#5B6CF9]" /></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Kelas Dipilih</p><p className="text-xl font-bold mt-0.5">{selectedClasses.length}<span className="text-xs text-muted-foreground font-normal">/{classes.length}</span></p></div><div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center"><User className="h-4 w-4 text-sky-600" /></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Siswa</p><p className="text-xl font-bold mt-0.5">{targetStudents.length}</p></div><div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Akan Dibuat</p><p className="text-xl font-bold mt-0.5 text-[#5B6CF9]">{preview.list.length}</p></div><div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/15 flex items-center justify-center"><Receipt className="h-4 w-4 text-[#5B6CF9]" /></div></div></CardContent></Card>
      </div>

      {/* Form Tagihan */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Detail Tagihan</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Nama Tagihan <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Contoh: Ujian Tengah Semester Ganjil 2026"
                value={billName}
                onChange={e => setBillName(e.target.value)}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Nama ini akan muncul di tagihan & pesan WA wali murid</p>
            </div>
            <div>
              <Label className="text-xs">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              {category === "Lainnya" && (
                <Input
                  placeholder="Sebutkan kategori"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="h-9 mt-2"
                />
              )}
            </div>
            <div>
              <Label className="text-xs">Nominal (Rp) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={amount || ""}
                onChange={e => setAmount(parseInt(e.target.value) || 0)}
                className="h-9"
              />
              {amount > 0 && <p className="text-[11px] font-semibold text-emerald-600 mt-1">{fmtIDR(amount)}</p>}
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Jatuh Tempo</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pilih Kelas */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Kelas Tujuan</Label>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedClasses(classes)}>Pilih semua</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedClasses([])}>Kosongkan</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {classes.map(c => {
              const sel = selectedClasses.includes(c);
              const studentCount = students.filter(s => s.class === c).length;
              return (
                <button key={c} onClick={() => toggleClass(c)} className={`rounded-lg border-2 p-2.5 text-left transition ${sel ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-muted hover:border-muted-foreground/30"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{c}</p>
                    {sel && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{studentCount} siswa</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-2">
          {flags.wa && (
            <div className="flex items-center justify-between rounded-lg border p-3 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200"><Send className="h-3.5 w-3.5" /> Otomatis buat link & kirim WA</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">Setelah generate, sistem otomatis membuat link pembayaran & mengirim ke WA wali murid</p>
              </div>
              <Switch checked={autoSendWa} onCheckedChange={setAutoSendWa} />
            </div>
          )}
          {flags.installment && (
            <div className="flex items-center justify-between rounded-lg border p-3 bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 text-violet-800 dark:text-violet-200"><Wallet className="h-3.5 w-3.5" /> Izinkan Cicilan</p>
                <p className="text-xs text-violet-700/80 dark:text-violet-300/80">Wali murid dapat membayar tagihan ini secara bertahap (tidak berlaku untuk SPP)</p>
              </div>
              <Switch checked={allowInstallment} onCheckedChange={setAllowInstallment} />
            </div>
          )}
          {preview.skipped > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-xs">
              <p className="text-amber-800 dark:text-amber-200"><strong>{preview.skipped}</strong> siswa sudah punya tagihan "{billName}" — akan dilewati</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="sticky bottom-4 z-10">
        <Card className="border-0 shadow-xl bg-gradient-to-r from-[#5B6CF9] to-[#3D4FE0] text-white">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-white/70">Total estimasi</p>
              <p className="text-2xl font-bold">{fmtIDR(preview.total)}</p>
              <p className="text-xs text-white/70 mt-0.5">{preview.list.length} tagihan • {selectedClasses.length} kelas • {effectiveCategory}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={preview.list.length === 0 || !billName.trim() || !amount} className="bg-white/15 hover:bg-white/25 text-white border border-white/20"><Eye className="h-4 w-4 mr-1.5" /> Pratinjau</Button>
              <Button onClick={generate} disabled={loading || preview.list.length === 0 || !billName.trim() || !amount} className="bg-white text-[#3D4FE0] hover:bg-white/90">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate Sekarang
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Pratinjau Tagihan Custom</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">
            <span className="font-semibold text-foreground">{billName || "(tanpa nama)"}</span> • {effectiveCategory} • {fmtIDR(amount)} / siswa
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 sticky top-0 [&_th]:whitespace-nowrap">
                  <TableHead>Siswa</TableHead><TableHead>Kelas</TableHead><TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.list.slice(0, 200).map((x, i) => (
                  <TableRow key={i} className="[&>td]:whitespace-nowrap">
                    <TableCell className="text-sm">{x.student.name}</TableCell>
                    <TableCell className="text-sm"><Badge variant="secondary">{x.student.class}</Badge></TableCell>
                    <TableCell className="text-sm font-semibold text-right">{fmtIDR(amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.list.length > 200 && <p className="text-xs text-center py-2 text-muted-foreground">+{preview.list.length - 200} baris lagi…</p>}
          </div>
          <Button onClick={generate} disabled={loading} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Konfirmasi Generate {preview.list.length} Tagihan
          </Button>
        </DialogContent>
      </Dialog>

      {/* Tagihan Custom Aktif */}
      <ActiveCustomInvoicesList invoices={existingInvs} onChanged={reloadCustom} />
    </div>
  );
}

function ActiveCustomInvoicesList({ invoices, onChanged }: { invoices: any[]; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; category: string; rows: any[] }>();
    for (const inv of invoices) {
      const key = `${inv.period_label || "-"}__${inv.bill_category || "-"}`;
      if (!map.has(key)) map.set(key, { key, name: inv.period_label || "-", category: inv.bill_category || "-", rows: [] });
      map.get(key)!.rows.push(inv);
    }
    return Array.from(map.values()).sort((a, b) => {
      const da = Math.max(...a.rows.map(r => new Date(r.created_at).getTime()));
      const db = Math.max(...b.rows.map(r => new Date(r.created_at).getTime()));
      return db - da;
    });
  }, [invoices]);

  const deleteOne = async (inv: any) => {
    if (inv.status === "paid") { toast.error("Tagihan lunas tidak bisa dihapus"); return; }
    if (!confirm(`Hapus tagihan "${inv.period_label}" untuk ${inv.student_name}?`)) return;
    setBusy(`one-${inv.id}`);
    const { error } = await supabase.from("spp_invoices").delete().eq("id", inv.id).neq("status", "paid");
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Tagihan dihapus");
    await onChanged();
  };

  const deleteUnpaidGroup = async (g: { key: string; name: string; rows: any[] }) => {
    const unpaidIds = g.rows.filter(r => r.status !== "paid").map(r => r.id);
    if (unpaidIds.length === 0) { toast.info("Tidak ada tagihan belum bayar pada grup ini"); return; }
    if (!confirm(`Hapus ${unpaidIds.length} tagihan belum bayar pada "${g.name}"?`)) return;
    setBusy(`grp-${g.key}`);
    const { error } = await supabase.from("spp_invoices").delete().in("id", unpaidIds).neq("status", "paid");
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${unpaidIds.length} tagihan dihapus`);
    await onChanged();
  };

  if (groups.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Belum ada tagihan custom yang dibuat
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tagihan Custom Aktif</Label>
          <Badge variant="secondary" className="text-[10px]">{groups.length} grup</Badge>
        </div>
        <div className="space-y-2">
          {groups.map(g => {
            const total = g.rows.length;
            const paid = g.rows.filter(r => r.status === "paid").length;
            const unpaid = total - paid;
            const sumTotal = g.rows.reduce((s, r) => s + (r.total_amount || 0), 0);
            const sumPaid = g.rows.filter(r => r.status === "paid").reduce((s, r) => s + (r.total_amount || 0), 0);
            const isOpen = open[g.key] ?? false;
            return (
              <div key={g.key} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => setOpen(p => ({ ...p, [g.key]: !p[g.key] }))}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#5B6CF9]/15 flex items-center justify-center shrink-0">
                    <Receipt className="h-4 w-4 text-[#5B6CF9]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{g.name}</p>
                      <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>{total} siswa</span>
                      <span className="text-emerald-600">• {paid} lunas</span>
                      {unpaid > 0 && <span className="text-amber-600">• {unpaid} belum</span>}
                      <span>• {fmtIDR(sumPaid)} / {fmtIDR(sumTotal)}</span>
                    </div>
                  </div>
                  {unpaid > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); deleteUnpaidGroup(g); }}
                      disabled={busy === `grp-${g.key}`}
                      className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {busy === `grp-${g.key}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" /> Hapus belum bayar</>}
                    </Button>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t max-h-80 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 [&_th]:whitespace-nowrap">
                          <TableHead>Siswa</TableHead>
                          <TableHead>Kelas</TableHead>
                          <TableHead className="text-right">Nominal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.rows.map(inv => (
                          <TableRow key={inv.id} className="[&>td]:whitespace-nowrap">
                            <TableCell className="text-sm">{inv.student_name}</TableCell>
                            <TableCell className="text-sm"><Badge variant="secondary">{inv.class_name}</Badge></TableCell>
                            <TableCell className="text-sm font-semibold text-right">{fmtIDR(inv.total_amount)}</TableCell>
                            <TableCell><StatusBadge status={inv.status} /></TableCell>
                            <TableCell className="text-right">
                              {inv.status === "paid" ? (
                                <span className="text-[11px] text-muted-foreground italic">Terkunci</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteOne(inv)}
                                  disabled={busy === `one-${inv.id}`}
                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Hapus"
                                >
                                  {busy === `one-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


// ============ SPP PER SISWA (LIST) ============
export function BendaharaTransaksi() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentAY = academicYearOf(new Date().getMonth() + 1, currentYear);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterAY, setFilterAY] = useState(currentAY);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterBillType, setFilterBillType] = useState<"all" | "spp" | "custom">("all");
  const [sortBy, setSortBy] = useState<"name" | "tunggakan" | "lunas">("name");

  const load = () => {
    if (!profile?.school_id) { setLoading(false); return; }
    Promise.all([
      supabase.from("students").select("id, name, student_id, card_number, class, parent_name, parent_phone, gender").eq("school_id", profile.school_id),
      supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id),
      supabase.from("classes").select("name").eq("school_id", profile.school_id),
    ]).then(([s, i, c]) => {
      setStudents(s.data || []);
      setInvoices(i.data || []);
      setClasses((c.data || []).map((x: any) => x.name));
      setLoading(false);
    });
  };
  useEffect(load, [profile?.school_id]);

  

  const enriched = useMemo(() => {
    return students.map(s => {
      const studentInvs = invoices.filter(inv => {
        if (inv.student_id !== s.id) return false;
        const billType = (inv.bill_type || "spp");
        if (filterBillType !== "all" && billType !== filterBillType) return false;
        // Filter periode (AY/bulan) hanya berlaku untuk tagihan SPP bulanan.
        // Tagihan custom (Ujian, Praktek, dll) tidak terikat periode bulan → selalu tampil.
        if (billType === "spp") {
          const ay = academicYearOf(inv.period_month, inv.period_year);
          if (ay !== filterAY) return false;
          if (filterMonth !== "all" && inv.period_month !== parseInt(filterMonth)) return false;
        }
        return true;
      });
      const lunas = studentInvs.filter(i => i.status === "paid").length;
      const pending = studentInvs.filter(i => i.status === "pending").length;
      const total = studentInvs.length;
      const totalTagihan = studentInvs.reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const totalBayar = studentInvs.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const sisa = totalTagihan - totalBayar;
      // Status agregat siswa
      let aggStatus = "unpaid";
      if (total > 0 && lunas === total) aggStatus = "paid";
      else if (pending > 0) aggStatus = "pending";
      else if (lunas > 0) aggStatus = "pending";
      return { ...s, lunas, pending, total, totalTagihan, totalBayar, sisa, aggStatus };
    })
    .filter(s => filterClass === "all" || s.class === filterClass)
    .filter(s => filterStatus === "all" || s.aggStatus === filterStatus)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.student_id || "").toLowerCase().includes(search.toLowerCase()) || (s.card_number || "").toLowerCase().includes(search.toLowerCase().replace(/\s+/g,"")))
    .sort((a, b) => {
      if (sortBy === "tunggakan") return b.sisa - a.sisa;
      if (sortBy === "lunas") return b.lunas - a.lunas;
      return a.name.localeCompare(b.name);
    });
  }, [students, invoices, filterClass, filterAY, filterStatus, filterMonth, filterBillType, search, sortBy]);

  const summary = useMemo(() => ({
    total: enriched.length,
    lunas: enriched.filter(s => s.aggStatus === "paid").length,
    nunggak: enriched.filter(s => s.sisa > 0).length,
    totalSisa: enriched.reduce((s, x) => s + x.sisa, 0),
  }), [enriched]);

  // Sinkronkan opsi bulan dengan tahun ajaran terpilih
  const ayMonths = useMemo(() => monthsOfAcademicYear(filterAY), [filterAY]);
  // Reset filter bulan jika tidak ada di AY ini
  useEffect(() => {
    if (filterMonth !== "all" && !ayMonths.find(m => String(m.month) === filterMonth)) {
      setFilterMonth("all");
    }
  }, [filterAY]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Wallet}
        title="Pembayaran"
        subtitle="Tagihan SPP bulanan & tagihan lainnya (Ujian, Praktek, dll) per siswa"
        variant="primary"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/bendahara/import-export")}
            className="bg-white/15 hover:bg-white/25 text-white border-0"
          >
            <Upload className="h-4 w-4 mr-1.5" /> Import / Export
          </Button>
        }
      />

      {/* Jenis tagihan */}
      <Tabs value={filterBillType} onValueChange={(v) => setFilterBillType(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-fit gap-1 bg-indigo-50 dark:bg-indigo-950/40 p-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
          <TabsTrigger value="all" className="gap-1.5 text-xs data-[state=active]:bg-[#5B6CF9] data-[state=active]:text-white">Semua</TabsTrigger>
          <TabsTrigger value="spp" className="gap-1.5 text-xs data-[state=active]:bg-[#5B6CF9] data-[state=active]:text-white">SPP</TabsTrigger>
          <TabsTrigger value="custom" className="gap-1.5 text-xs data-[state=active]:bg-[#5B6CF9] data-[state=active]:text-white">Lainnya</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary mini */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Siswa" value={summary.total} icon={User} gradient="from-[#5B6CF9] to-[#4c5ded]" />
        <StatCard label="Sudah Lunas" value={summary.lunas} icon={CheckCircle2} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Menunggak" value={summary.nunggak} icon={AlertCircle} gradient="from-red-500 to-rose-600" />
        <StatCard label="Total Sisa Tagihan" value={fmtIDR(summary.totalSisa)} icon={Banknote} gradient="from-amber-500 to-orange-600" />
      </div>

      {/* Filter Bar */}
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari nama / NIS / Nomor Kartu Identitas" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {classes.map(c => <SelectItem key={c} value={c}>Kelas {c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAY} onValueChange={setFilterAY}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {academicYearList(currentYear).map(ay => <SelectItem key={ay} value={ay}>TA {ay}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Bulan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bulan</SelectItem>
                {ayMonths.map(m => (
                  <SelectItem key={`${m.year}-${m.month}`} value={String(m.month)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="unpaid">Belum Bayar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Urutkan:</span>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nama (A-Z)</SelectItem>
                <SelectItem value="tunggakan">Tunggakan terbesar</SelectItem>
                <SelectItem value="lunas">Bulan lunas terbanyak</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={load} className="h-8"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-Class Grouping */}
      {loading ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></CardContent></Card>
      ) : enriched.length === 0 ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          Tidak ada data sesuai filter
        </CardContent></Card>
      ) : (
        <ClassGroupedList students={enriched} filterAY={filterAY} filterMonth={filterMonth} navigate={navigate} invoices={invoices} schoolId={profile?.school_id} onRefresh={load} />
      )}
    </div>
  );
}

// Per-class collapsible cards
function ClassGroupedList({ students, filterAY, filterMonth, navigate, invoices, schoolId, onRefresh }: { students: any[]; filterAY: string; filterMonth: string; navigate: any; invoices: any[]; schoolId?: string; onRefresh: () => void }) {
  const flags = useBendaharaFlags(schoolId);
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    students.forEach(s => {
      const k = s.class || "Tanpa Kelas";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [students]);

  const [openClass, setOpenClass] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    grouped.forEach(([k], i) => { o[k] = i < 2; });
    return o;
  });

  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Send WA massal untuk daftar siswa di kelas ini (status pending/unpaid pada periode aktif)
  const sendBulkForStudents = async (className: string, classStudents: any[]) => {
    if (!schoolId) return;
    // Cari invoice pending untuk siswa-siswa ini sesuai filter AY & bulan
    const studentIds = new Set(classStudents.map(s => s.id));
    const studentMap = new Map(classStudents.map(s => [s.id, s]));
    const targetInvs = invoices.filter(inv => {
      if (!studentIds.has(inv.student_id)) return false;
      if (inv.status === "paid" || inv.status === "expired") return false;
      const ay = academicYearOf(inv.period_month, inv.period_year);
      if (ay !== filterAY) return false;
      if (filterMonth !== "all" && inv.period_month !== parseInt(filterMonth)) return false;
      const stu = studentMap.get(inv.student_id);
      return stu?.parent_phone;
    });

    if (targetInvs.length === 0) {
      toast.info("Tidak ada tagihan tertunggak yang bisa dikirim (cek filter bulan/AY & nomor wali)");
      return;
    }
    const confirmMsg = `Kirim WA tagihan ke ${targetInvs.length} wali murid kelas ${className}?\n(Sistem otomatis membuat link Mayar untuk yang belum punya link)`;
    if (!confirm(confirmMsg)) return;

    setBulkBusy(className);
    setBulkProgress({ done: 0, total: targetInvs.length });
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
    const schoolName = schoolRow?.name || "Sekolah";
    let waOk = 0, waFail = 0, linkFail = 0;
    for (let i = 0; i < targetInvs.length; i++) {
      const inv = targetInvs[i];
      const stu = studentMap.get(inv.student_id);
      const currentPhone = stu?.parent_phone || inv.parent_phone;
      const currentName = stu?.parent_name || inv.parent_name;
      let paymentUrl = inv.payment_url;
      try {
        if (!paymentUrl) {
          const { data: linkRes } = await supabase.functions.invoke("spp-mayar", {
            body: { action: "create_payment_link", invoice_id: inv.id },
          });
          paymentUrl = linkRes?.payment_url;
        }
        if (!paymentUrl) { linkFail++; setBulkProgress({ done: i + 1, total: targetInvs.length }); continue; }
        const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString("id-ID") : "-";
        const msg = `*${schoolName} — Tagihan SPP Baru*\n\nYth. Bapak/Ibu *${currentName || "Wali"}*,\n\nTagihan SPP ananda:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : ${fmtIDR(inv.total_amount)}\n• Jatuh tempo: ${due}\n\nSilakan lakukan pembayaran via *QRIS / Transfer Bank* pada link berikut:\n${paymentUrl}\n\nTerima kasih.`;
        const { error: waErr } = await supabase.functions.invoke("send-whatsapp", {
          body: { school_id: schoolId, phone: currentPhone, message: msg, message_type: "spp_invoice" },
        });
        if (waErr) waFail++; else {
          waOk++;
          // Sinkron snapshot invoice agar konsisten
          if (currentPhone !== inv.parent_phone || currentName !== inv.parent_name) {
            await supabase.from("spp_invoices").update({ parent_phone: currentPhone, parent_name: currentName }).eq("id", inv.id);
          }
        }
      } catch { waFail++; }
      setBulkProgress({ done: i + 1, total: targetInvs.length });
      if (i < targetInvs.length - 1) await new Promise((r) => setTimeout(r, 1200));
    }
    setBulkBusy(null);
    setBulkProgress(null);
    toast.success(`Kelas ${className}: WA terkirim ${waOk}${waFail ? ` • gagal ${waFail}` : ""}${linkFail ? ` • gagal link ${linkFail}` : ""}`);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {grouped.map(([className, list], idx) => {
        const lunas = list.filter(s => s.aggStatus === "paid").length;
        const nunggak = list.filter(s => s.sisa > 0).length;
        const totalSisa = list.reduce((sum, s) => sum + s.sisa, 0);
        const isOpen = openClass[className] ?? false;

        // Semua kelas pakai palette brand ungu (seragam)
        const pal = {
          grad: "from-[#5B6CF9] via-[#4c5ded] to-[#3D4FE0]",
          ring: "ring-indigo-200",
          chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
        };

        // Avatar berdasarkan gender: ungu (indigo/violet) = laki-laki, merah (rose) = perempuan
        const avatarFor = (gender?: string) => {
          const g = (gender || "").toString().toUpperCase();
          const isFemale = g === "P" || g === "F" || g.startsWith("PEREMPUAN") || g.startsWith("FEMALE");
          return isFemale
            ? "from-rose-400 to-red-600"
            : "from-[#5B6CF9] via-indigo-500 to-violet-600";
        };
        const initials = (n: string) => n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

        return (
          <div key={className} className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Header kelas — gradient berwarna */}
            <div className={`relative overflow-hidden bg-gradient-to-r ${pal.grad} text-white`}>
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
              <div className="relative z-10 flex items-center gap-3 px-4 py-3.5">
                <button
                  onClick={() => setOpenClass(p => ({ ...p, [className]: !p[className] }))}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left"
                >
                  <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center shrink-0 shadow-md">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[15px] text-white truncate max-w-[60%]">Kelas {className}</span>
                      <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full border border-white/20 whitespace-nowrap">{list.length} siswa</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/95 whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {lunas}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/95 whitespace-nowrap">
                        <span className={`h-1.5 w-1.5 rounded-full ${nunggak > 0 ? "bg-red-400" : "bg-white/40"}`} />
                        {nunggak}
                      </span>
                      {totalSisa > 0 && (
                        <span className="text-[10px] font-bold bg-white text-rose-700 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">Sisa {fmtIDR(totalSisa)}</span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setOpenClass(p => ({ ...p, [className]: !p[className] }))}
                    className="h-9 w-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                    aria-label="Toggle"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-white" /> : <ChevronRight className="h-4 w-4 text-white" />}
                  </button>
                  {flags.wa && nunggak > 0 && (
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); sendBulkForStudents(className, list); }}
                      disabled={bulkBusy === className}
                      className="h-9 w-9 sm:w-auto sm:px-3 p-0 bg-white text-[#3D4FE0] hover:bg-white/90 text-xs font-semibold shadow-sm"
                      title={`Kirim WA tagihan ke ${nunggak} wali murid`}
                    >
                      {bulkBusy === className ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /><span className="hidden sm:inline">{bulkProgress?.done}/{bulkProgress?.total}</span></>
                      ) : (
                        <><Send className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Kirim WA</span></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabel siswa — dengan avatar berwarna */}
            {isOpen && (
              <div className="border-t border-border/60 bg-gradient-to-b from-secondary/20 to-transparent overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40 border-border/40 [&_th]:whitespace-nowrap">
                      <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Siswa</TableHead>
                      <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">NIS</TableHead>
                      <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Bulan</TableHead>
                      <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Sisa Tagihan</TableHead>
                      <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="h-9 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((s, i) => {
                      const ag = avatarFor(s.gender);
                      return (
                        <TableRow
                          key={s.id}
                          onClick={() => navigate(`/bendahara/transaksi/${s.id}?ay=${encodeURIComponent(filterAY)}`)}
                          className="cursor-pointer hover:bg-[#5B6CF9]/5 border-border/40 [&>td]:whitespace-nowrap"
                        >
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${ag} flex items-center justify-center text-white text-[11px] font-bold shadow-sm shrink-0 ring-2 ring-white`}>
                                {initials(s.name || "?")}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                                {s.parent_name && (
                                  <p className="text-[11px] text-muted-foreground truncate">Wali: {s.parent_name}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 hidden md:table-cell text-xs font-mono text-muted-foreground">{s.student_id || "-"}</TableCell>
                          <TableCell className="py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border ${pal.chip}`}>
                              <CheckCircle2 className="h-3 w-3" />
                              {s.lunas}/{s.total}
                            </span>
                          </TableCell>
                          <TableCell className={`py-2.5 text-right text-sm font-bold ${s.sisa > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {s.sisa > 0 ? fmtIDR(s.sisa) : "Lunas"}
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <StatusBadge status={s.aggStatus} />
                          </TableCell>
                          <TableCell className="py-2.5 text-right pr-3">
                            <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============ SPP DETAIL PER SISWA ============
export function BendaharaSPPDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const flags = useBendaharaFlags(profile?.school_id);
  const search = new URLSearchParams(window.location.search);
  const initAY = search.get("ay") || academicYearOf(new Date().getMonth() + 1, new Date().getFullYear());

  const [student, setStudent] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [ay, setAY] = useState(initAY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentIframe, setPaymentIframe] = useState<string | null>(null);
  const [offlineDialog, setOfflineDialog] = useState<{ inv: any | null; method: "offline_cash" | "offline_transfer"; paidDate: string; note: string }>({ inv: null, method: "offline_cash", paidDate: new Date().toISOString().slice(0, 10), note: "" });
  const [installmentInv, setInstallmentInv] = useState<any | null>(null);

  const load = () => {
    if (!profile?.school_id || !studentId) { setLoading(false); return; }
    Promise.all([
      supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
      supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id).eq("student_id", studentId),
      supabase.from("spp_tariffs").select("*").eq("school_id", profile.school_id).eq("is_active", true),
    ]).then(([s, i, t]) => {
      setStudent(s.data); setInvoices(i.data || []); setTariffs(t.data || []); setLoading(false);
    });
  };
  useEffect(load, [profile?.school_id, studentId]);

  const ayMonths = useMemo(() => monthsOfAcademicYear(ay), [ay]);

  const grid = useMemo(() => ayMonths.map(m => {
    const inv = invoices.find(x => x.period_month === m.month && x.period_year === m.year);
    return { ...m, inv };
  }), [ayMonths, invoices]);

  const stats = useMemo(() => {
    const yearInvs = invoices.filter(i => {
      const a = academicYearOf(i.period_month, i.period_year);
      return a === ay;
    });
    const totalTagihan = yearInvs.reduce((s, i) => s + (i.total_amount || 0), 0);
    const totalBayar = yearInvs.filter(i => i.status === "paid").reduce((s, i) => s + (i.total_amount || 0), 0);
    return { totalTagihan, totalBayar, sisa: totalTagihan - totalBayar, lunas: yearInvs.filter(i => i.status === "paid").length, total: yearInvs.length };
  }, [invoices, ay]);

  const pct = stats.total > 0 ? Math.round((stats.lunas / stats.total) * 100) : 0;

  const createInvoiceFor = async (month: number, year: number) => {
    if (!student || !profile?.school_id) return;
    const tariff = tariffs.find(t => t.class_name === student.class);
    if (!tariff) { toast.error("Tarif untuk kelas ini belum diatur"); return; }
    setBusy(`create-${month}-${year}`);
    const due = new Date(year, month - 1, tariff.due_date_day);
    const periodLabel = `${MONTHS[month - 1]} ${year}`;
    const { error } = await supabase.from("spp_invoices").insert({
      school_id: profile.school_id, student_id: student.id,
      invoice_number: `SPP/${year}${String(month).padStart(2,"0")}/${student.student_id}`,
      student_name: student.name, class_name: student.class,
      parent_name: student.parent_name, parent_phone: student.parent_phone,
      period_month: month, period_year: year, period_label: periodLabel,
      description: `${student.name} - ${student.class} - ${periodLabel}`,
      amount: tariff.amount, denda: 0, total_amount: tariff.amount,
      due_date: due.toISOString().slice(0, 10),
    });
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success("Tagihan dibuat"); load(); }
  };

  // Auto-mark as expired client-side based on expired_at
  const enrichedInvoices = useMemo(() => {
    const now = Date.now();
    return invoices.map((i) => {
      const expired = i.expired_at && new Date(i.expired_at).getTime() < now;
      if (i.status === "pending" && expired) {
        return { ...i, _displayStatus: "expired" };
      }
      // Treat unpaid w/ active payment_url as pending (data not migrated yet)
      if (i.status === "unpaid" && i.payment_url && !expired) {
        return { ...i, _displayStatus: "pending" };
      }
      return { ...i, _displayStatus: i.status };
    });
  }, [invoices]);

  const enrichedGrid = useMemo(() => ayMonths.map(m => {
    const inv = enrichedInvoices.find(x => x.period_month === m.month && x.period_year === m.year && x._displayStatus !== "expired")
      || enrichedInvoices.find(x => x.period_month === m.month && x.period_year === m.year);
    return { ...m, inv };
  }), [ayMonths, enrichedInvoices]);

  // Channel picker state (VA / QRIS) — Bendahara pilih metode saat buat link, sama seperti wali murid.
  const [linkPicker, setLinkPicker] = useState<{ inv: any; regen: boolean } | null>(null);
  const [linkPickerLoading, setLinkPickerLoading] = useState(false);

  const createPaymentLink = (inv: any, regen = false) => {
    setLinkPicker({ inv, regen });
  };

  const confirmCreatePaymentLink = async (channel: PaymentChannelId, _fee: number, _total: number) => {
    if (!linkPicker) return;
    const { inv, regen } = linkPicker;
    setLinkPickerLoading(true);
    setBusy(`link-${inv.id}`);
    toast.loading(regen ? "Membuat ulang link pembayaran..." : "Membuat link pembayaran...");
    const action = regen ? "regenerate_payment_link" : "create_payment_link";
    const { data, error } = await supabase.functions.invoke("spp-mayar", { body: { action, invoice_id: inv.id, channel } });
    toast.dismiss();
    setBusy(null);
    setLinkPickerLoading(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || "Gagal"); return; }
    if (data.payment_url) {
      setLinkPicker(null);
      toast.success(regen ? "Link baru berhasil dibuat" : "Link berhasil dibuat");
      const currentPhone = student?.parent_phone || inv.parent_phone;
      const currentName = student?.parent_name || inv.parent_name;
      if (currentPhone) {
        await sendWa({ ...inv, payment_url: data.payment_url, parent_phone: currentPhone, parent_name: currentName });
      }
      load();
    }
  };

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); toast.success("Link disalin"); };

  const deleteInvoice = async (inv: any) => {
    if (inv.status === "paid") { toast.error("Tagihan lunas tidak bisa dihapus"); return; }
    if (!confirm(`Hapus tagihan ${inv.period_label}?\nTagihan yang sudah dibayar tidak akan dihapus.`)) return;
    setBusy(`del-${inv.id}`);
    const { error } = await supabase.from("spp_invoices").delete().eq("id", inv.id).neq("status", "paid");
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Tagihan dihapus"); load();
  };

  const sendWa = async (inv: any) => {
    // Selalu pakai nomor terkini dari data siswa (bukan snapshot invoice yang bisa basi)
    const phone = student?.parent_phone || inv.parent_phone;
    const parentName = student?.parent_name || inv.parent_name;
    if (!phone) { toast.error("Wali murid tidak punya nomor WA"); return; }
    if (!inv.payment_url) { toast.error("Buat link pembayaran dulu"); return; }
    const flags = await fetchBendaharaFlags(profile!.school_id);
    if (!flags.wa) { toast.error("Pengiriman WA dinonaktifkan Super Admin untuk sekolah ini"); return; }
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", profile!.school_id).maybeSingle();
    const schoolName = schoolRow?.name || "Sekolah";
    const msg = `*${schoolName} — Tagihan SPP Baru*\n\nYth. Bapak/Ibu *${parentName || "Wali"}*,\n\nTagihan SPP ananda:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : ${fmtIDR(inv.total_amount)}\n• Jatuh tempo: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("id-ID") : "-"}\n\nSilakan lakukan pembayaran via *QRIS / Transfer Bank* pada link berikut:\n${brandPaymentUrl(inv.payment_url)}\n\nTerima kasih.`;
    setBusy(`wa-${inv.id}`);
    toast.loading("Mengirim WA...");
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { school_id: profile!.school_id, phone, message: msg, message_type: "spp_invoice" },
    });
    // Sinkronkan snapshot invoice agar tidak basi lagi
    if (!error && (phone !== inv.parent_phone || parentName !== inv.parent_name)) {
      await supabase.from("spp_invoices").update({ parent_phone: phone, parent_name: parentName }).eq("id", inv.id);
    }
    toast.dismiss(); setBusy(null);
    if (error) toast.error("Gagal kirim"); else toast.success("Terkirim ke WA wali");
  };

  const sendEmail = (inv: any) => {
    if (!inv.payment_url) { toast.error("Buat link dulu"); return; }
    const subject = `Tagihan SPP ${inv.period_label} - ${inv.student_name}`;
    const body = `Yth. ${inv.parent_name || "Wali"},\n\nTagihan SPP ${inv.student_name} (${inv.class_name}) periode ${inv.period_label}: ${fmtIDR(inv.total_amount)}.\nMetode pembayaran: QRIS / Transfer Bank.\n\nLink: ${brandPaymentUrl(inv.payment_url)}\n\nTerima kasih.\nATSkolla - Platform Digital Sekolah`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const downloadPdf = async (inv: any) => {
    if (!profile?.school_id) return;
    setBusy(`pdf-${inv.id}`);
    try {
      const { data: school } = await supabase.from("schools").select("name, address, npsn, logo").eq("id", profile.school_id).maybeSingle();
      await downloadSppInvoicePDF({
        invoice: inv,
        student: { student_id: student?.student_id, nisn: student?.nisn, parent_name: student?.parent_name },
        school: school || { name: "Sekolah" },
        bendahara_name: profile.full_name || null,
      });
      toast.success("Invoice diunduh");
    } catch (e: any) {
      toast.error(e.message || "Gagal mengunduh invoice");
    } finally {
      setBusy(null);
    }
  };

  const openOfflineDialog = async (inv: any) => {
    if (profile?.school_id) {
      const flags = await fetchBendaharaFlags(profile.school_id);
      if (!flags.offline) { toast.error("Pembayaran offline dinonaktifkan Super Admin untuk sekolah ini"); return; }
    }
    setOfflineDialog({ inv, method: "offline_cash", paidDate: new Date().toISOString().slice(0, 10), note: "" });
  };

  const submitOfflinePayment = async () => {
    const { inv, method, paidDate, note } = offlineDialog;
    if (!inv || !profile?.school_id) return;
    if (new Date(paidDate) > new Date()) { toast.error("Tanggal bayar tidak boleh di masa depan"); return; }
    setBusy(`offline-${inv.id}`);
    const paidAtISO = new Date(`${paidDate}T${new Date().toTimeString().slice(0, 8)}`).toISOString();
    const newDescription = note
      ? `${inv.description || ""} | OFFLINE: ${note}`.trim()
      : inv.description;
    const { error } = await supabase.from("spp_invoices").update({
      status: "paid",
      payment_method: method,
      gateway_fee: 0,
      net_amount: 0, // KUNCI: tidak masuk saldo cair
      paid_at: paidAtISO,
      description: newDescription,
    }).eq("id", inv.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Pembayaran offline tercatat. Tidak masuk saldo pencairan.");

    // Otomatis kirim WA konfirmasi ke wali (jika ada nomor)
    if (inv.parent_phone) {
      try {
        await sendOfflinePaidWa({ ...inv, paid_at: paidAtISO, payment_method: method });
      } catch (e) {
        // Tidak menggagalkan flow utama jika WA error
        console.warn("Gagal kirim WA konfirmasi offline:", e);
      }
    } else {
      toast.message("Wali murid belum punya nomor WA — konfirmasi WA dilewati");
    }

    setOfflineDialog((s) => ({ ...s, inv: null }));
    load();
  };

  const sendOfflinePaidWa = async (inv: any) => {
    // Selalu pakai nomor terkini dari data siswa
    const phone = student?.parent_phone || inv.parent_phone;
    const parentName = student?.parent_name || inv.parent_name;
    if (!phone) { toast.error("Wali murid tidak punya nomor WA"); return; }
    const flags = await fetchBendaharaFlags(profile!.school_id);
    if (!flags.wa) { toast.error("Pengiriman WA dinonaktifkan Super Admin untuk sekolah ini"); return; }
    const { data: schoolRow } = await supabase.from("schools").select("name").eq("id", profile!.school_id).maybeSingle();
    const schoolName = schoolRow?.name || "Sekolah";
    const tgl = inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
    const metode = formatPaymentMethod(inv.payment_method).label;
    const msg = `*${schoolName} — Konfirmasi Pembayaran SPP*\n\nYth. Bapak/Ibu *${parentName || "Wali"}*,\n\nPembayaran SPP ananda telah kami terima:\n• Nama    : ${inv.student_name}\n• Kelas   : ${inv.class_name}\n• Periode : ${inv.period_label}\n• Nominal : ${fmtIDR(inv.total_amount)}\n• Metode  : ${metode}\n• Tanggal : ${tgl}\n\nTerima kasih atas pembayarannya.`;
    setBusy(`waoff-${inv.id}`);
    toast.loading("Mengirim WA konfirmasi...");
    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { school_id: profile!.school_id, phone, message: msg, message_type: "spp_paid" },
    });
    if (!error && (phone !== inv.parent_phone || parentName !== inv.parent_name)) {
      await supabase.from("spp_invoices").update({ parent_phone: phone, parent_name: parentName }).eq("id", inv.id);
    }
    toast.dismiss(); setBusy(null);
    if (error) toast.error("Gagal kirim"); else toast.success("Konfirmasi terkirim ke WA wali");
  };

  const downloadAllPaidPdf = async () => {
    if (!profile?.school_id) return;
    const paidList = enrichedInvoices
      .filter(i => (i._displayStatus || i.status) === "paid" && !!i.paid_at)
      .sort((a, b) => (a.period_year - b.period_year) || (a.period_month - b.period_month));
    if (paidList.length === 0) { toast.error("Belum ada invoice lunas yang valid"); return; }
    setBusy("bulk-all");
    toast.loading(`Menyusun rekap ${paidList.length} pembayaran lunas...`);
    try {
      const { data: school } = await supabase.from("schools").select("name, address, npsn, logo, whatsapp, email").eq("id", profile.school_id).maybeSingle();
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      const M = 15;
      let y = 14;

      // Logo
      if (school?.logo) {
        try {
          const res = await fetch(school.logo);
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob);
          });
          doc.addImage(dataUrl, "PNG", M, y, 22, 22);
        } catch {/* skip */}
      }
      doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(20,20,20);
      doc.text((school?.name || "Sekolah").toUpperCase(), W/2, y+6, { align: "center" });
      doc.setFont("times", "normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
      if (school?.address) doc.text(school.address, W/2, y+11, { align: "center", maxWidth: 150 });
      const meta: string[] = [];
      if (school?.npsn) meta.push(`NPSN: ${school.npsn}`);
      if (school?.whatsapp) meta.push(`WA: ${school.whatsapp}`);
      if (school?.email) meta.push(`Email: ${school.email}`);
      if (meta.length) doc.text(meta.join("  •  "), W/2, y+16, { align: "center" });

      y = 38;
      doc.setDrawColor(0,0,0); doc.setLineWidth(0.7); doc.line(M, y, W-M, y);
      doc.setLineWidth(0.25); doc.line(M, y+1.2, W-M, y+1.2);

      // Title
      y += 9;
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20,20,20);
      doc.text("REKAP PEMBAYARAN SPP LUNAS", W/2, y, { align: "center" });

      // Info siswa
      y += 8;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(50,50,50);
      const infoRows: [string, string][] = [
        ["Nama Siswa", student?.name || "-"],
        ["NIS / NISN", `${student?.student_id || "-"}${student?.nisn ? " / " + student.nisn : ""}`],
        ["Kelas", student?.class || "-"],
        ["Wali Murid", student?.parent_name || "-"],
        ["Tahun Ajaran", `TA ${ay}`],
        ["Tanggal Cetak", new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
      ];
      const colW = (W - 2*M) / 2;
      infoRows.forEach((r, i) => {
        const col = i % 2; const row = Math.floor(i / 2);
        const x = M + col * colW;
        const yy = y + row * 5;
        doc.setFont("helvetica", "normal"); doc.setTextColor(110,110,110);
        doc.text(r[0], x, yy);
        doc.setFont("helvetica", "bold"); doc.setTextColor(30,30,30);
        doc.text(": " + r[1], x + 28, yy);
      });
      y += Math.ceil(infoRows.length / 2) * 5 + 3;

      // Tabel rincian
      const body = paidList.map((inv, idx) => [
        String(idx + 1),
        inv.invoice_number || "-",
        inv.period_label || `${MONTHS[(inv.period_month || 1) - 1]} ${inv.period_year}`,
        inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-",
        formatPaymentMethodLabel(inv.payment_method) || "-",
        fmtIDR(inv.amount || 0),
        fmtIDR(inv.denda || 0),
        fmtIDR(inv.total_amount || 0),
      ]);
      const totalGross = paidList.reduce((s, i) => s + (i.amount || 0), 0);
      const totalDenda = paidList.reduce((s, i) => s + (i.denda || 0), 0);
      const totalNet = paidList.reduce((s, i) => s + (i.total_amount || 0), 0);

      autoTable(doc, {
        startY: y,
        head: [["No", "No. Invoice", "Periode", "Tgl Bayar", "Metode", "SPP", "Denda", "Total"]],
        body,
        foot: [[
          { content: "TOTAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
          { content: fmtIDR(totalGross), styles: { halign: "right", fontStyle: "bold" } },
          { content: fmtIDR(totalDenda), styles: { halign: "right", fontStyle: "bold" } },
          { content: fmtIDR(totalNet), styles: { halign: "right", fontStyle: "bold" } },
        ]],
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2, textColor: [40,40,40] },
        headStyles: { fillColor: [91,108,249], textColor: 255, fontStyle: "bold", halign: "center" },
        footStyles: { fillColor: [243,245,252], textColor: [30,30,30] },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 32 },
          2: { cellWidth: 30 },
          3: { cellWidth: 24 },
          4: { cellWidth: 26 },
          5: { halign: "right", cellWidth: 24 },
          6: { halign: "right", cellWidth: 20 },
          7: { halign: "right", cellWidth: 24 },
        },
        margin: { left: M, right: M },
      });

      let endY = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60,60,60);
      doc.text(`Jumlah transaksi lunas: ${paidList.length}`, M, endY);

      // Tanda tangan
      endY += 14;
      if (endY > 250) endY = 250;
      doc.setFontSize(9); doc.setTextColor(40,40,40);
      doc.text(`${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, W - M - 55, endY);
      doc.text("Bendahara Sekolah,", W - M - 55, endY + 5);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(profile.full_name || "(_______________)", W - M - 55, endY + 25);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80,80,80);
      doc.text("NIP/NIK : ........................", W - M - 55, endY + 30);

      doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(150,150,150);
      doc.text(`Dokumen dicetak otomatis pada ${new Date().toLocaleString("id-ID")}`, W/2, 290, { align: "center" });

      const filename = `Rekap-Lunas-${(student?.name || "Siswa").replace(/\s+/g, "_")}-TA${ay.replace("/","-")}.pdf`;
      doc.save(filename);
      toast.dismiss();
      toast.success(`Rekap ${paidList.length} pembayaran berhasil diunduh`);
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || "Gagal mengunduh rekap");
    } finally {
      setBusy(null);
    }
  };


  if (loading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (!student) return <div className="p-12 text-center text-muted-foreground">Siswa tidak ditemukan</div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/bendahara/transaksi")}><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Button>

      {/* Header siswa */}
      <Card className="shadow-elevated border-0 overflow-hidden">
        <div className="relative h-16 sm:h-20 bg-gradient-to-br from-[#5B6CF9] via-[#4c5ded] to-[#3D4FE0] overflow-hidden">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        <CardContent className="relative px-4 sm:px-6 pb-5 pt-0">
          {/* Row 1: Avatar + nama + TA */}
          <div className="flex items-start gap-4 -mt-10">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br from-[#5B6CF9] to-[#3D4FE0] flex items-center justify-center text-white text-3xl font-bold border-4 border-card shadow-elevated shrink-0">
              {student.name[0]}
            </div>
            <div className="flex-1 min-w-0 pt-10 sm:pt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{student.name}</h1>
              <Select value={ay} onValueChange={setAY}>
                <SelectTrigger className="w-full sm:w-40 h-9 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {academicYearList(new Date().getFullYear()).map(a => <SelectItem key={a} value={a}>TA {a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Info siswa */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span>NIS: <strong className="text-foreground font-semibold">{student.student_id}</strong></span>
            {student.nisn && <span>NISN: <strong className="text-foreground font-semibold">{student.nisn}</strong></span>}
            {student.card_number && <span>No. Kartu: <strong className="text-foreground font-semibold font-mono">{student.card_number}</strong></span>}
            <span className="inline-flex items-center gap-1">Kelas: <Badge variant="secondary" className="font-semibold">{student.class}</Badge></span>
            <span>Wali: <strong className="text-foreground font-semibold">{student.parent_name || "-"}</strong></span>
            {student.parent_phone && <span>WA: <strong className="text-foreground font-semibold">{student.parent_phone}</strong></span>}
          </div>


          {/* Row 3: Stat cards */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="bg-muted/40 rounded-xl p-3 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium">Total Tagihan TA</p>
              <p className="text-base sm:text-lg font-extrabold mt-0.5 truncate">{fmtIDR(stats.totalTagihan)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium">Sudah Dibayar</p>
              <p className="text-base sm:text-lg font-extrabold text-emerald-600 mt-0.5 truncate">{fmtIDR(stats.totalBayar)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium">Sisa Tagihan</p>
              <p className="text-base sm:text-lg font-extrabold text-red-600 mt-0.5 truncate">{fmtIDR(stats.sisa)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium">Pelunasan</p>
              <p className="text-base sm:text-lg font-extrabold mt-0.5">{pct}%</p>
              <Progress value={pct} className="h-1.5 mt-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid 12 bulan */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Status Per Bulan – TA {ay}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {enrichedGrid.map(g => {
              const status = g.inv?._displayStatus || g.inv?.status || "unpaid";
              const colorMap: any = {
                paid: "border-emerald-500/40 bg-emerald-500/5",
                pending: "border-amber-500/40 bg-amber-500/5",
                unpaid: "border-slate-300 dark:border-slate-700",
                failed: "border-red-500/40 bg-red-500/5",
                expired: "border-orange-500/40 bg-orange-500/5",
              };
              return (
                <div key={`${g.year}-${g.month}`} className={`relative rounded-xl border-2 p-3 ${colorMap[status]}`}>
                  <p className="text-[11px] font-bold text-muted-foreground">{MONTHS[g.month - 1]}</p>
                  <p className="text-[10px] text-muted-foreground">{g.year}</p>
                  <div className="mt-2"><StatusBadge status={status} /></div>
                  {g.inv && <p className="text-xs font-semibold mt-2">{fmtIDR(g.inv.total_amount)}</p>}
                  {g.inv && (status === "unpaid" || status === "failed") && !g.inv.payment_url && (
                    <Button size="sm" variant="outline" className="mt-2 w-full text-[10px] h-7" disabled={busy === `link-${g.inv.id}`} onClick={() => createPaymentLink(g.inv)}>
                      {busy === `link-${g.inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "+ Buat"}
                    </Button>
                  )}
                  {!g.inv && <Button size="sm" variant="outline" className="mt-2 w-full text-[10px] h-7" disabled={busy === `create-${g.month}-${g.year}`} onClick={() => createInvoiceFor(g.month, g.year)}>
                    {busy === `create-${g.month}-${g.year}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "+ Buat"}
                  </Button>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabel riwayat */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Riwayat Pembayaran SPP</CardTitle>
          <Button size="sm" className="bg-[#5B6CF9] hover:bg-[#4c5ded]" disabled={busy === "bulk-all"} onClick={() => downloadAllPaidPdf()}>
            {busy === "bulk-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Export Semua Lunas
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="[&_th]:whitespace-nowrap">
                <TableHead>Bulan</TableHead><TableHead>Invoice</TableHead><TableHead>Nominal</TableHead>
                <TableHead>Tgl Bayar</TableHead><TableHead>Metode</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {enrichedInvoices.filter(i => (i.bill_type || "spp") !== "custom").length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada tagihan SPP</TableCell></TableRow>}
                {enrichedInvoices
                  .filter((inv) => {
                    if ((inv.bill_type || "spp") === "custom") return false;
                    const a = academicYearOf(inv.period_month, inv.period_year);
                    return a === ay;
                  })
                  .sort((a, b) => (a.period_year - b.period_year) || (a.period_month - b.period_month) || (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
                  .map((inv) => {
                  const dStatus = inv._displayStatus || inv.status;
                  return (
                    <TableRow key={inv.id} className={`[&>td]:whitespace-nowrap ${inv.status === "expired" ? "opacity-60" : ""}`}>
                      <TableCell className="font-medium text-sm">{inv.period_label}</TableCell>
                      <TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell>
                      <TableCell className="font-semibold">{fmtIDR(inv.total_amount)}</TableCell>
                      <TableCell className="text-xs">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const m = formatPaymentMethod(inv.payment_method);
                          if (!inv.payment_method) return "-";
                          return (
                            <Badge variant="outline" className={m.isOffline ? "border-slate-400 text-slate-700 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300" : "border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"}>
                              {m.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell><StatusBadge status={dStatus} /></TableCell>
                      <TableCell className="text-right">
                        {dStatus === "pending" || dStatus === "unpaid" || dStatus === "failed" ? (
                          <div className="flex flex-nowrap gap-1 justify-end">
                            {!inv.payment_url ? (
                              <Button size="sm" className="bg-[#5B6CF9] hover:bg-[#4c5ded] h-8 px-2.5" disabled={busy === `link-${inv.id}`} onClick={() => createPaymentLink(inv)}>
                                {busy === `link-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><LinkIcon className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Buat Link</span></>}
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => copyLink(brandPaymentUrl(inv.payment_url))} title="Salin"><Copy className="h-3 w-3" /></Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPaymentIframe(brandPaymentUrl(inv.payment_url))} title="Buka di dashboard"><LinkIcon className="h-3 w-3" /></Button>
                                {flags.wa && (
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2.5" disabled={busy === `wa-${inv.id}`} onClick={() => sendWa(inv)} title="Kirim WA"><MessageCircle className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">WA</span></Button>
                                )}
                                {/* Tombol Email dinonaktifkan sementara */}
                              </>
                            )}
                            {flags.offline && (
                              <Button size="sm" variant="outline" className="h-8 px-2.5 border-slate-400 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => openOfflineDialog(inv)} title="Catat pembayaran tunai/transfer manual">
                                <Banknote className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Bayar Offline</span>
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50" disabled={busy === `del-${inv.id}`} onClick={() => deleteInvoice(inv)} title="Hapus tagihan">
                              {busy === `del-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        ) : dStatus === "expired" ? (
                          <div className="flex flex-nowrap gap-1 justify-end">
                            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white h-8 px-2.5" disabled={busy === `link-${inv.id}`} onClick={() => createPaymentLink(inv, true)} title="Buat Ulang Link">
                              {busy === `link-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Buat Ulang Link</span></>}
                            </Button>
                            {flags.offline && (
                              <Button size="sm" variant="outline" className="h-8 px-2.5 border-slate-400 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => openOfflineDialog(inv)} title="Catat pembayaran tunai/transfer manual">
                                <Banknote className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Bayar Offline</span>
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50" disabled={busy === `del-${inv.id}`} onClick={() => deleteInvoice(inv)} title="Hapus tagihan">
                              {busy === `del-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        ) : dStatus === "paid" ? (
                          <div className="flex flex-nowrap gap-1 justify-end">
                            <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={busy === `pdf-${inv.id}`} onClick={() => downloadPdf(inv)} title="Download Invoice">
                              {busy === `pdf-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Download className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Invoice</span></>}
                            </Button>
                            {flags.wa && formatPaymentMethod(inv.payment_method).isOffline && inv.parent_phone && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2.5" disabled={busy === `waoff-${inv.id}`} onClick={() => sendOfflinePaidWa(inv)} title="Kirim konfirmasi lunas via WA">
                                {busy === `waoff-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><MessageCircle className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Notif WA</span></>}
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Riwayat Tagihan Lainnya (Custom: Ujian, Praktek, dll) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Riwayat Tagihan Lainnya
              <Badge variant="outline" className="border-violet-500/40 text-violet-700 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300">Non-SPP</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Tagihan Ujian, Praktek, Seragam, dan tagihan lain di luar SPP rutin.</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="[&_th]:whitespace-nowrap">
                <TableHead>Jenis</TableHead><TableHead>Kategori</TableHead><TableHead>Invoice</TableHead><TableHead>Nominal</TableHead>
                <TableHead>Tgl Bayar</TableHead><TableHead>Metode</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {enrichedInvoices.filter(i => (i.bill_type || "spp") === "custom").length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada Tagihan Lainnya</TableCell></TableRow>}
                {enrichedInvoices
                  .filter((inv) => (inv.bill_type || "spp") === "custom")
                  .sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
                  .map((inv) => {
                    const dStatus = inv._displayStatus || inv.status;
                    return (
                      <TableRow key={inv.id} className={`[&>td]:whitespace-nowrap ${inv.status === "expired" ? "opacity-60" : ""}`}>
                        <TableCell className="font-medium text-sm">{inv.period_label}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="border-violet-400/50 text-violet-700 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300">{inv.bill_category || "Lainnya"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell>
                        <TableCell className="font-semibold">{fmtIDR(inv.total_amount)}</TableCell>
                        <TableCell className="text-xs">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                        <TableCell className="text-xs">
                          {(() => {
                            const m = formatPaymentMethod(inv.payment_method);
                            if (!inv.payment_method) return "-";
                            return (
                              <Badge variant="outline" className={m.isOffline ? "border-slate-400 text-slate-700 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300" : "border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"}>
                                {m.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell><StatusBadge status={dStatus} /></TableCell>
                        <TableCell className="text-right">
                          {dStatus === "pending" || dStatus === "unpaid" || dStatus === "failed" ? (
                            <div className="flex flex-nowrap gap-1 justify-end">
                              {!inv.payment_url ? (
                                <Button size="sm" className="bg-[#5B6CF9] hover:bg-[#4c5ded] h-8 px-2.5" disabled={busy === `link-${inv.id}`} onClick={() => createPaymentLink(inv)}>
                                  {busy === `link-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><LinkIcon className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Buat Link</span></>}
                                </Button>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => copyLink(brandPaymentUrl(inv.payment_url))} title="Salin"><Copy className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPaymentIframe(brandPaymentUrl(inv.payment_url))} title="Buka di dashboard"><LinkIcon className="h-3 w-3" /></Button>
                                  {flags.wa && (
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2.5" disabled={busy === `wa-${inv.id}`} onClick={() => sendWa(inv)} title="Kirim WA"><MessageCircle className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">WA</span></Button>
                                  )}
                                </>
                              )}
                              {flags.offline && (
                                <Button size="sm" variant="outline" className="h-8 px-2.5 border-slate-400 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => openOfflineDialog(inv)} title="Catat pembayaran tunai/transfer manual">
                                  <Banknote className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Bayar Offline</span>
                                </Button>
                              )}
                              {flags.installment && (
                                <Button size="sm" variant="outline" className="h-8 px-2.5 border-[#5B6CF9]/40 text-[#5B6CF9] hover:bg-[#5B6CF9]/10" onClick={() => setInstallmentInv(inv)} title="Kelola cicilan tagihan ini">
                                  <Wallet className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">{inv.allow_installment ? "Cicilan" : "Aktifkan Cicilan"}</span>
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50" disabled={busy === `del-${inv.id}`} onClick={() => deleteInvoice(inv)} title="Hapus tagihan">
                                {busy === `del-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          ) : dStatus === "expired" ? (
                            <div className="flex flex-nowrap gap-1 justify-end">
                              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white h-8 px-2.5" disabled={busy === `link-${inv.id}`} onClick={() => createPaymentLink(inv, true)} title="Buat Ulang Link">
                                {busy === `link-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Buat Ulang Link</span></>}
                              </Button>
                              {flags.offline && (
                                <Button size="sm" variant="outline" className="h-8 px-2.5 border-slate-400 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => openOfflineDialog(inv)} title="Catat pembayaran tunai/transfer manual">
                                  <Banknote className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Bayar Offline</span>
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50" disabled={busy === `del-${inv.id}`} onClick={() => deleteInvoice(inv)} title="Hapus tagihan">
                                {busy === `del-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          ) : dStatus === "paid" ? (
                            <div className="flex flex-nowrap gap-1 justify-end">
                              <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={busy === `pdf-${inv.id}`} onClick={() => downloadPdf(inv)} title="Download Invoice">
                                {busy === `pdf-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Download className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Invoice</span></>}
                              </Button>
                              {flags.wa && formatPaymentMethod(inv.payment_method).isOffline && inv.parent_phone && (
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2.5" disabled={busy === `waoff-${inv.id}`} onClick={() => sendOfflinePaidWa(inv)} title="Kirim konfirmasi lunas via WA">
                                  {busy === `waoff-${inv.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><MessageCircle className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Notif WA</span></>}
                                </Button>
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>



      <PaymentIframeDialog
        open={!!paymentIframe}
        paymentUrl={paymentIframe}
        title="Pratinjau Pembayaran — QRIS / Transfer Bank"
        onClose={() => { setPaymentIframe(null); load(); }}
      />

      {/* Dialog: Catat Pembayaran Offline */}
      <Dialog open={!!offlineDialog.inv} onOpenChange={(o) => { if (!o) setOfflineDialog((s) => ({ ...s, inv: null })); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-slate-600" /> Catat Pembayaran Offline
            </DialogTitle>
            <DialogDescription>
              Catat pelunasan SPP tunai / transfer manual ke sekolah.
            </DialogDescription>
          </DialogHeader>

          {offlineDialog.inv && (
            <div className="space-y-4">
              {/* Banner Peringatan */}
              <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                  <p className="font-bold mb-1">Tidak masuk pencairan online</p>
                  <p>Tercatat <b>LUNAS</b> di laporan, tapi <b>tidak menambah saldo pencairan</b> karena uang langsung diterima sekolah.</p>
                </div>
              </div>

              {/* Ringkasan Invoice */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Siswa</span><span className="font-semibold">{offlineDialog.inv.student_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Periode</span><span className="font-semibold">{offlineDialog.inv.period_label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Nominal</span><span className="font-bold text-base text-[#5B6CF9]">{fmtIDR(offlineDialog.inv.total_amount)}</span></div>
              </div>

              {/* Pilih Metode */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">Metode Pembayaran</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOfflineDialog((s) => ({ ...s, method: "offline_cash" }))}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${offlineDialog.method === "offline_cash" ? "border-[#5B6CF9] bg-[#5B6CF9]/5" : "border-border hover:border-[#5B6CF9]/40"}`}
                  >
                    <Banknote className={`h-4 w-4 mb-1 ${offlineDialog.method === "offline_cash" ? "text-[#5B6CF9]" : "text-muted-foreground"}`} />
                    <p className="text-xs font-bold">Tunai</p>
                    <p className="text-[10px] text-muted-foreground">Bayar langsung di sekolah</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfflineDialog((s) => ({ ...s, method: "offline_transfer" }))}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${offlineDialog.method === "offline_transfer" ? "border-[#5B6CF9] bg-[#5B6CF9]/5" : "border-border hover:border-[#5B6CF9]/40"}`}
                  >
                    <Landmark className={`h-4 w-4 mb-1 ${offlineDialog.method === "offline_transfer" ? "text-[#5B6CF9]" : "text-muted-foreground"}`} />
                    <p className="text-xs font-bold">Transfer Manual</p>
                    <p className="text-[10px] text-muted-foreground">Ke rekening sekolah</p>
                  </button>
                </div>
              </div>

              {/* Tanggal */}
              <div>
                <Label htmlFor="offline-date" className="text-xs font-semibold mb-1 block">Tanggal Pembayaran</Label>
                <Input
                  id="offline-date"
                  type="date"
                  value={offlineDialog.paidDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setOfflineDialog((s) => ({ ...s, paidDate: e.target.value }))}
                />
              </div>

              {/* Catatan */}
              <div>
                <Label htmlFor="offline-note" className="text-xs font-semibold mb-1 block">Catatan (opsional)</Label>
                <Input
                  id="offline-note"
                  placeholder={offlineDialog.method === "offline_cash" ? "Mis. Diterima oleh Bu Siti" : "Mis. Ref TRF #ABC123"}
                  value={offlineDialog.note}
                  onChange={(e) => setOfflineDialog((s) => ({ ...s, note: e.target.value }))}
                />
              </div>

              {/* Tombol */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setOfflineDialog((s) => ({ ...s, inv: null }))} disabled={busy?.startsWith("offline-")}>
                  Batal
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submitOfflinePayment} disabled={busy?.startsWith("offline-")}>
                  {busy?.startsWith("offline-") ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Konfirmasi Lunas</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentMethodPicker
        open={!!linkPicker}
        onOpenChange={(o) => { if (!linkPickerLoading && !o) setLinkPicker(null); }}
        billAmount={linkPicker?.inv?.total_amount || 0}
        title="Pilih Metode Pembayaran"
        subtitle={linkPicker?.inv ? `Tagihan SPP ${linkPicker.inv.period_label || ""}` : undefined}
        loading={linkPickerLoading}
        onConfirm={confirmCreatePaymentLink}
      />

      <InstallmentDialog
        open={!!installmentInv}
        invoice={installmentInv}
        schoolInstallmentEnabled={flags.installment}
        onClose={() => setInstallmentInv(null)}
        onChanged={load}
      />
    </div>
  );
}

// ============ IMPORT / EXPORT ============
export function BendaharaImportExport() {
  const { profile } = useAuth();
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [validRows, setValidRows] = useState<any[]>([]);
  const [errorRows, setErrorRows] = useState<{ row: number; error: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [school, setSchool] = useState<any>(null);

  // Export filters
  const currentAY = academicYearOf(new Date().getMonth() + 1, new Date().getFullYear());
  const [expClass, setExpClass] = useState<string>("all");
  const [expAY, setExpAY] = useState<string>(currentAY);
  const [expStatus, setExpStatus] = useState<string>("all");
  const [expCount, setExpCount] = useState({ total: 0, paid: 0, unpaid: 0, sum: 0 });

  useEffect(() => {
    if (!profile?.school_id) return;
    Promise.all([
      supabase.from("students").select("id, name, student_id, class, parent_name, parent_phone").eq("school_id", profile.school_id),
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("schools").select("name, npsn, address").eq("id", profile.school_id).maybeSingle(),
    ]).then(([s, c, sc]) => {
      setStudents(s.data || []);
      setClasses((c.data || []).map((x: any) => x.name));
      setSchool(sc.data);
    });
  }, [profile?.school_id]);

  // Live preview count
  useEffect(() => {
    if (!profile?.school_id) return;
    let q = supabase.from("spp_invoices").select("*", { count: "exact" }).eq("school_id", profile.school_id);
    if (expClass !== "all") q = q.eq("class_name", expClass);
    if (expStatus !== "all") q = q.eq("status", expStatus);
    q.then(({ data }) => {
      const filtered = (data || []).filter(i => expAY === "all" || academicYearOf(i.period_month, i.period_year) === expAY);
      setExpCount({
        total: filtered.length,
        paid: filtered.filter(i => i.status === "paid").length,
        unpaid: filtered.filter(i => i.status !== "paid").length,
        sum: filtered.reduce((a, i) => a + (i.total_amount || 0), 0),
      });
    });
  }, [profile?.school_id, expClass, expAY, expStatus]);

  const downloadTemplate = () => {
    const sample = students.slice(0, 5);
    const header = ["nis", "nama_siswa", "kelas", "tahun_ajaran", "bulan", "tahun", "nominal", "tanggal_jatuh_tempo", "denda"];
    const exampleRows = sample.length > 0
      ? sample.map(s => [s.student_id, s.name, s.class, currentAY, "1", String(new Date().getFullYear() + 1), "150000", `${new Date().getFullYear() + 1}-01-10`, "0"])
      : [["12345", "Ahmad Fauzan", "VII A", "2026/2027", "1", "2027", "150000", "2027-01-10", "0"]];
    const ws = XLSX.utils.aoa_to_sheet([header, ...exampleRows]);
    ws["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tagihan SPP");

    // Add reference sheet with classes & students
    const refData = [
      ["DAFTAR KELAS"], ...classes.map(c => [c]),
      [""], ["DAFTAR SISWA (NIS — Nama — Kelas)"],
      ...students.map(s => [s.student_id, s.name, s.class]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsRef, "Referensi");

    XLSX.writeFile(wb, `template-import-spp-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Template diunduh — sheet 'Referensi' berisi daftar siswa & kelas");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        setPreviewRows(json);

        const valid: any[] = [];
        const errors: { row: number; error: string }[] = [];
        json.forEach((r, idx) => {
          const rowNum = idx + 2;
          const nis = String(r.nis || "").trim();
          const month = parseInt(r.bulan);
          const year = parseInt(r.tahun);
          const nominal = parseInt(r.nominal);
          const denda = parseInt(r.denda) || 0;
          if (!nis) return errors.push({ row: rowNum, error: "NIS kosong" });
          if (!month || month < 1 || month > 12) return errors.push({ row: rowNum, error: "Bulan tidak valid (1-12)" });
          if (!year || year < 2020) return errors.push({ row: rowNum, error: "Tahun tidak valid" });
          if (!nominal || nominal <= 0) return errors.push({ row: rowNum, error: "Nominal harus > 0" });
          const student = students.find(s => s.student_id === nis);
          if (!student) return errors.push({ row: rowNum, error: `NIS ${nis} tidak ditemukan` });
          valid.push({ ...r, _student: student, _month: month, _year: year, _nominal: nominal, _denda: denda });
        });
        setValidRows(valid);
        setErrorRows(errors);
        if (valid.length > 0) toast.success(`${valid.length} baris valid, ${errors.length} error`);
        else toast.error(`Semua baris gagal divalidasi (${errors.length} error)`);
      } catch (err: any) {
        toast.error("Gagal membaca file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const submitImport = async () => {
    if (validRows.length === 0) { toast.error("Tidak ada data valid"); return; }
    setImporting(true);
    const rows = validRows.map(r => {
      const dueDate = r.tanggal_jatuh_tempo ? new Date(r.tanggal_jatuh_tempo) : new Date(r._year, r._month - 1, 10);
      const label = `${MONTHS[r._month - 1]} ${r._year}`;
      const total = r._nominal + r._denda;
      return {
        school_id: profile!.school_id,
        student_id: r._student.id,
        invoice_number: `SPP/${r._year}${String(r._month).padStart(2, "0")}/${r._student.student_id}`,
        student_name: r._student.name,
        class_name: r._student.class,
        parent_name: r._student.parent_name || null,
        parent_phone: r._student.parent_phone || null,
        period_month: r._month, period_year: r._year, period_label: label,
        description: `${r._student.name} - ${r._student.class} - ${label}`,
        amount: r._nominal, denda: r._denda, total_amount: total,
        due_date: dueDate.toISOString().slice(0, 10),
      };
    });
    const { data: existingForImport } = await supabase
      .from("spp_invoices")
      .select("student_id, period_month, period_year, status")
      .eq("school_id", profile!.school_id)
      .in("student_id", rows.map(r => r.student_id));
    const existsKey = new Set(
      (existingForImport || [])
        .filter((e: any) => e.status !== "expired")
        .map((e: any) => `${e.student_id}|${e.period_year}|${e.period_month}`)
    );
    const toInsert = rows.filter(r => !existsKey.has(`${r.student_id}|${r.period_year}|${r.period_month}`));
    if (toInsert.length === 0) {
      setImporting(false);
      toast.info("Semua tagihan sudah ada");
      return;
    }
    const { error } = await supabase.from("spp_invoices").insert(toInsert);
    setImporting(false);
    if (error) toast.error(error.message);
    else { toast.success(`${toInsert.length} tagihan berhasil di-import${toInsert.length < rows.length ? ` (${rows.length - toInsert.length} dilewati)` : ""}`); setPreviewRows([]); setValidRows([]); setErrorRows([]); }
  };

  const exportData = async (format: "xlsx" | "csv" | "pdf") => {
    if (!profile?.school_id) return;
    const tid = toast.loading("Menyiapkan export...");
    let q = supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id);
    if (expClass !== "all") q = q.eq("class_name", expClass);
    if (expStatus !== "all") q = q.eq("status", expStatus);
    const { data: invs } = await q.order("class_name").order("student_name").order("period_year").order("period_month");
    toast.dismiss(tid);
    const filtered = (invs || []).filter(i => expAY === "all" || academicYearOf(i.period_month, i.period_year) === expAY);
    if (filtered.length === 0) { toast.error("Tidak ada data untuk filter ini"); return; }

    const rows = filtered.map((i, idx) => ({
      "No": idx + 1,
      "No. Invoice": i.invoice_number,
      "NIS": students.find(s => s.id === i.student_id)?.student_id || "",
      "Nama Siswa": i.student_name,
      "Kelas": i.class_name,
      "Tahun Ajaran": academicYearOf(i.period_month, i.period_year),
      "Periode": i.period_label,
      "Nama Wali": i.parent_name || "",
      "No. WA Wali": i.parent_phone || "",
      "Nominal": i.amount,
      "Denda": i.denda,
      "Total": i.total_amount,
      "Jatuh Tempo": i.due_date ? new Date(i.due_date).toLocaleDateString("id-ID") : "",
      "Status": i.status === "paid" ? "Lunas" : i.status === "pending" ? "Pending" : i.status === "expired" ? "Kadaluarsa" : "Belum Bayar",
      "Tgl Bayar": i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "",
      "Metode": formatPaymentMethodLabel(i.payment_method),
    }));

    const filterTag = `${expAY === "all" ? "ALL" : expAY.replace("/", "-")}_${expClass === "all" ? "SEMUA-KELAS" : expClass.replace(/\s/g, "-")}_${expStatus.toUpperCase()}`;
    const fname = `SPP_${filterTag}_${new Date().toISOString().slice(0, 10)}`;

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      // Group per class — one sheet per class (national format)
      if (expClass === "all") {
        const grouped = new Map<string, any[]>();
        rows.forEach(r => {
          const cls = String(r["Kelas"]);
          if (!grouped.has(cls)) grouped.set(cls, []);
          grouped.get(cls)!.push(r);
        });
        // Summary sheet
        const summary = Array.from(grouped.entries()).map(([cls, list]) => ({
          "Kelas": cls,
          "Jumlah Tagihan": list.length,
          "Lunas": list.filter(x => x.Status === "Lunas").length,
          "Belum Bayar": list.filter(x => x.Status !== "Lunas").length,
          "Total Tagihan": list.reduce((a, x) => a + (x.Total || 0), 0),
        }));
        const wsSum = XLSX.utils.json_to_sheet(summary);
        wsSum["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsSum, "Ringkasan");
        // Per-class sheet
        Array.from(grouped.entries()).forEach(([cls, list]) => {
          const ws = XLSX.utils.json_to_sheet(list);
          ws["!cols"] = Object.keys(list[0]).map(k => ({ wch: Math.min(Math.max(k.length + 2, 10), 28) }));
          XLSX.utils.book_append_sheet(wb, ws, cls.slice(0, 31));
        });
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.min(Math.max(k.length + 2, 10), 28) }));
        XLSX.utils.book_append_sheet(wb, ws, expClass.slice(0, 31));
      }
      XLSX.writeFile(wb, `${fname}.xlsx`);
    } else if (format === "csv") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${fname}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const doc = new jsPDF("l", "mm", "a4");
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("LAPORAN TAGIHAN SPP", 14, 14);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(school?.name || "", 14, 21);
      doc.setFontSize(9);
      doc.text(`NPSN: ${school?.npsn || "-"}`, 14, 27);
      doc.text(`Tahun Ajaran: ${expAY === "all" ? "Semua" : expAY}  •  Kelas: ${expClass === "all" ? "Semua" : expClass}  •  Status: ${expStatus === "all" ? "Semua" : expStatus}`, 14, 33);
      doc.text(`Total: ${rows.length} tagihan • ${fmtIDR(rows.reduce((a, r) => a + (r.Total || 0), 0))}`, 14, 39);
      autoTable(doc, {
        startY: 45,
        head: [["No", "NIS", "Nama Siswa", "Kelas", "Periode", "Total", "Jatuh Tempo", "Status"]],
        body: rows.map(r => [r.No, r.NIS, r["Nama Siswa"], r.Kelas, r.Periode, fmtIDR(r.Total), r["Jatuh Tempo"], r.Status]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [91, 108, 249], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 249, 252] },
      });
      doc.save(`${fname}.pdf`);
    }
    toast.success("Export selesai");
  };

  return (
    <div className="space-y-4">
      <PageHeader icon={Upload} title="Import Tagihan SPP" subtitle="Unggah tagihan massal dari Excel/CSV. Untuk export laporan, buka menu Laporan & Export." variant="primary" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Tagihan" value={expCount.total} icon={Receipt} gradient="from-indigo-500 to-indigo-600" />
        <StatCard label="Lunas" value={expCount.paid} icon={CheckCircle2} gradient="from-emerald-500 to-emerald-600" />
        <StatCard label="Belum Bayar" value={expCount.unpaid} icon={AlertCircle} gradient="from-amber-500 to-amber-600" />
        <StatCard label="Total Nominal" value={fmtIDR(expCount.sum)} icon={Banknote} gradient="from-sky-500 to-sky-600" />
      </div>

      {/* Import */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-[#5B6CF9]" /> Import Tagihan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border-2 border-dashed border-[#5B6CF9]/30 bg-[#5B6CF9]/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Langkah 1 — Unduh Template</p>
                <p className="text-xs text-muted-foreground">Template berisi sheet Referensi (daftar siswa & kelas Anda)</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}><FileText className="h-4 w-4 mr-2" /> Download Template</Button>
            </div>
          </div>
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-4">
            <p className="text-sm font-semibold mb-2">Langkah 2 — Upload File</p>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="max-w-sm" />
            <p className="text-[11px] text-muted-foreground mt-2">Format: <code className="bg-muted px-1 rounded">nis, nama_siswa, kelas, tahun_ajaran, bulan, tahun, nominal, tanggal_jatuh_tempo, denda</code></p>
          </div>

          {(validRows.length > 0 || errorRows.length > 0) && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-emerald-500 hover:bg-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Valid: {validRows.length}</Badge>
                {errorRows.length > 0 && <Badge className="bg-red-500 hover:bg-red-500"><AlertCircle className="h-3 w-3 mr-1" /> Error: {errorRows.length}</Badge>}
                <Badge variant="secondary">Total: {previewRows.length}</Badge>
              </div>

              {errorRows.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-1">Baris gagal divalidasi:</p>
                  {errorRows.map((e, i) => <p key={i} className="text-[11px] text-red-700 dark:text-red-300">Baris {e.row}: {e.error}</p>)}
                </div>
              )}

              {validRows.length > 0 && (
                <div className="border rounded-lg overflow-x-auto max-h-72">
                  <Table>
                    <TableHeader><TableRow className="bg-muted/40 [&_th]:whitespace-nowrap"><TableHead>NIS</TableHead><TableHead>Nama</TableHead><TableHead>Kelas</TableHead><TableHead>Periode</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {validRows.slice(0, 50).map((r, i) => (
                        <TableRow key={i} className="[&>td]:whitespace-nowrap">
                          <TableCell className="text-xs">{r.nis}</TableCell>
                          <TableCell className="text-xs">{r._student.name}</TableCell>
                          <TableCell className="text-xs"><Badge variant="secondary">{r._student.class}</Badge></TableCell>
                          <TableCell className="text-xs">{MONTHS[r._month - 1]} {r._year}</TableCell>
                          <TableCell className="text-xs font-semibold text-right">{fmtIDR(r._nominal + r._denda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 50 && <p className="text-[11px] text-center py-2 text-muted-foreground">+{validRows.length - 50} baris lagi…</p>}
                </div>
              )}

              <Button disabled={importing || validRows.length === 0} onClick={submitImport} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded]">
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import {validRows.length} Tagihan
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ SALDO & LEDGER ============
export function BendaharaSaldo() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const syncingRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!profile?.school_id) { setLoading(false); return; }
    const [invRes, stlRes] = await Promise.all([
      supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id).eq("status", "paid").not("payment_method", "in", "(offline_cash,offline_transfer)").order("paid_at", { ascending: false }),
      supabase.from("spp_settlements").select("*").eq("school_id", profile.school_id),
    ]);
    setItems(invRes.data || []);
    setSettlements(stlRes.data || []);
    setLoading(false);
  }, [profile?.school_id]);

  // Render dulu dari DB lokal; sync gateway berjalan di background.
  useEffect(() => {
    fetchAll();
    if (profile?.school_id && !syncingRef.current) {
      syncingRef.current = true;
      supabase.functions.invoke("spp-mayar", { body: { action: "sync_paid_invoices" } })
        .catch(() => null)
        .finally(() => { syncingRef.current = false; });
    }
  }, [fetchAll, profile?.school_id]);

  // Realtime: refresh saat ada perubahan invoice/settlement
  useEffect(() => {
    if (!profile?.school_id) return;
    const channel = supabase
      .channel("bendahara-saldo-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices", filter: `school_id=eq.${profile.school_id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_settlements", filter: `school_id=eq.${profile.school_id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.school_id, fetchAll]);

  const totals = items.reduce((acc, i) => ({
    gross: acc.gross + (i.total_amount || 0),
    net: acc.net + (i.net_amount || i.total_amount || 0),
  }), { gross: 0, net: 0 });

  const txCount = items.length;

  // Saldo aktif harus sama dengan halaman Pencairan:
  // hanya transaksi online yang sudah lunas dan belum terikat settlement.
  const activeItems = items.filter((i) => !i.settlement_id);
  const activeTotals = activeItems.reduce((acc, i) => ({
    gross: acc.gross + (i.total_amount || 0),
    net: acc.net + (i.net_amount || i.total_amount || 0),
  }), { gross: 0, net: 0 });

  // Saldo — sumber kebenaran: spp_invoices (sinkron dengan halaman Pencairan)
  // "Sudah Dicairkan" = invoice online lunas yang sudah terikat settlement
  const settledItems = items.filter((i) => !!i.settlement_id);
  const settledGross = settledItems.reduce((s, x) => s + (x.total_amount || 0), 0);
  const settledCount = settledItems.length;
  const settledFeePencairan = settlements.filter(s => s.status === "paid").reduce((s, x) => s + (x.withdraw_fee || 0), 0);
  const pendingPayout = settlements.filter(s => ["pending", "approved"].includes(s.status)).reduce((s, x) => s + (x.total_amount || x.total_net || 0), 0);
  const activeBalance = Math.max(0, activeTotals.gross);
  const lockedGross = Math.max(0, totals.gross - activeTotals.gross);

  // Banner info: dismiss selama 7 hari via localStorage
  const [showSaldoInfo, setShowSaldoInfo] = useState(() => {
    try {
      const ts = Number(localStorage.getItem("saldo_info_dismissed_at") || 0);
      if (!ts) return true;
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - ts > SEVEN_DAYS;
    } catch { return true; }
  });
  const dismissSaldoInfo = () => {
    try { localStorage.setItem("saldo_info_dismissed_at", String(Date.now())); } catch {}
    setShowSaldoInfo(false);
  };

  return (
    <div className="space-y-4">

      {/* Saldo Aktif - Highlight Card */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-[#5B6CF9] via-[#4c5ded] to-[#3D4FE0] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <CardContent className="p-5 relative">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4" />
            <p className="text-xs font-medium opacity-90">Saldo Aktif (Siap Dicairkan)</p>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </span>
          </div>
          <p className="text-3xl md:text-4xl font-extrabold tracking-tight">{fmtIDR(activeBalance)}</p>
          <p className="text-[11px] opacity-80 mt-1">Total Bruto {fmtIDR(totals.gross)} − Sudah/akan dicairkan {fmtIDR(lockedGross)}</p>
        </CardContent>
      </Card>

      {/* Info banner: pembayaran offline (bisa ditutup, muncul lagi setelah 7 hari) */}
      {showSaldoInfo && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed flex-1">
            <b>Saldo Aktif</b> hanya berisi pembayaran <b>online (QRIS / Transfer Bank)</b> yang belum diajukan pencairan. Pembayaran <b>offline</b> (tunai / transfer manual ke rekening sekolah) <b>tidak masuk</b> ke saldo pencairan karena uangnya sudah diterima sekolah secara langsung.
          </div>
          <button
            onClick={dismissSaldoInfo}
            className="shrink-0 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
            aria-label="Tutup info"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Ringkasan Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Total Bruto SPP" value={fmtIDR(totals.gross)} sub={`${txCount} transaksi`} icon={TrendingUp} gradient="from-blue-500 to-indigo-600" />
        <StatCard label="Sudah Dicairkan" value={fmtIDR(settledGross)} sub={`${settledCount} transaksi`} icon={ArrowDownToLine} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Pending Pencairan" value={fmtIDR(pendingPayout)} sub="menunggu admin" icon={Loader2} gradient="from-amber-500 to-orange-600" />
      </div>

      {/* Tabel Riwayat */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Riwayat Transaksi Lunas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="whitespace-nowrap">Deskripsi</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Nominal</TableHead>
                  <TableHead className="whitespace-nowrap">Status Cair</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada transaksi paid</TableCell></TableRow>}
                {items.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs whitespace-nowrap">{i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{i.description}</TableCell>
                    <TableCell className="text-sm text-right font-semibold text-emerald-600 whitespace-nowrap">{fmtIDR(i.total_amount)}</TableCell>
                    <TableCell>
                      {i.settlement_id
                        ? <Badge className="bg-emerald-500 text-[10px] whitespace-nowrap">DICAIRKAN</Badge>
                        : <Badge className="bg-amber-500 text-[10px] whitespace-nowrap">SALDO AKTIF</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ============ PENCAIRAN + RIWAYAT (gabungan) ============
export function BendaharaPencairan() {
  const { profile, user } = useAuth();
  const [available, setAvailable] = useState({ count: 0, gross: 0, fee: 0, net: 0 });
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState({ onlineTotal: 0, onlineSettled: 0, offlineCount: 0, offlineGross: 0 });
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bankManageOpen, setBankManageOpen] = useState(false);
  const [bank, setBank] = useState({ bank_name: "", account_number: "", account_holder: "", notes: "", account_type: "bank", responsible_user_id: "" });
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [newAccount, setNewAccount] = useState({ bank_name: "", account_number: "", account_holder: "", notes: "", is_default: false, account_type: "bank" as "bank" | "ewallet", responsible_user_id: "" });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSettlement, setDetailSettlement] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const openSettlementDetail = async (s: any) => {
    setDetailSettlement(s);
    setDetailItems([]);
    setDetailOpen(true);
    setDetailLoading(true);
    const { data } = await supabase.from("spp_invoices")
      .select("id, invoice_number, student_name, class_name, period_label, total_amount, gateway_fee, net_amount, payment_method, paid_at")
      .eq("settlement_id", s.id)
      .order("paid_at", { ascending: true });
    setDetailItems((data as any[]) || []);
    setDetailLoading(false);
  };
  const syncingRef = useRef(false);
  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpPhoneMasked, setOtpPhoneMasked] = useState("");
  const [otpResendIn, setOtpResendIn] = useState(0);

  useEffect(() => {
    if (otpResendIn <= 0) return;
    const t = setTimeout(() => setOtpResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendIn]);

  // Auto-open bank manager via ?manage=bank
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("manage") === "bank") setBankManageOpen(true);
  }, []);

  const loadAccounts = async () => {
    if (!profile?.school_id) return;
    const { data } = await supabase.from("bendahara_bank_accounts" as any)
      .select("*").eq("school_id", profile.school_id)
      .order("is_default", { ascending: false }).order("created_at", { ascending: false });
    const list = (data as any[]) || [];
    setSavedAccounts(list);
    if (list.length && !selectedAccountId) {
      const def = list.find((x: any) => x.is_default) || list[0];
      setSelectedAccountId(def.id);
      setBank({ bank_name: def.bank_name, account_number: def.account_number, account_holder: def.account_holder, notes: def.notes || "", account_type: def.account_type || "bank", responsible_user_id: def.responsible_user_id || "" });
    }
  };

  const loadStaff = async () => {
    if (!profile?.school_id) return;
    const { data: roleRows } = await supabase.from("user_roles")
      .select("user_id, role").in("role", ["bendahara"] as any);
    const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)));
    if (ids.length === 0) { setStaffList([]); return; }
    const { data: profs } = await supabase.from("profiles")
      .select("user_id, full_name, phone, school_id")
      .in("user_id", ids).eq("school_id", profile.school_id);
    const roleMap = new Map<string, string[]>();
    (roleRows || []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    setStaffList((profs || []).map((p: any) => ({ ...p, roles: roleMap.get(p.user_id) || [] })));
  };

  useEffect(() => {
    if (!profile?.school_id) { setLoadingHistory(false); return; }
    let cancelled = false;

    const loadLocal = async () => {
      // Satu query saja: ambil semua paid online sekaligus, lalu bagi di client.
      const [paidRes, hRes] = await Promise.all([
        supabase.from("spp_invoices")
          .select("id, payment_method, settlement_id, total_amount, gateway_fee, net_amount")
          .eq("school_id", profile.school_id)
          .eq("status", "paid"),
        supabase.from("spp_settlements").select("*").eq("school_id", profile.school_id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const allPaid = (paidRes.data || []) as any[];
      const isOffline = (m: string | null) => {
        const v = (m || "").toLowerCase();
        return v === "offline_cash" || v === "offline_transfer";
      };
      const online = allPaid.filter((x) => !isOffline(x.payment_method));
      const offline = allPaid.filter((x) => isOffline(x.payment_method));
      const availableList = online.filter((x) => !x.settlement_id);

      setAvailableItems(availableList);
      setAvailable({
        count: availableList.length,
        gross: availableList.reduce((s, i) => s + (i.total_amount || 0), 0),
        fee: availableList.reduce((s, i) => s + (i.gateway_fee || 0), 0),
        net: availableList.reduce((s, i) => s + (i.net_amount || 0), 0),
      });

      const invoiceBySettlement = online.reduce((map, x) => {
        if (!x.settlement_id) return map;
        const current = map.get(x.settlement_id) || { count: 0, gross: 0, fee: 0, net: 0 };
        current.count += 1;
        current.gross += x.total_amount || 0;
        current.fee += x.gateway_fee || 0;
        current.net += x.net_amount || 0;
        map.set(x.settlement_id, current);
        return map;
      }, new Map<string, { count: number; gross: number; fee: number; net: number }>());

      const reconciledHistory = ((hRes.data || []) as any[]).map((s) => {
        const inv = invoiceBySettlement.get(s.id) || { count: 0, gross: 0, fee: 0, net: 0 };
        const withdrawFee = s.withdraw_fee ?? 3000;
        return {
          ...s,
          total_transactions: inv.count,
          total_gross: inv.gross,
          total_gateway_fee: inv.fee,
          total_net: inv.net,
          final_payout: Math.max(0, inv.net - withdrawFee),
        };
      });

      setBreakdown({
        onlineTotal: online.length,
        onlineSettled: online.filter((x) => x.settlement_id).length,
        offlineCount: offline.length,
        offlineGross: offline.reduce((s, x) => s + (x.total_amount || 0), 0),
      });
      setHistory(reconciledHistory);
      setLoadingHistory(false);
    };

    // 1) Render cepat dari DB lokal
    loadLocal();
    loadAccounts();
    loadStaff();

    // 2) Sync gateway di background; refresh data setelah selesai (non-blocking UI)
    if (!syncingRef.current) {
      syncingRef.current = true;
      supabase.functions.invoke("spp-mayar", { body: { action: "sync_paid_invoices" } })
        .catch(() => null)
        .finally(() => {
          syncingRef.current = false;
          if (!cancelled) loadLocal();
        });
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id, open, refreshKey]);

  // Realtime: refresh saldo & riwayat saat ada perubahan invoice/settlement
  useEffect(() => {
    if (!profile?.school_id) return;
    const channel = supabase
      .channel("bendahara-pencairan-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_invoices", filter: `school_id=eq.${profile.school_id}` }, () => setRefreshKey((k) => k + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_settlements", filter: `school_id=eq.${profile.school_id}` }, () => setRefreshKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.school_id]);

  const finalPayout = Math.max(0, available.gross - 3000);

  const handleSelectAccount = (id: string) => {
    setSelectedAccountId(id);
    const acc = savedAccounts.find((x: any) => x.id === id);
    if (acc) setBank({ bank_name: acc.bank_name, account_number: acc.account_number, account_holder: acc.account_holder, notes: acc.notes || "", account_type: acc.account_type || "bank", responsible_user_id: acc.responsible_user_id || "" });
  };

  const requestSubmit = () => {
    if (available.count === 0) { toast.error("Tidak ada saldo"); return; }
    if (savedAccounts.length === 0) {
      toast.error("Belum ada rekening tersimpan. Tambahkan rekening dulu.");
      setBankManageOpen(true);
      return;
    }
    const acc = savedAccounts.find((x: any) => x.is_default) || savedAccounts[0];
    setBank({ bank_name: acc.bank_name, account_number: acc.account_number, account_holder: acc.account_holder, notes: acc.notes || "", account_type: acc.account_type || "bank", responsible_user_id: acc.responsible_user_id || "" });
    setSelectedAccountId(acc.id);
    setConfirmOpen(true);
  };

  const sendOtp = async () => {
    if (!user?.id || !profile?.school_id) return;
    if (!bank.responsible_user_id) { toast.error("Penanggung jawab belum diatur pada rekening/e-wallet ini"); return; }
    setOtpSending(true);
    const { data, error } = await supabase.functions.invoke("send-bendahara-otp", {
      body: { user_id: user.id, school_id: profile.school_id, responsible_user_id: bank.responsible_user_id },
    });
    setOtpSending(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Gagal mengirim OTP"); return; }
    setOtpPhoneMasked(data?.phone_masked || "");
    setOtpStep(true);
    setOtpCode("");
    setOtpResendIn(60);
    toast.success("Kode OTP dikirim via WhatsApp");
  };

  const submit = async () => {
    if (!user?.id) return;
    if (otpCode.length !== 6) { toast.error("Masukkan 6 digit kode OTP"); return; }
    setSubmitting(true);
    // 1) Verifikasi OTP
    const { data: vData, error: vErr } = await supabase.functions.invoke("verify-bendahara-otp", {
      body: { user_id: user.id, otp_code: otpCode, responsible_user_id: bank.responsible_user_id },
    });
    if (vErr || vData?.error) {
      toast.error(vData?.error || vErr?.message || "OTP tidak valid");
      setSubmitting(false); return;
    }
    // 2) Eksekusi pencairan
    const code = `STL-${Date.now().toString().slice(-8)}`;
    const invoiceIds = availableItems.map((item) => item.id).filter(Boolean);
    if (invoiceIds.length === 0) { toast.error("Tidak ada saldo"); setSubmitting(false); return; }
    const { data: settlement, error } = await supabase.from("spp_settlements").insert({
      school_id: profile!.school_id, settlement_code: code,
      total_transactions: available.count, total_gross: available.gross,
      total_gateway_fee: available.fee, total_net: available.net,
      withdraw_fee: 3000, final_payout: finalPayout,
      ...bank, requested_by: user?.id,
    }).select().single();
    if (error || !settlement) { toast.error(error?.message || "Gagal"); setSubmitting(false); return; }
    await supabase.from("spp_invoices").update({ settlement_id: settlement.id })
      .eq("school_id", profile!.school_id).in("id", invoiceIds).is("settlement_id", null);
    toast.success("Pencairan berhasil diajukan, sedang diproses");
    setConfirmOpen(false); setSubmitting(false); setRefreshKey(k => k + 1);
    setOtpStep(false); setOtpCode(""); setOtpPhoneMasked("");
  };

  const saveAccount = async () => {
    const isEw = newAccount.account_type === "ewallet";
    if (!newAccount.bank_name) { toast.error(isEw ? "Pilih jenis E-Wallet" : "Isi nama bank"); return; }
    if (!newAccount.account_number) { toast.error(isEw ? "Nomor E-Wallet wajib" : "Nomor rekening wajib"); return; }
    if (!newAccount.account_holder) { toast.error("Nama pemilik wajib"); return; }
    if (!newAccount.responsible_user_id) { toast.error("Pilih Penanggung Jawab"); return; }
    if (!profile?.school_id) return;
    if (newAccount.is_default) {
      await supabase.from("bendahara_bank_accounts" as any).update({ is_default: false }).eq("school_id", profile.school_id);
    }
    const { error } = await supabase.from("bendahara_bank_accounts" as any).insert({
      school_id: profile.school_id, ...newAccount, created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(isEw ? "E-Wallet disimpan" : "Rekening disimpan");
    setNewAccount({ bank_name: "", account_number: "", account_holder: "", notes: "", is_default: false, account_type: "bank", responsible_user_id: "" });
    loadAccounts();
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from("bendahara_bank_accounts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rekening dihapus");
    if (selectedAccountId === id) setSelectedAccountId("");
    loadAccounts();
  };

  const setDefault = async (id: string) => {
    if (!profile?.school_id) return;
    await supabase.from("bendahara_bank_accounts" as any).update({ is_default: false }).eq("school_id", profile.school_id);
    await supabase.from("bendahara_bank_accounts" as any).update({ is_default: true }).eq("id", id);
    toast.success("Rekening utama diperbarui");
    loadAccounts();
  };

  const badge = (s: string) => {
    const map: any = { pending: "bg-amber-500", approved: "bg-blue-500", paid: "bg-emerald-500", rejected: "bg-red-500" };
    return <Badge className={map[s] || "bg-slate-500"}>{s.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ArrowDownToLine}
        title="Pencairan Dana"
        subtitle="Ajukan pencairan saldo SPP dan pantau riwayat settlement"
        variant="primary"
        actions={
          <Button size="sm" onClick={() => setBankManageOpen(true)} className="gap-2 bg-white text-[#5B6CF9] hover:bg-white/90 border border-white/40 shadow-sm font-semibold">
            <Landmark className="h-4 w-4" /> Kelola Rekening
          </Button>
        }
      />

      {/* KPI ringkas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Transaksi Siap Cair" value={String(available.count)} icon={Receipt} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Total Bruto" value={fmtIDR(available.gross)} icon={TrendingUp} gradient="from-blue-500 to-indigo-600" />
        <StatCard label="Final Payout" value={fmtIDR(finalPayout)} icon={Banknote} sub="setelah biaya pencairan Rp 3.000" gradient="from-amber-500 to-orange-600" />
      </div>


      <Tabs defaultValue="pencairan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-fit gap-1 bg-indigo-50 dark:bg-indigo-950/40 p-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
          <TabsTrigger
            value="pencairan"
            className="gap-2 rounded-lg font-semibold text-[#3D4FE0] dark:text-indigo-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#5B6CF9] data-[state=active]:to-[#3D4FE0] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#5B6CF9]/30 transition-all duration-300"
          >
            <ArrowDownToLine className="h-4 w-4" /> Ajukan Pencairan
          </TabsTrigger>
          <TabsTrigger
            value="riwayat"
            className="gap-2 rounded-lg font-semibold text-[#3D4FE0] dark:text-indigo-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#5B6CF9] data-[state=active]:to-[#3D4FE0] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#5B6CF9]/30 transition-all duration-300"
          >
            <FileText className="h-4 w-4" /> Riwayat Settlement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pencairan" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Preview Pencairan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Total Transaksi</p><p className="font-bold">{available.count}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Bruto</p><p className="font-bold">{fmtIDR(available.gross)}</p></div>
                <div><p className="text-xs text-muted-foreground">Biaya Pencairan</p><p className="font-bold">- {fmtIDR(3000)}</p></div>
                <div className="col-span-2 md:col-span-3 border-t pt-2">
                  <p className="text-xs text-muted-foreground">Final Payout</p>
                  <p className="text-xl font-extrabold text-emerald-600">{fmtIDR(finalPayout)}</p>
                </div>
              </div>
              {(() => {
                const acc = savedAccounts.find((x: any) => x.is_default) || savedAccounts[0];
                return acc ? (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Landmark className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{acc.account_type === "ewallet" ? "E-Wallet Tujuan" : "Rekening Tujuan"}</p>
                        <p className="text-sm font-bold">{acc.bank_name} <span className="font-mono">· {acc.account_number}</span></p>
                        <p className="text-xs text-muted-foreground">a.n. {acc.account_holder}{acc.responsible_user_id ? ` · PJ: ${staffList.find((s) => s.user_id === acc.responsible_user_id)?.full_name || "—"}` : ""}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setBankManageOpen(true)} className="text-xs">Ubah</Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 p-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Belum ada rekening tersimpan</p>
                        <p className="text-xs text-muted-foreground">Simpan rekening sekolah dulu untuk mencairkan dana.</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setBankManageOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">Tambah</Button>
                  </div>
                );
              })()}
              <Button
                disabled={available.count === 0}
                onClick={requestSubmit}
                className="w-full md:w-auto group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white font-bold shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 px-6 py-5 rounded-xl"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" />
                <ArrowDownToLine className="h-4 w-4 mr-2 group-hover:animate-bounce" /> Ajukan Pencairan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="space-y-4 mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loadingHistory ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="[&_th]:whitespace-nowrap"><TableHead>Code</TableHead><TableHead>Tgl</TableHead><TableHead>Trx</TableHead><TableHead>Bruto</TableHead><TableHead>Biaya Pencairan</TableHead><TableHead>Final</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {history.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada settlement</TableCell></TableRow>}
                    {history.map(s => {
                      const withdrawFee = s.withdraw_fee ?? 3000;
                      const finalPayoutGross = Math.max(0, (s.total_gross || 0) - withdrawFee);
                      return (
                        <TableRow key={s.id} onClick={() => openSettlementDetail(s)} className="[&_td]:whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors">
                          <TableCell className="text-xs font-mono">{s.settlement_code}</TableCell>
                          <TableCell className="text-xs">{new Date(s.requested_at).toLocaleDateString("id-ID")}</TableCell>
                          <TableCell>{s.total_transactions}</TableCell>
                          <TableCell className="text-xs">{fmtIDR(s.total_gross)}</TableCell>
                          <TableCell className="text-xs">{fmtIDR(withdrawFee)}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">{fmtIDR(finalPayoutGross)}</TableCell>
                          <TableCell>{badge(s.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Konfirmasi Pencairan */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) { setOtpStep(false); setOtpCode(""); setOtpPhoneMasked(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{otpStep ? "Verifikasi OTP WhatsApp" : "Konfirmasi Pencairan"}</DialogTitle>
            <DialogDescription>
              {otpStep
                ? "Untuk keamanan, masukkan 6 digit kode OTP yang dikirim ke WhatsApp Bendahara."
                : "Mohon cek kembali — pastikan nomor rekening sudah benar. Pencairan ke rekening salah tidak dapat dibatalkan."}
            </DialogDescription>
          </DialogHeader>

          {!otpStep ? (
            <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto">
              {/* Rekening / E-Wallet Tujuan */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400">{bank.account_type === "ewallet" ? "E-Wallet Tujuan" : "Rekening Tujuan"}</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{bank.account_type === "ewallet" ? "E-Wallet" : "Bank"}</span><span className="font-bold">{bank.bank_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{bank.account_type === "ewallet" ? "Nomor" : "No. Rekening"}</span><span className="font-mono font-bold tracking-wider">{bank.account_number}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Atas Nama</span><span className="font-bold">{bank.account_holder}</span></div>
                <div className="flex justify-between text-sm border-t border-amber-200 dark:border-amber-800 pt-2"><span className="text-muted-foreground">Penanggung Jawab OTP</span><span className="font-semibold">{staffList.find((s) => s.user_id === bank.responsible_user_id)?.full_name || "—"}</span></div>
              </div>

              {/* Rincian Perhitungan */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-2">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">Rincian Perhitungan</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Tagihan Lunas</span><span className="font-semibold">{available.count} transaksi</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Bruto (dari siswa)</span><span className="font-bold">{fmtIDR(available.gross)}</span></div>
                <div className="flex justify-between text-sm text-rose-600 dark:text-rose-400"><span>(−) Biaya Pencairan</span><span className="font-semibold">−{fmtIDR(3000)}</span></div>
                <div className="border-t-2 border-emerald-400 dark:border-emerald-600 pt-2 flex justify-between items-center"><span className="text-sm font-semibold">Diterima di Rekening</span><span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{fmtIDR(finalPayout)}</span></div>
              </div>

              <p className="text-xs text-center text-muted-foreground">Selanjutnya Anda akan diminta memasukkan kode OTP WhatsApp untuk konfirmasi pencairan.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => { setConfirmOpen(false); setBankManageOpen(true); }} disabled={otpSending}>
                  Periksa / Ubah
                </Button>
                <Button onClick={sendOtp} disabled={otpSending} className="bg-emerald-600 hover:bg-emerald-700">
                  {otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ya, Cairkan"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Kode OTP dikirim ke WhatsApp</p>
                <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{otpPhoneMasked || "—"}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Masukkan 6 digit OTP</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-emerald-700 dark:text-emerald-400 font-semibold disabled:opacity-50"
                  disabled={otpResendIn > 0 || otpSending}
                  onClick={sendOtp}
                >
                  {otpResendIn > 0 ? `Kirim ulang dalam ${otpResendIn}s` : "Kirim ulang OTP"}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => { setOtpStep(false); setOtpCode(""); }}
                  disabled={submitting}
                >
                  Kembali
                </button>
              </div>
              <Button onClick={submit} disabled={submitting || otpCode.length !== 6} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Memproses…</> : "Verifikasi & Cairkan"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kelola Rekening */}
      <Dialog open={bankManageOpen} onOpenChange={setBankManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kelola Rekening / E-Wallet Pencairan</DialogTitle>
            <DialogDescription>Simpan rekening bank atau e-wallet sekolah beserta penanggung jawab OTP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tersimpan</Label>
              {savedAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Belum ada rekening / e-wallet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {savedAccounts.map((a: any) => {
                    const pj = staffList.find((s) => s.user_id === a.responsible_user_id);
                    const isEw = a.account_type === "ewallet";
                    return (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{isEw ? "E-Wallet" : "Bank"}</Badge>
                            {a.bank_name}
                            {a.is_default && <Badge className="ml-1 bg-emerald-600 text-[10px]">Utama</Badge>}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground">{a.account_number} · {a.account_holder}</p>
                          <p className="text-[11px] text-muted-foreground">PJ: {pj?.full_name || <span className="text-amber-600">belum diatur</span>}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!a.is_default && <Button size="sm" variant="ghost" onClick={() => setDefault(a.id)} className="h-7 text-xs">Utama</Button>}
                          <Button size="sm" variant="ghost" onClick={() => deleteAccount(a.id)} className="h-7 text-destructive">Hapus</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tambah Baru</Label>
              <div>
                <Label>Jenis Akun</Label>
                <Select value={newAccount.account_type} onValueChange={(v) => setNewAccount({ ...newAccount, account_type: v as "bank" | "ewallet", bank_name: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Rekening Bank</SelectItem>
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newAccount.account_type === "ewallet" ? (
                <>
                  <div>
                    <Label>Jenis E-Wallet</Label>
                    <Select value={newAccount.bank_name} onValueChange={(v) => setNewAccount({ ...newAccount, bank_name: v })}>
                      <SelectTrigger><SelectValue placeholder="Pilih e-wallet" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DANA">DANA</SelectItem>
                        <SelectItem value="OVO">OVO</SelectItem>
                        <SelectItem value="GoPay">GoPay</SelectItem>
                        <SelectItem value="ShopeePay">ShopeePay</SelectItem>
                        <SelectItem value="LinkAja">LinkAja</SelectItem>
                        <SelectItem value="QRIS">QRIS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Nomor E-Wallet</Label><Input inputMode="numeric" value={newAccount.account_number} onChange={e => setNewAccount({ ...newAccount, account_number: e.target.value })} placeholder="Nomor HP terdaftar" /></div>
                  <div><Label>Atas Nama</Label><Input value={newAccount.account_holder} onChange={e => setNewAccount({ ...newAccount, account_holder: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Nama Bank</Label>
                    <Select value={newAccount.bank_name} onValueChange={(v) => setNewAccount({ ...newAccount, bank_name: v })}>
                      <SelectTrigger><SelectValue placeholder="Pilih bank" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {["BCA","BRI","BNI","Mandiri","BSI","CIMB Niaga","Danamon","Permata","BTN","Panin","Mega","OCBC NISP","Maybank","BJB","Bank Jateng","Bank DKI","Bank Sumut","Bank Sulselbar","Bank Nagari","Muamalat","BTPN","Jenius","SeaBank","Bank Neo Commerce","Jago","Allo Bank","Blu by BCA","Line Bank"].map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Nomor Rekening</Label><Input inputMode="numeric" value={newAccount.account_number} onChange={e => setNewAccount({ ...newAccount, account_number: e.target.value })} /></div>
                  <div><Label>Atas Nama (sesuai buku tabungan)</Label><Input value={newAccount.account_holder} onChange={e => setNewAccount({ ...newAccount, account_holder: e.target.value })} /></div>
                </>
              )}
              <div>
                <Label>Penanggung Jawab (OTP dikirim ke WA-nya)</Label>
                <Select value={newAccount.responsible_user_id} onValueChange={(v) => setNewAccount({ ...newAccount, responsible_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Guru / Operator" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {staffList.length === 0 && <div className="p-2 text-xs text-muted-foreground">Belum ada staf terdaftar</div>}
                    {staffList.map((s) => {
                      const roleLabel = (s.roles || []).map((r: string) => ({ teacher: "Guru", staff: "Operator", bendahara: "Bendahara" } as any)[r] || r).join(", ");
                      return (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.full_name || "(tanpa nama)"} — {roleLabel}{s.phone ? "" : " (no WA)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Setiap transaksi pencairan wajib diotorisasi via OTP WhatsApp ke penanggung jawab.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newAccount.is_default} onChange={e => setNewAccount({ ...newAccount, is_default: e.target.checked })} />
                Jadikan utama
              </label>
              <Button onClick={saveAccount} className="w-full bg-emerald-600 hover:bg-emerald-700">Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Settlement */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detail Pencairan {detailSettlement?.settlement_code}</DialogTitle>
            {detailSettlement && (
              <p className="text-xs text-muted-foreground">
                {new Date(detailSettlement.requested_at).toLocaleString("id-ID")} • {detailSettlement.total_transactions} transaksi • Final {fmtIDR(Math.max(0, (detailSettlement.total_gross || 0) - (detailSettlement.withdraw_fee ?? 3000)))}
              </p>
            )}
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {detailLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : detailItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada data invoice terkait settlement ini.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="[&_th]:whitespace-nowrap">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Dibayar</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailItems.map((it, idx) => (
                    <TableRow key={it.id} className="[&_td]:whitespace-nowrap">
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{it.student_name}</TableCell>
                      <TableCell className="text-xs">{it.class_name}</TableCell>
                      <TableCell className="text-xs">{it.period_label}</TableCell>
                      <TableCell className="text-xs">{formatPaymentMethodLabel(it.payment_method)}</TableCell>
                      <TableCell className="text-xs">{it.paid_at ? new Date(it.paid_at).toLocaleDateString("id-ID") : "-"}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">{fmtIDR(it.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}

// ============ Preset Laporan Cepat (PDF & Excel) ============
function PresetLaporan({ items, students, school, year }: { items: any[]; students: any[]; school: any; year: number }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentMonth = today.getMonth() + 1;

  const paid = items.filter((i: any) => i.status === "paid" && i.paid_at);

  const buildRows = (list: any[]) => list.map((i: any, idx: number) => ({
    "No": idx + 1,
    "Invoice": i.invoice_number,
    "NIS": students.find((s: any) => s.id === i.student_id)?.student_id || "",
    "Nama Siswa": i.student_name,
    "Kelas": i.class_name,
    "Periode": i.period_label,
    "Nominal": i.total_amount,
    "Tgl Bayar": i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "",
    "Metode": formatPaymentMethodLabel(i.payment_method),
    "Status": i.status === "paid" ? "Lunas" : "Belum",
  }));

  const buildAggRows = (agg: { key: string; label: string; total: number; count: number }[]) =>
    agg.map((a, idx) => ({
      "No": idx + 1,
      [a.label]: a.key,
      "Jumlah Transaksi": a.count,
      "Total": a.total,
    }));

  const exportXlsx = (fname: string, rows: any[], title?: string, subtitle?: string) => {
    if (rows.length === 0) { toast.error("Tidak ada data untuk periode ini"); return; }
    const wb = XLSXStyle.utils.book_new();
    const ws = buildStyledSheet(rows, {
      title: title || fname,
      subtitle: `${school?.name || "-"}${subtitle ? " • " + subtitle : ""}`,
    });
    XLSXStyle.utils.book_append_sheet(wb, ws, "Laporan");
    XLSXStyle.writeFile(wb, `${fname}.xlsx`);
    toast.success("Excel diunduh");
  };

  const exportPdf = (title: string, subtitle: string, rows: any[]) => {
    if (rows.length === 0) { toast.error("Tidak ada data untuk periode ini"); return; }
    const keys = Object.keys(rows[0]);
    const columns = keys.map((k) => ({
      header: k,
      dataKey: k,
      isCurrency: CURRENCY_KEYS.has(k),
      align: (CURRENCY_KEYS.has(k) ? "right" : (k === "No" ? "center" : "left")) as any,
    }));
    buildStyledPdf({
      title,
      subtitle,
      schoolName: school?.name || "-",
      schoolNpsn: school?.npsn || undefined,
      meta: [`Jumlah baris: ${rows.length}`],
      orientation: "l",
      columns,
      rows,
      fileName: title.replace(/\s+/g, "_"),
    });
    toast.success("PDF diunduh");
  };



  // Presets
  const dailyRows = () => buildRows(paid.filter((i: any) => (i.paid_at || "").slice(0, 10) === todayStr));
  const monthlyRows = () => buildRows(paid.filter((i: any) => {
    const d = new Date(i.paid_at); return d.getFullYear() === year && d.getMonth() + 1 === currentMonth;
  }));
  const yearlyRows = () => buildRows(paid.filter((i: any) => new Date(i.paid_at).getFullYear() === year));

  const perClassRows = () => {
    const map = new Map<string, { total: number; count: number }>();
    paid.filter((i: any) => new Date(i.paid_at).getFullYear() === year).forEach((i: any) => {
      const e = map.get(i.class_name) || { total: 0, count: 0 };
      e.total += i.total_amount || 0; e.count += 1;
      map.set(i.class_name, e);
    });
    return buildAggRows(Array.from(map.entries()).map(([k, v]) => ({ key: k, label: "Kelas", ...v })).sort((a, b) => b.total - a.total));
  };
  const perTypeRows = () => {
    const map = new Map<string, { total: number; count: number }>();
    paid.filter((i: any) => new Date(i.paid_at).getFullYear() === year).forEach((i: any) => {
      const k = i.period_label || "Tanpa Kategori";
      const e = map.get(k) || { total: 0, count: 0 };
      e.total += i.total_amount || 0; e.count += 1;
      map.set(k, e);
    });
    return buildAggRows(Array.from(map.entries()).map(([k, v]) => ({ key: k, label: "Jenis/Periode", ...v })).sort((a, b) => b.total - a.total));
  };
  const perStudentRows = () => {
    const map = new Map<string, { name: string; class: string; total: number; count: number }>();
    paid.filter((i: any) => new Date(i.paid_at).getFullYear() === year).forEach((i: any) => {
      const e = map.get(i.student_id) || { name: i.student_name, class: i.class_name, total: 0, count: 0 };
      e.total += i.total_amount || 0; e.count += 1;
      map.set(i.student_id, e);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((v, idx) => ({
        "No": idx + 1,
        "Nama Siswa": v.name,
        "Kelas": v.class,
        "Jumlah Transaksi": v.count,
        "Total": v.total,
      }));
  };

  const presets = [
    { key: "harian", title: "Pembayaran Harian", subtitle: `Tanggal ${today.toLocaleDateString("id-ID")}`, rows: dailyRows },
    { key: "bulanan", title: "Pembayaran Bulanan", subtitle: `${MONTHS[currentMonth - 1]} ${year}`, rows: monthlyRows },
    { key: "tahunan", title: "Pembayaran Tahunan", subtitle: `Tahun ${year}`, rows: yearlyRows },
    { key: "kelas", title: "Rekap per Kelas", subtitle: `Tahun ${year}`, rows: perClassRows },
    { key: "jenis", title: "Rekap per Jenis Pembayaran", subtitle: `Tahun ${year}`, rows: perTypeRows },
    { key: "siswa", title: "Rekap per Siswa", subtitle: `Tahun ${year}`, rows: perStudentRows },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-[#5B6CF9]" /> Laporan Cepat (PDF & Excel)</CardTitle>
        <p className="text-[11px] text-muted-foreground">Unduh laporan langsung dari data pembayaran online.</p>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="rounded-lg border border-border/60 divide-y divide-border/50 overflow-hidden">
          {presets.map((p) => (
            <div key={p.key} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{p.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.subtitle}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => exportPdf(p.title, p.subtitle, p.rows())}>
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => exportXlsx(`${p.title.replace(/\s+/g, "_")}_${todayStr}`, p.rows(), p.title, p.subtitle)}>
                  <Download className="h-3 w-3 mr-1" /> Excel
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}



// Backward-compat alias: route /bendahara/settlement now redirects to gabungan
export function BendaharaSettlement() {
  return <BendaharaPencairan />;
}
export function BendaharaLaporan() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  // Export filters
  const currentAY = academicYearOf(new Date().getMonth() + 1, new Date().getFullYear());
  const [expClass, setExpClass] = useState<string>("all");
  const [expAY, setExpAY] = useState<string>(currentAY);
  const [expStatus, setExpStatus] = useState<string>("all");

  // Export preview
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Detail kelas (dialog)
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [detailMonth, setDetailMonth] = useState<number>(0); // 0 = semua bulan
  const [detailStatus, setDetailStatus] = useState<string>("all");

  // Auto-open dialog from URL ?cls=X (mendukung "buka di halaman baru")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cls = params.get("cls");
    if (cls) {
      setOpenClass(cls);
      const m = parseInt(params.get("m") || "0");
      const st = params.get("st") || "all";
      setDetailMonth(isNaN(m) ? 0 : m);
      setDetailStatus(st);
    }
  }, []);

  useEffect(() => {
    if (!profile?.school_id) return;
    Promise.all([
      supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id).eq("period_year", year),
      supabase.from("students").select("id, name, student_id, class").eq("school_id", profile.school_id),
      supabase.from("classes").select("name").eq("school_id", profile.school_id).order("name"),
      supabase.from("schools").select("name, npsn, address").eq("id", profile.school_id).maybeSingle(),
    ]).then(([inv, st, cl, sc]) => {
      setItems(inv.data || []);
      setStudents(st.data || []);
      setClasses((cl.data || []).map((x: any) => x.name));
      setSchool(sc.data);
    });
  }, [profile?.school_id, year]);

  // ===== Ringkasan bulanan =====
  const monthly = MONTHS.map((m, i) => {
    const filtered = items.filter(x => x.period_month === i + 1);
    const tagihan = filtered.reduce((s, x) => s + (x.total_amount || 0), 0);
    const bayar = filtered.filter(x => x.status === "paid").reduce((s, x) => s + (x.total_amount || 0), 0);
    return { name: m.slice(0, 3), tagihan, bayar, sisa: Math.max(0, tagihan - bayar) };
  });
  const yearTotals = monthly.reduce((a, x) => ({
    tagihan: a.tagihan + x.tagihan,
    bayar: a.bayar + x.bayar,
  }), { tagihan: 0, bayar: 0 });
  const collectionRate = yearTotals.tagihan > 0 ? Math.round((yearTotals.bayar / yearTotals.tagihan) * 100) : 0;

  // ===== Statistik per kelas (matrix bulan) =====
  const perClassRows = classes.map(cls => {
    const ci = items.filter(x => x.class_name === cls);
    const months = MONTHS.map((_, i) => {
      const f = ci.filter(x => x.period_month === i + 1);
      const total = f.reduce((s, x) => s + (x.total_amount || 0), 0);
      const paid = f.filter(x => x.status === "paid").reduce((s, x) => s + (x.total_amount || 0), 0);
      return { total, paid, count: f.length, paidCount: f.filter(x => x.status === "paid").length };
    });
    const totalTagihan = months.reduce((s, m) => s + m.total, 0);
    const totalBayar = months.reduce((s, m) => s + m.paid, 0);
    const totalCount = months.reduce((s, m) => s + m.count, 0);
    const paidCount = months.reduce((s, m) => s + m.paidCount, 0);
    return { cls, months, totalTagihan, totalBayar, totalCount, paidCount };
  }).filter(r => r.totalCount > 0);

  // ===== Preview data untuk export =====
  const loadPreview = useCallback(async () => {
    if (!profile?.school_id) return;
    setPreviewLoading(true);
    let q = supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id);
    if (expClass !== "all") q = q.eq("class_name", expClass);
    if (expStatus !== "all") q = q.eq("status", expStatus);
    const { data: invs } = await q.order("class_name").order("student_name").order("period_year").order("period_month");
    const filtered = (invs || []).filter((i: any) => expAY === "all" || academicYearOf(i.period_month, i.period_year) === expAY);
    setPreviewRows(filtered);
    setPreviewLoading(false);
  }, [profile?.school_id, expClass, expStatus, expAY]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  // ===== Export =====
  const exportData = async (format: "xlsx" | "csv" | "pdf") => {
    if (!profile?.school_id) return;
    const tid = toast.loading("Menyiapkan export...");
    let q = supabase.from("spp_invoices").select("*").eq("school_id", profile.school_id);
    if (expClass !== "all") q = q.eq("class_name", expClass);
    if (expStatus !== "all") q = q.eq("status", expStatus);
    const { data: invs } = await q.order("class_name").order("student_name").order("period_year").order("period_month");
    toast.dismiss(tid);
    const filtered = (invs || []).filter(i => expAY === "all" || academicYearOf(i.period_month, i.period_year) === expAY);
    if (filtered.length === 0) { toast.error("Tidak ada data untuk filter ini"); return; }

    const rows = filtered.map((i, idx) => ({
      "No": idx + 1,
      "No. Invoice": i.invoice_number,
      "NIS": students.find(s => s.id === i.student_id)?.student_id || "",
      "Nama Siswa": i.student_name,
      "Kelas": i.class_name,
      "Tahun Ajaran": academicYearOf(i.period_month, i.period_year),
      "Periode": i.period_label,
      "Nama Wali": i.parent_name || "",
      "No. WA Wali": i.parent_phone || "",
      "Nominal": i.amount,
      "Denda": i.denda,
      "Total": i.total_amount,
      "Jatuh Tempo": i.due_date ? new Date(i.due_date).toLocaleDateString("id-ID") : "",
      "Status": i.status === "paid" ? "Lunas" : i.status === "pending" ? "Pending" : i.status === "expired" ? "Kadaluarsa" : "Belum Bayar",
      "Tgl Bayar": i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "",
      "Metode": formatPaymentMethodLabel(i.payment_method),
    }));

    const filterTag = `${expAY === "all" ? "ALL" : expAY.replace("/", "-")}_${expClass === "all" ? "SEMUA-KELAS" : expClass.replace(/\s/g, "-")}_${expStatus.toUpperCase()}`;
    const fname = `SPP_${filterTag}_${new Date().toISOString().slice(0, 10)}`;

    const metaSubtitle = `TA: ${expAY === "all" ? "Semua" : expAY} • Kelas: ${expClass === "all" ? "Semua" : expClass} • Status: ${expStatus === "all" ? "Semua" : expStatus}`;

    if (format === "xlsx") {
      const wb = XLSXStyle.utils.book_new();

      // Ringkasan Per Tahun Ajaran (selalu ada — memudahkan pembacaan lintas TA)
      const perTA = new Map<string, any[]>();
      rows.forEach(r => {
        const ta = String(r["Tahun Ajaran"] || "-");
        if (!perTA.has(ta)) perTA.set(ta, []);
        perTA.get(ta)!.push(r);
      });
      const summaryTA = Array.from(perTA.entries())
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([ta, list]) => ({
          "Tahun Ajaran": ta,
          "Jumlah Tagihan": list.length,
          "Lunas": list.filter(x => x.Status === "Lunas").length,
          "Belum Bayar": list.filter(x => x.Status !== "Lunas").length,
          "Total Tagihan": list.reduce((a, x) => a + (x.Total || 0), 0),
          "Total Diterima": list.filter(x => x.Status === "Lunas").reduce((a, x) => a + (x.Total || 0), 0),
        }));
      XLSXStyle.utils.book_append_sheet(
        wb,
        buildStyledSheet(summaryTA, { title: "Ringkasan per Tahun Ajaran", subtitle: `${school?.name || "-"} • ${metaSubtitle}` }),
        "Ringkasan per TA",
      );

      if (expClass === "all") {
        // Ringkasan per Kelas
        const grouped = new Map<string, any[]>();
        rows.forEach(r => {
          const cls = String(r["Kelas"]);
          if (!grouped.has(cls)) grouped.set(cls, []);
          grouped.get(cls)!.push(r);
        });
        const summary = Array.from(grouped.entries()).map(([cls, list]) => ({
          "Kelas": cls,
          "Jumlah Tagihan": list.length,
          "Lunas": list.filter(x => x.Status === "Lunas").length,
          "Belum Bayar": list.filter(x => x.Status !== "Lunas").length,
          "Total Tagihan": list.reduce((a, x) => a + (x.Total || 0), 0),
          "Total Diterima": list.filter(x => x.Status === "Lunas").reduce((a, x) => a + (x.Total || 0), 0),
        }));
        XLSXStyle.utils.book_append_sheet(
          wb,
          buildStyledSheet(summary, { title: "Ringkasan per Kelas", subtitle: `${school?.name || "-"} • ${metaSubtitle}` }),
          "Ringkasan per Kelas",
        );

        // Rincian per Kelas × TA supaya ekspor lebih rapih (satu sheet per Kelas-TA jika multi-TA)
        Array.from(grouped.entries()).forEach(([cls, list]) => {
          const tas = new Set(list.map(x => String(x["Tahun Ajaran"] || "-")));
          if (tas.size > 1) {
            Array.from(tas).sort().forEach((ta) => {
              const subset = list.filter(x => String(x["Tahun Ajaran"]) === ta);
              const sheetName = `${cls} ${ta}`.slice(0, 31);
              XLSXStyle.utils.book_append_sheet(
                wb,
                buildStyledSheet(subset, { title: `Rincian SPP — Kelas ${cls}`, subtitle: `TA ${ta} • ${school?.name || "-"}` }),
                sheetName,
              );
            });
          } else {
            XLSXStyle.utils.book_append_sheet(
              wb,
              buildStyledSheet(list, { title: `Rincian SPP — Kelas ${cls}`, subtitle: `${school?.name || "-"}` }),
              cls.slice(0, 31),
            );
          }
        });
      } else {
        XLSXStyle.utils.book_append_sheet(
          wb,
          buildStyledSheet(rows, { title: `Rincian SPP — Kelas ${expClass}`, subtitle: `${school?.name || "-"} • ${metaSubtitle}` }),
          expClass.slice(0, 31),
        );
      }
      XLSXStyle.writeFile(wb, `${fname}.xlsx`);
    } else if (format === "csv") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${fname}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      buildStyledPdf({
        title: "Laporan Tagihan SPP",
        subtitle: metaSubtitle,
        schoolName: school?.name || "",
        schoolNpsn: school?.npsn || undefined,
        meta: [
          `Total: ${rows.length} tagihan • ${fmtIDR(rows.reduce((a, r) => a + (r.Total || 0), 0))}`,
          `Sudah Lunas: ${rows.filter(r => r.Status === "Lunas").length} • Belum Lunas: ${rows.filter(r => r.Status !== "Lunas").length}`,
        ],
        orientation: "l",
        columns: [
          { header: "No", dataKey: "No", align: "center", width: 10 },
          { header: "No. Invoice", dataKey: "No. Invoice", align: "left", width: 34 },
          { header: "NIS", dataKey: "NIS", align: "left", width: 22 },
          { header: "Nama Siswa", dataKey: "Nama Siswa", align: "left" },
          { header: "Kelas", dataKey: "Kelas", align: "center", width: 16 },
          { header: "Periode", dataKey: "Periode", align: "left", width: 26 },
          { header: "Total", dataKey: "Total", isCurrency: true, width: 28 },
          { header: "Jatuh Tempo", dataKey: "Jatuh Tempo", align: "center", width: 22 },
          { header: "Status", dataKey: "Status", align: "center", width: 22 },
        ],
        rows,
        fileName: fname,
      });
    }
    toast.success("Export selesai");
  };


  return (
    <div className="space-y-4">
      <PageHeader
        icon={BarChart3}
        title="Laporan & Export Keuangan"
        subtitle="Ringkasan tahunan, statistik per kelas, dan export data SPP — semua dalam satu tempat."
        variant="primary"
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs text-white/90 whitespace-nowrap">Tahun:</Label>
            <Input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-24 h-9 bg-white/15 border-white/20 text-white"
            />
          </div>
        }
      />

      {/* KPI Ringkasan tahun — prioritas utama di atas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={`Total Tagihan ${year}`} value={fmtIDR(yearTotals.tagihan)} icon={FileText} gradient="from-indigo-500 to-indigo-600" />
        <StatCard label="Sudah Lunas" value={fmtIDR(yearTotals.bayar)} icon={CheckCircle2} gradient="from-sky-500 to-sky-600" />
        <StatCard label="Belum Lunas" value={fmtIDR(yearTotals.tagihan - yearTotals.bayar)} icon={AlertCircle} gradient="from-amber-500 to-amber-600" />
        <StatCard label="Tingkat Pelunasan" value={`${collectionRate}%`} icon={Percent} gradient="from-violet-500 to-violet-600" />
      </div>

      <Tabs defaultValue="ringkasan" className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-auto rounded-xl h-auto md:h-10">
          <TabsTrigger value="ringkasan" className="gap-2 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Ringkasan</TabsTrigger>
          <TabsTrigger value="kelas" className="gap-2 text-xs"><Users className="h-3.5 w-3.5" /> Per Kelas</TabsTrigger>
          <TabsTrigger value="export" className="gap-2 text-xs"><Download className="h-3.5 w-3.5" /> Export</TabsTrigger>
        </TabsList>


        {/* TAB 1 — RINGKASAN */}
        <TabsContent value="ringkasan" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Tagihan vs Pembayaran ({year})</CardTitle>
              <p className="text-xs text-muted-foreground">Bandingkan total tagihan dan pembayaran tiap bulan untuk tahun {year}.</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}jt`} />
                  <Tooltip formatter={(v: any) => fmtIDR(v)} />
                  <Legend />
                  <Bar dataKey="tagihan" fill="hsl(220 80% 60%)" name="Tagihan" radius={[4,4,0,0]} />
                  <Bar dataKey="bayar" fill="hsl(200 85% 55%)" name="Pembayaran" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 — STATISTIK PER KELAS (CARD) */}
        <TabsContent value="kelas" className="mt-4">
          {perClassRows.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Belum ada data tagihan untuk {year}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {perClassRows.map(r => {
                const pct = r.totalTagihan > 0 ? Math.round((r.totalBayar / r.totalTagihan) * 100) : 0;
                const sisaTotal = Math.max(0, r.totalTagihan - r.totalBayar);
                const belum = r.totalCount - r.paidCount;
                return (
                  <button
                    key={r.cls}
                    onClick={() => { setOpenClass(r.cls); setDetailMonth(0); setDetailStatus("all"); }}
                    className="text-left rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    {/* Header gradient seperti card SPP */}
                    <div className="relative overflow-hidden bg-indigo-100 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100 border-b border-indigo-200 dark:border-indigo-900">
                      <div className="relative z-10 flex items-center gap-3 px-4 py-3">
                        <div className="h-10 w-10 rounded-xl bg-[#5B6CF9] flex items-center justify-center shrink-0 shadow-sm">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[15px] text-indigo-950 dark:text-indigo-100 truncate">Kelas {r.cls}</span>
                            <span className="text-[10px] font-semibold bg-white/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">{r.totalCount} tagihan</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] font-semibold bg-[#5B6CF9] text-white px-2 py-0.5 rounded-full">{r.paidCount} Lunas</span>
                            <span className="text-[10px] font-semibold bg-white/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">{belum} Belum</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] uppercase tracking-wide text-indigo-700/80 dark:text-indigo-300">Pelunasan</div>
                          <div className="text-xl font-extrabold leading-none text-indigo-950 dark:text-indigo-100">{pct}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Body — netral, profesional */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Total Tagihan</p>
                          <p className="text-sm font-bold text-foreground">{fmtIDR(r.totalTagihan)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Sudah Lunas</p>
                          <p className="text-sm font-bold text-foreground">{fmtIDR(r.totalBayar)}</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#5B6CF9] transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Sisa: <span className="font-semibold text-foreground">{fmtIDR(sisaTotal)}</span></span>
                          <span className="inline-flex items-center gap-1 text-[#5B6CF9] font-medium">Lihat detail <ChevronRight className="h-3 w-3" /></span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
        {/* TAB 5 — EXPORT DATA */}
        <TabsContent value="export" className="mt-4 space-y-3">
          <Card className="border-0 shadow-sm">


            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4 text-[#5B6CF9]" /> Export Data SPP
              </CardTitle>
              <p className="text-xs text-muted-foreground">Pilih filter, lalu unduh ke Excel (per kelas), CSV, atau PDF resmi.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Tahun Ajaran</Label>
                  <Select value={expAY} onValueChange={setExpAY}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                      <SelectItem value="all">Semua TA</SelectItem>
                      {academicYearList(new Date().getFullYear()).map(ay => <SelectItem key={ay} value={ay}>{ay}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Kelas</Label>
                  <Select value={expClass} onValueChange={setExpClass}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                      <SelectItem value="all">Semua Kelas (per-sheet)</SelectItem>
                      {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={expStatus} onValueChange={setExpStatus}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="paid">Lunas</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="unpaid">Belum Bayar</SelectItem>
                      <SelectItem value="expired">Kadaluarsa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Format Nasional:</strong> kolom No, No. Invoice, NIS, Nama, Kelas, TA, Periode, Wali, Nominal, Denda, Total, Jatuh Tempo, Status, Tgl Bayar.
                Saat memilih "Semua Kelas", Excel dipisah <strong>per-sheet kelas</strong> + sheet Ringkasan.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => exportData("xlsx")} disabled={previewRows.length === 0} className="bg-[#5B6CF9] hover:bg-[#4c5ded]"><Download className="h-4 w-4 mr-2" /> Excel (per kelas)</Button>
                <Button onClick={() => exportData("csv")} disabled={previewRows.length === 0} variant="outline"><Download className="h-4 w-4 mr-2" /> CSV</Button>
                <Button onClick={() => exportData("pdf")} disabled={previewRows.length === 0} variant="outline"><Download className="h-4 w-4 mr-2" /> PDF Laporan</Button>
                <Button onClick={loadPreview} variant="ghost" size="sm" className="ml-auto"><RefreshCw className={`h-4 w-4 mr-1.5 ${previewLoading ? "animate-spin" : ""}`} /> Muat ulang</Button>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/60">
                  <div className="text-xs font-semibold text-foreground">
                    Preview Data <span className="text-muted-foreground font-normal">— {previewLoading ? "memuat..." : `${previewRows.length} baris`}</span>
                  </div>
                  {previewRows.length > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{fmtIDR(previewRows.reduce((s, r) => s + (r.total_amount || 0), 0))}</span>
                    </div>
                  )}
                </div>
                <div className="max-h-[420px] overflow-auto">
                  {previewLoading ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Memuat data...</div>
                  ) : previewRows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Tidak ada data untuk filter ini.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 sticky top-0">
                        <tr className="text-left text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-2 w-10">No</th>
                          <th className="px-2 py-2">Invoice</th>
                          <th className="px-2 py-2">NIS</th>
                          <th className="px-2 py-2">Nama Siswa</th>
                          <th className="px-2 py-2">Kelas</th>
                          <th className="px-2 py-2">TA</th>
                          <th className="px-2 py-2">Periode</th>
                          <th className="px-2 py-2 text-right">Total</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Tgl Bayar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 200).map((i: any, idx: number) => {
                          const statusMeta =
                            i.status === "paid" ? { label: "Lunas", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40" } :
                            i.status === "pending" ? { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40" } :
                            i.status === "expired" ? { label: "Kadaluarsa", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40" } :
                            { label: "Belum Bayar", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800" };
                          return (
                            <tr key={i.id} className="border-t border-border/40 hover:bg-muted/30">
                              <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                              <td className="px-2 py-1.5 font-mono text-[10px]">{i.invoice_number}</td>
                              <td className="px-2 py-1.5 font-mono text-[10px]">{students.find(s => s.id === i.student_id)?.student_id || "-"}</td>
                              <td className="px-2 py-1.5 font-medium">{i.student_name}</td>
                              <td className="px-2 py-1.5">{i.class_name}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{academicYearOf(i.period_month, i.period_year)}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap">{i.period_label}</td>
                              <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">{fmtIDR(i.total_amount || 0)}</td>
                              <td className="px-2 py-1.5">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusMeta.cls}`}>{statusMeta.label}</span>
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {previewRows.length > 200 && (
                  <div className="px-3 py-2 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground text-center">
                    Menampilkan 200 dari {previewRows.length} baris. Semua baris akan ikut ter-export.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Laporan Cepat (PDF & Excel) — pintasan cepat di bawah export utama */}
          <PresetLaporan items={items} students={students} school={school} year={year} />

        </TabsContent>
      </Tabs>

      {/* DIALOG — Detail Siswa per Kelas */}
      <Dialog open={!!openClass} onOpenChange={(o) => !o && setOpenClass(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-4xl max-h-[92vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader className="pr-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <DialogTitle className="text-sm sm:text-base leading-snug">
                Detail Pembayaran — Kelas {openClass} <span className="text-muted-foreground font-normal">({year})</span>
              </DialogTitle>
              {openClass && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 self-start sm:self-auto"
                  onClick={() => {
                    const url = `${window.location.pathname}?cls=${encodeURIComponent(openClass)}&m=${detailMonth}&st=${detailStatus}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Buka di tab baru
                </Button>
              )}
            </div>
          </DialogHeader>
          {openClass && (() => {
            const classInvs = items.filter(i => i.class_name === openClass);
            const filtered = classInvs.filter(i =>
              (detailMonth === 0 || i.period_month === detailMonth) &&
              (detailStatus === "all" || (detailStatus === "paid" ? i.status === "paid" : i.status !== "paid"))
            ).sort((a, b) =>
              (a.period_month - b.period_month) ||
              (a.student_name || "").localeCompare(b.student_name || "")
            );
            const totTagihan = filtered.reduce((s, i) => s + (i.total_amount || 0), 0);
            const totPaid = filtered.filter(i => i.status === "paid").reduce((s, i) => s + (i.total_amount || 0), 0);
            const lunasCount = filtered.filter(i => i.status === "paid").length;
            return (
              <div className="space-y-3">
                {/* Filter */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Bulan</Label>
                    <Select value={String(detailMonth)} onValueChange={v => setDetailMonth(parseInt(v))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Semua Bulan</SelectItem>
                        {MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m} {year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={detailStatus} onValueChange={setDetailStatus}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        <SelectItem value="paid">Hanya Lunas</SelectItem>
                        <SelectItem value="unpaid">Hanya Belum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* KPI Total */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border bg-card p-3"><p className="text-[10px] text-muted-foreground uppercase">Tagihan</p><p className="text-sm font-bold mt-0.5">{filtered.length}</p></div>
                  <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-3"><p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase">Lunas</p><p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{lunasCount}</p></div>
                  <div className="rounded-lg border bg-rose-50 dark:bg-rose-950/20 p-3"><p className="text-[10px] text-rose-700 dark:text-rose-400 uppercase">Belum</p><p className="text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">{filtered.length - lunasCount}</p></div>
                  <div className="rounded-lg border bg-[#5B6CF9]/10 p-3"><p className="text-[10px] text-[#5B6CF9] uppercase">Pendapatan</p><p className="text-sm font-bold text-[#5B6CF9] mt-0.5">{fmtIDR(totPaid)}</p><p className="text-[9px] text-muted-foreground">dari {fmtIDR(totTagihan)}</p></div>
                </div>

                {/* Tabel Siswa */}
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold w-10 text-center whitespace-nowrap">No</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">NIS</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Nama Siswa</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Periode</TableHead>
                        <TableHead className="font-bold text-right whitespace-nowrap">Nominal</TableHead>
                        <TableHead className="font-bold text-center whitespace-nowrap">Status</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Tgl Bayar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada tagihan untuk filter ini</TableCell></TableRow>
                      ) : filtered.map((i, idx) => {
                        const stu = students.find(s => s.id === i.student_id);
                        return (
                          <TableRow key={i.id} className="hover:bg-muted/20">
                            <TableCell className="text-center text-muted-foreground whitespace-nowrap">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-[11px] whitespace-nowrap">{stu?.student_id || "-"}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{i.student_name}</TableCell>
                            <TableCell className="text-[11px] whitespace-nowrap">{i.period_label || `${MONTHS[i.period_month-1]} ${i.period_year}`}</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">{fmtIDR(i.total_amount || 0)}</TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              {i.status === "paid"
                                ? <span className="status-pill status-pill-paid"><span className="dot" />Lunas</span>
                                : i.status === "pending"
                                  ? <span className="status-pill status-pill-pending"><span className="dot" />Pending</span>
                                  : <span className="status-pill status-pill-unpaid"><span className="dot" />Belum</span>}
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    {filtered.length > 0 && (
                      <TableFooter>
                        <TableRow className="bg-muted/40 font-bold">
                          <TableCell colSpan={4} className="text-right">TOTAL DITERIMA</TableCell>
                          <TableCell className="text-right text-emerald-600">{fmtIDR(totPaid)}</TableCell>
                          <TableCell colSpan={2} className="text-[10px] text-muted-foreground">dari total tagihan {fmtIDR(totTagihan)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Payment gateway settings dipindah ke Super Admin (mayar webhook).

