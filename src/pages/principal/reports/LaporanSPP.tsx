import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { format } from "date-fns";

export default function LaporanSPP() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("spp_invoices")
        .select("invoice_number, student_name, class_name, period_label, period_month, period_year, bill_type, bill_category, amount, denda, total_amount, gateway_fee, net_amount, status, paid_at, payment_channel, due_date, parent_name, parent_phone, created_at")
        .eq("school_id", schoolId)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      setRows((data || []).map((i: any) => ({
        "No Invoice": i.invoice_number,
        Siswa: i.student_name,
        Kelas: i.class_name,
        "Jenis": i.bill_type,
        "Kategori": i.bill_category || "-",
        Periode: i.period_label || `${i.period_month}/${i.period_year}`,
        "Jatuh Tempo": i.due_date,
        Nominal: i.amount,
        Denda: i.denda,
        Total: i.total_amount,
        "Biaya Gateway": i.gateway_fee,
        "Diterima": i.net_amount,
        Status: i.status,
        "Kanal Bayar": i.payment_channel || "-",
        "Dibayar Pada": i.paid_at ? format(new Date(i.paid_at), "dd/MM/yy HH:mm") : "-",
        "Wali/Ortu": i.parent_name || "-",
        "No HP": i.parent_phone || "-",
      })));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const filtered = useMemo(() => status === "all" ? rows : rows.filter((r) => r.Status === status), [rows, status]);
  const summary = useMemo(() => ({
    total: filtered.length,
    tagihan: filtered.reduce((s, r) => s + (r.Total || 0), 0),
    diterima: filtered.filter((r) => r.Status === "paid").reduce((s, r) => s + (r["Diterima"] || 0), 0),
    lunas: filtered.filter((r) => r.Status === "paid").length,
    belum: filtered.filter((r) => r.Status !== "paid").length,
    denda: filtered.reduce((s, r) => s + (r.Denda || 0), 0),
  }), [filtered]);

  const headers: Header[] = [
    { key: "No Invoice", label: "No Invoice" }, { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" },
    { key: "Jenis", label: "Jenis" }, { key: "Kategori", label: "Kategori" }, { key: "Periode", label: "Periode" },
    { key: "Jatuh Tempo", label: "Jatuh Tempo" },
    { key: "Nominal", label: "Nominal", type: "money" }, { key: "Denda", label: "Denda", type: "money" },
    { key: "Total", label: "Total", type: "money" }, { key: "Biaya Gateway", label: "Biaya Gateway", type: "money" },
    { key: "Diterima", label: "Diterima", type: "money" },
    { key: "Status", label: "Status", type: "status" },
    { key: "Kanal Bayar", label: "Kanal Bayar" }, { key: "Dibayar Pada", label: "Dibayar Pada" },
    { key: "Wali/Ortu", label: "Wali/Ortu" }, { key: "No HP", label: "No HP" },
  ];

  return (
    <ReportShell
      title="Rekap Pembayaran SPP"
      subtitle="Detail seluruh tagihan & pembayaran SPP"
      icon={Receipt}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`SPP_${from}_${to}`, filtered, headers)}
      extraFilters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="paid">Lunas</SelectItem>
            <SelectItem value="unpaid">Belum Bayar</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      }
      summary={
        <StatsRow items={[
          { label: "Invoice", value: summary.total, tone: "primary" },
          { label: "Lunas", value: summary.lunas, tone: "emerald" },
          { label: "Belum Lunas", value: summary.belum, tone: "rose" },
          { label: "Total Tagihan", value: `Rp ${summary.tagihan.toLocaleString("id-ID")}`, tone: "indigo" },
          { label: "Diterima Bersih", value: `Rp ${summary.diterima.toLocaleString("id-ID")}`, tone: "emerald" },
          { label: "Denda", value: `Rp ${summary.denda.toLocaleString("id-ID")}`, tone: "amber" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={filtered} headers={headers} />
    </ReportShell>
  );
}
