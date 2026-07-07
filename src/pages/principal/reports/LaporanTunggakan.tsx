import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, type Header, type Row } from "./_common";

export default function LaporanTunggakan() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const now = new Date();
  const first = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("spp_invoices")
        .select("invoice_number, student_name, class_name, period_label, period_month, period_year, bill_type, amount, denda, total_amount, status, due_date, parent_name, parent_phone, created_at")
        .eq("school_id", schoolId)
        .neq("status", "paid")
        .gte("due_date", from)
        .lte("due_date", to)
        .order("due_date", { ascending: true });

      const today = new Date().toISOString().slice(0, 10);
      const per: Record<string, any> = {};
      (data || []).forEach((i: any) => {
        const overdueDays = Math.max(0, Math.floor((new Date(today).getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24)));
        const key = i.student_name + "|" + i.class_name;
        if (!per[key]) per[key] = {
          Siswa: i.student_name, Kelas: i.class_name, "Jumlah Tagihan": 0, "Total Tunggakan": 0,
          "Periode Terlama": i.due_date, "Hari Menunggak": 0, "Wali/Ortu": i.parent_name || "-", "No HP": i.parent_phone || "-",
          _detail: [],
        };
        per[key]["Jumlah Tagihan"]++;
        per[key]["Total Tunggakan"] += i.total_amount || 0;
        if (i.due_date < per[key]["Periode Terlama"]) per[key]["Periode Terlama"] = i.due_date;
        per[key]["Hari Menunggak"] = Math.max(per[key]["Hari Menunggak"], overdueDays);
        per[key]._detail.push(i);
      });
      setRows(Object.values(per).map((r: any) => { const { _detail, ...rest } = r; return rest; }));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const summary = useMemo(() => ({
    total: rows.length,
    invoices: rows.reduce((s, r) => s + r["Jumlah Tagihan"], 0),
    nominal: rows.reduce((s, r) => s + r["Total Tunggakan"], 0),
    kritis: rows.filter((r) => r["Hari Menunggak"] > 90).length,
    sedang: rows.filter((r) => r["Hari Menunggak"] >= 30 && r["Hari Menunggak"] <= 90).length,
    ringan: rows.filter((r) => r["Hari Menunggak"] < 30).length,
  }), [rows]);

  const headers: Header[] = [
    { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" },
    { key: "Jumlah Tagihan", label: "Jumlah Tagihan" },
    { key: "Total Tunggakan", label: "Total Tunggakan", type: "money" },
    { key: "Periode Terlama", label: "Periode Terlama" }, { key: "Hari Menunggak", label: "Hari Menunggak" },
    { key: "Wali/Ortu", label: "Wali/Ortu" }, { key: "No HP", label: "No HP" },
  ];

  return (
    <ReportShell
      title="Rekap Tunggakan SPP"
      subtitle="Daftar siswa dengan tunggakan aktif — dikelompokkan per siswa"
      icon={Wallet}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Tunggakan_${from}_${to}`, rows, headers)}
      datesOptional
      summary={
        <StatsRow items={[
          { label: "Siswa Menunggak", value: summary.total, tone: "rose" },
          { label: "Jumlah Invoice", value: summary.invoices, tone: "amber" },
          { label: "Total Nominal", value: `Rp ${summary.nominal.toLocaleString("id-ID")}`, tone: "indigo" },
          { label: "> 90 hari", value: summary.kritis, tone: "rose" },
          { label: "30-90 hari", value: summary.sedang, tone: "amber" },
          { label: "< 30 hari", value: summary.ringan, tone: "sky" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={rows} headers={headers} />
    </ReportShell>
  );
}
