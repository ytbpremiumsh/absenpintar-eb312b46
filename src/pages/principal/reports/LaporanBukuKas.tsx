import { useEffect, useMemo, useState } from "react";
import { BookOpen, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { fmtIDR } from "../_shared";

export default function LaporanBukuKas() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [dir, setDir] = useState("all");
  const [cat, setCat] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const [rangeQ, priorQ] = await Promise.all([
        supabase.from("cash_book_entries")
          .select("entry_date, direction, category, description, reference, amount, created_at")
          .eq("school_id", schoolId).gte("entry_date", from).lte("entry_date", to)
          .order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("cash_book_entries")
          .select("direction, amount")
          .eq("school_id", schoolId).lt("entry_date", from),
      ]);
      const opening = (priorQ.data || []).reduce((s: number, e: any) => s + (e.direction === "in" ? e.amount : -e.amount), 0);
      setOpeningBalance(opening);

      let running = opening;
      const list: Row[] = [];
      (rangeQ.data || []).forEach((e: any) => {
        const masuk = e.direction === "in" ? e.amount : 0;
        const keluar = e.direction === "out" ? e.amount : 0;
        running += masuk - keluar;
        list.push({
          Tanggal: e.entry_date,
          Kategori: e.category || "-",
          Keterangan: e.description || "-",
          Referensi: e.reference || "-",
          Masuk: masuk,
          Keluar: keluar,
          Saldo: running,
          _dir: e.direction,
        });
      });
      setRows(list);
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.Kategori))).sort(), [rows]);
  const filtered = useMemo(() => rows.filter((r) => (dir === "all" || r._dir === dir) && (cat === "all" || r.Kategori === cat)), [rows, dir, cat]);

  const totalMasuk = filtered.reduce((s, r) => s + r.Masuk, 0);
  const totalKeluar = filtered.reduce((s, r) => s + r.Keluar, 0);
  const saldoAkhir = openingBalance + rows.reduce((s, r) => s + r.Masuk - r.Keluar, 0);

  // Grouping by category
  const byCat = useMemo(() => {
    const m: Record<string, { masuk: number; keluar: number }> = {};
    filtered.forEach((r) => {
      if (!m[r.Kategori]) m[r.Kategori] = { masuk: 0, keluar: 0 };
      m[r.Kategori].masuk += r.Masuk;
      m[r.Kategori].keluar += r.Keluar;
    });
    return Object.entries(m).map(([k, v]) => ({ name: k, Masuk: v.masuk, Keluar: v.keluar }));
  }, [filtered]);

  const headers: Header[] = [
    { key: "Tanggal", label: "Tanggal" },
    { key: "Kategori", label: "Kategori" },
    { key: "Keterangan", label: "Keterangan" },
    { key: "Referensi", label: "Referensi" },
    { key: "Masuk", label: "Masuk", type: "money" },
    { key: "Keluar", label: "Keluar", type: "money" },
    { key: "Saldo", label: "Saldo Berjalan", type: "money" },
  ];

  return (
    <ReportShell
      title="Buku Kas Sekolah"
      subtitle="Pemasukan, pengeluaran & saldo berjalan"
      icon={BookOpen}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Buku_Kas_${from}_${to}`, filtered.map(({ _dir, ...r }) => r), headers)}
      extraFilters={
        <>
          <Select value={dir} onValueChange={setDir}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Arah</SelectItem>
              <SelectItem value="in">Masuk</SelectItem>
              <SelectItem value="out">Keluar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      }
      summary={
        <StatsRow items={[
          { label: "Saldo Awal", value: fmtIDR(openingBalance), tone: "slate", icon: Wallet },
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
      <ReportTable loading={loading} rows={filtered} headers={headers} />
    </ReportShell>
  );
}
