import { useEffect, useMemo, useState } from "react";
import { BookOpen, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
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
  const [src, setSrc] = useState("all");
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
          .eq("school_id", schoolId).eq("status", "paid").gt("withdraw_fee", 0),
        supabase.from("cash_book_entries")
          .select("direction, amount").eq("school_id", schoolId).lt("entry_date", from),
        supabase.from("spp_invoices")
          .select("total_amount, paid_at").eq("school_id", schoolId).eq("status", "paid").not("paid_at", "is", null).lt("paid_at", from),
        supabase.from("spp_settlements")
          .select("withdraw_fee, status, paid_at").eq("school_id", schoolId).eq("status", "paid").gt("withdraw_fee", 0),
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
      const feeAll = (stl.data as any[]) || [];
      const autoFee: Entry[] = feeAll
        .filter((s) => {
          const d = (s.paid_at || s.approved_at || s.requested_at || "").slice(0, 10);
          return d >= from && d <= to;
        })
        .map((s) => ({
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

      // Saldo Awal — jumlah semua transaksi sebelum tanggal `from`
      const priorManualIn = ((mPrior.data as any[]) || []).filter((e) => e.direction === "in").reduce((s, e) => s + (e.amount || 0), 0);
      const priorManualOut = ((mPrior.data as any[]) || []).filter((e) => e.direction === "out").reduce((s, e) => s + (e.amount || 0), 0);
      const priorInvIn = ((invPrior.data as any[]) || []).reduce((s, e) => s + (e.total_amount || 0), 0);
      const priorFeeOut = ((stlPrior.data as any[]) || [])
        .filter((s: any) => ((s.paid_at || "").slice(0, 10)) && s.paid_at < from)
        .reduce((s: number, e: any) => s + (e.withdraw_fee || 0), 0);
      setPriorSum({ in: priorManualIn + priorInvIn, out: priorManualOut + priorFeeOut });

      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const opening = priorSum.in - priorSum.out;

  const categories = useMemo(() => Array.from(new Set(all.map((r) => r.category))).sort(), [all]);
  const filtered = useMemo(
    () => all.filter((r) => (dir === "all" || r.direction === dir) && (cat === "all" || r.category === cat) && (src === "all" || r.source === src)),
    [all, dir, cat, src],
  );

  // Running balance dari saldo awal
  const withBalance = useMemo(() => {
    let running = opening;
    return filtered.map((e) => {
      running += e.direction === "in" ? e.amount : -e.amount;
      return {
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
      } as Row;
    });
  }, [filtered, opening]);

  const totalMasuk = filtered.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalKeluar = filtered.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const saldoAkhir = opening + all.reduce((s, e) => s + (e.direction === "in" ? e.amount : -e.amount), 0);

  const byCat = useMemo(() => {
    const m: Record<string, { masuk: number; keluar: number }> = {};
    filtered.forEach((e) => {
      if (!m[e.category]) m[e.category] = { masuk: 0, keluar: 0 };
      if (e.direction === "in") m[e.category].masuk += e.amount;
      else m[e.category].keluar += e.amount;
    });
    return Object.entries(m).map(([k, v]) => ({ name: k, Masuk: v.masuk, Keluar: v.keluar }));
  }, [filtered]);

  const headers: Header[] = [
    { key: "Tanggal", label: "Tanggal" },
    { key: "Sumber", label: "Sumber" },
    { key: "Kategori", label: "Kategori" },
    { key: "Keterangan", label: "Keterangan" },
    { key: "Referensi", label: "Referensi" },
    { key: "Metode", label: "Metode" },
    { key: "Status", label: "Status", type: "status" },
    { key: "Masuk", label: "Masuk", type: "money" },
    { key: "Keluar", label: "Keluar", type: "money" },
    { key: "Saldo", label: "Saldo Berjalan", type: "money" },
  ];

  return (
    <ReportShell
      title="Buku Kas Sekolah"
      subtitle="Manual + SPP Online + Biaya Pencairan (sinkron Bendahara)"
      icon={BookOpen}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Buku_Kas_${from}_${to}`, withBalance, headers)}
      extraFilters={
        <>
          <Select value={dir} onValueChange={setDir}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Arah</SelectItem>
              <SelectItem value="in">Masuk</SelectItem>
              <SelectItem value="out">Keluar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={src} onValueChange={setSrc}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="auto">Otomatis</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      summary={
        <StatsRow items={[
          { label: "Saldo Awal", value: fmtIDR(opening), tone: "slate", icon: Wallet },
          { label: "Total Pemasukan", value: fmtIDR(totalMasuk), tone: "emerald", icon: TrendingUp },
          { label: "Total Pengeluaran", value: fmtIDR(totalKeluar), tone: "rose", icon: TrendingDown },
          { label: "Selisih", value: fmtIDR(totalMasuk - totalKeluar), tone: totalMasuk >= totalKeluar ? "emerald" : "rose" },
          { label: "Saldo Akhir", value: fmtIDR(saldoAkhir), tone: "primary", icon: Wallet },
          { label: "Transaksi", value: filtered.length, tone: "indigo" },
        ]} />
      }
    >
      {byCat.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Rekap per Kategori</CardTitle>
            <CardDescription>Pemasukan & pengeluaran berdasarkan kategori</CardDescription>
          </CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCat}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(v: any) => fmtIDR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      <ReportTable loading={loading} rows={withBalance} headers={headers} />
    </ReportShell>
  );
}
