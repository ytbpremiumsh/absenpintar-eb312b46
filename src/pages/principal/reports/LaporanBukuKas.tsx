import { useEffect, useMemo, useState } from "react";
import { BookOpen, TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { fmtIDR } from "../_shared";
import { formatPaymentMethodLabel } from "@/lib/paymentMethod";

/**
 * Sinkron 1:1 dengan Buku Kas Bendahara:
 *  - Manual: cash_book_entries
 *  - Otomatis (in): spp_invoices (paid) → kategori "SPP Online", amount = total_amount (gross)
 *  - Otomatis (out): spp_settlements (paid, withdraw_fee > 0) → kategori "Biaya Pencairan ATSkolla"
 */
type Entry = {
  entry_date: string;
  direction: "in" | "out";
  category: string;
  amount: number;
  description: string;
  reference: string;
  method: string;
  status: string;
  source: "manual" | "auto";
};

export default function LaporanBukuKas() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [dir, setDir] = useState("all");
  const [cat, setCat] = useState("all");
  const [all, setAll] = useState<Entry[]>([]);
  const [priorSum, setPriorSum] = useState({ in: 0, out: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [m, inv, stl, mPrior, invPrior, stlPrior] = await Promise.all([
        supabase.from("cash_book_entries")
          .select("entry_date, direction, category, description, reference, amount, created_at")
          .eq("school_id", schoolId).gte("entry_date", from).lte("entry_date", to)
          .order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("spp_invoices")
          .select("invoice_number, student_name, class_name, period_label, total_amount, net_amount, paid_at, payment_method, status")
          .eq("school_id", schoolId).eq("status", "paid").not("paid_at", "is", null)
          .gte("paid_at", from).lte("paid_at", to + "T23:59:59"),
        supabase.from("spp_settlements")
          .select("settlement_code, withdraw_fee, status, paid_at, approved_at, requested_at, bank_name, account_number")
          .eq("school_id", schoolId).eq("status", "paid").gt("withdraw_fee", 0)
          .gte("paid_at", from).lte("paid_at", to + "T23:59:59"),
        supabase.from("cash_book_entries")
          .select("direction, amount").eq("school_id", schoolId).lt("entry_date", from),
        supabase.from("spp_invoices")
          .select("total_amount, paid_at").eq("school_id", schoolId).eq("status", "paid").not("paid_at", "is", null).lt("paid_at", from),
        supabase.from("spp_settlements")
          .select("withdraw_fee, paid_at").eq("school_id", schoolId).eq("status", "paid").gt("withdraw_fee", 0).lt("paid_at", from),
      ]);

      const manual: Entry[] = ((m.data as any[]) || []).map((r) => ({
        entry_date: r.entry_date,
        direction: r.direction,
        category: r.category || "-",
        amount: r.amount || 0,
        description: r.description || "-",
        reference: r.reference || "-",
        method: "Tunai/Manual",
        status: "Tercatat",
        source: "manual",
      }));
      const autoIn: Entry[] = ((inv.data as any[]) || []).map((i) => ({
        entry_date: (i.paid_at || "").slice(0, 10),
        direction: "in",
        category: "SPP Online",
        amount: i.total_amount ?? i.net_amount ?? 0,
        description: `Pembayaran SPP - ${i.student_name} (Kelas ${i.class_name}) Periode ${i.period_label}`,
        reference: i.invoice_number || "-",
        method: formatPaymentMethodLabel(i.payment_method) || "-",
        status: "Lunas",
        source: "auto",
      }));
      const autoFee: Entry[] = ((stl.data as any[]) || []).map((s) => ({
        entry_date: (s.paid_at || s.approved_at || s.requested_at || "").slice(0, 10),
        direction: "out",
        category: "Biaya Pencairan ATSkolla",
        amount: s.withdraw_fee || 0,
        description: `Biaya pencairan ${s.settlement_code} → ${s.bank_name || "-"} ${s.account_number || ""}`.trim(),
        reference: s.settlement_code || "-",
        method: "Auto",
        status: "Tercatat",
        source: "auto",
      }));

      const combined = [...manual, ...autoIn, ...autoFee].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      setAll(combined);

      // Saldo Awal — jumlah semua transaksi sebelum tanggal `from` (server-side filter)
      const priorManualIn = ((mPrior.data as any[]) || []).filter((e) => e.direction === "in").reduce((s, e) => s + (e.amount || 0), 0);
      const priorManualOut = ((mPrior.data as any[]) || []).filter((e) => e.direction === "out").reduce((s, e) => s + (e.amount || 0), 0);
      const priorInvIn = ((invPrior.data as any[]) || []).reduce((s, e) => s + (e.total_amount || 0), 0);
      const priorFeeOut = ((stlPrior.data as any[]) || []).reduce((s: number, e: any) => s + (e.withdraw_fee || 0), 0);
      setPriorSum({ in: priorManualIn + priorInvIn, out: priorManualOut + priorFeeOut });

      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const opening = priorSum.in - priorSum.out;

  const categories = useMemo(() => Array.from(new Set(all.map((r) => r.category))).sort(), [all]);

  // Running balance dihitung dari SELURUH entri kronologis (bukan yang difilter),
  // supaya kolom Saldo Berjalan tetap benar meskipun user memfilter arah/kategori/sumber.
  const allWithBalance = useMemo(() => {
    let running = opening;
    return all.map((e) => {
      running += e.direction === "in" ? e.amount : -e.amount;
      return { entry: e, running };
    });
  }, [all, opening]);

  const filteredRows = useMemo(
    () => allWithBalance.filter(({ entry: r }) =>
      (dir === "all" || r.direction === dir) &&
      (cat === "all" || r.category === cat),
    ),
    [allWithBalance, dir, cat],
  );

  const withBalance = useMemo<Row[]>(() =>
    filteredRows.map(({ entry: e, running }) => ({
      Tanggal: e.entry_date,
      Sumber: e.source === "auto" ? "Otomatis" : "Manual",
      Kategori: e.category,
      Keterangan: e.description,
      Referensi: e.reference,
      Metode: e.method,
      Status: e.status,
      Masuk: e.direction === "in" ? e.amount : 0,
      Keluar: e.direction === "out" ? e.amount : 0,
      Saldo: running,
    })),
    [filteredRows],
  );

  const filtered = useMemo(() => filteredRows.map((r) => r.entry), [filteredRows]);
  const totalMasuk = filtered.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalKeluar = filtered.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const inCount = filtered.filter((e) => e.direction === "in").length;
  const outCount = filtered.filter((e) => e.direction === "out").length;

  const headers: Header[] = [
    { key: "Tanggal", label: "Tanggal" },
    { key: "Kategori", label: "Kategori" },
    { key: "Referensi", label: "Referensi / Invoice" },
    { key: "Metode", label: "Metode" },
    { key: "Status", label: "Status", type: "status" },
    { key: "Keterangan", label: "Keterangan" },
    { key: "Masuk", label: "Masuk", type: "money" },
    { key: "Keluar", label: "Keluar", type: "money" },
    { key: "Saldo", label: "Saldo Berjalan", type: "money" },
  ];

  return (
    <ReportShell
      title="Buku Kas Sekolah"
      subtitle="Kas masuk & keluar sekolah — sinkron dengan Buku Kas Bendahara"
      icon={BookOpen}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Buku_Kas_${from}_${to}`, withBalance, headers)}
      extraFilters={
        <>
          <Select value={dir} onValueChange={setDir}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Arah</SelectItem>
              <SelectItem value="in">Kas Masuk</SelectItem>
              <SelectItem value="out">Kas Keluar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      }
      summary={
        <StatsRow items={[
          { label: "Kas Masuk", value: fmtIDR(totalMasuk), tone: "emerald", icon: TrendingUp, sub: `${inCount} transaksi` },
          { label: "Kas Keluar", value: fmtIDR(totalKeluar), tone: "rose", icon: TrendingDown, sub: `${outCount} transaksi` },
          { label: "Saldo Buku Kas", value: fmtIDR(totalMasuk - totalKeluar), tone: "primary", icon: Wallet, sub: "pada rentang filter" },
          { label: "Jumlah Transaksi", value: filtered.length, tone: "amber", icon: Receipt, sub: "total entri buku kas" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={withBalance} headers={headers} />
    </ReportShell>
  );
}
