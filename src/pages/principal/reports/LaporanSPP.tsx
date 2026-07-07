import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { format } from "date-fns";
import { fmtIDR } from "../_shared";
import { formatPaymentMethodLabel } from "@/lib/paymentMethod";

/**
 * Sinkron dengan Bendahara → BendaharaSaldo:
 *  - Total Bruto = Σ total_amount invoice paid
 *  - Fee Gateway = Σ gateway_fee
 *  - Diterima Bersih = Σ net_amount
 *  - Sudah Dicairkan = invoice paid dengan settlement_id
 *  - Saldo Aktif = invoice paid tanpa settlement_id
 *  - Pembayaran offline (offline_cash / offline_transfer) tidak masuk saldo pencairan.
 */
export default function LaporanSPP() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const { first, last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("spp_invoices")
        .select("invoice_number, student_name, class_name, period_label, period_month, period_year, bill_type, bill_category, amount, denda, total_amount, gateway_fee, net_amount, status, paid_at, payment_channel, payment_method, due_date, parent_name, parent_phone, created_at, settlement_id")
        .eq("school_id", schoolId)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      setRows((data || []).map((i: any) => {
        const method = i.payment_method || "";
        const isOffline = method === "offline_cash" || method === "offline_transfer";
        return {
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
          "Metode": formatPaymentMethodLabel(method) || (i.payment_channel || "-"),
          "Kanal": isOffline ? "Offline" : (i.status === "paid" ? "Online" : "-"),
          "Dibayar Pada": i.paid_at ? format(new Date(i.paid_at), "dd/MM/yy HH:mm") : "-",
          "Status Pencairan": i.status === "paid" && !isOffline ? (i.settlement_id ? "Dicairkan" : "Saldo Aktif") : "-",
          "Wali/Ortu": i.parent_name || "-",
          "No HP": i.parent_phone || "-",
          _method: method,
          _settlement_id: i.settlement_id,
        };
      }));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.Status !== status) return false;
    if (channel === "online" && (r._method === "offline_cash" || r._method === "offline_transfer" || r.Status !== "paid")) return false;
    if (channel === "offline" && r._method !== "offline_cash" && r._method !== "offline_transfer") return false;
    return true;
  }), [rows, status, channel]);

  const paidOnline = filtered.filter((r) => r.Status === "paid" && r._method !== "offline_cash" && r._method !== "offline_transfer");
  const summary = useMemo(() => ({
    total: filtered.length,
    lunas: filtered.filter((r) => r.Status === "paid").length,
    belum: filtered.filter((r) => r.Status !== "paid").length,
    tagihan: filtered.reduce((s, r) => s + (r.Total || 0), 0),
    bruto: paidOnline.reduce((s, r) => s + (r.Total || 0), 0),
    fee: paidOnline.reduce((s, r) => s + (r["Biaya Gateway"] || 0), 0),
    bersih: paidOnline.reduce((s, r) => s + (r["Diterima"] || 0), 0),
    dicairkan: paidOnline.filter((r) => r._settlement_id).reduce((s, r) => s + (r["Diterima"] || 0), 0),
    saldoAktif: paidOnline.filter((r) => !r._settlement_id).reduce((s, r) => s + (r["Diterima"] || 0), 0),
    denda: filtered.reduce((s, r) => s + (r.Denda || 0), 0),
  }), [filtered, paidOnline]);

  const headers: Header[] = [
    { key: "No Invoice", label: "No Invoice" }, { key: "Siswa", label: "Siswa" }, { key: "Kelas", label: "Kelas" },
    { key: "Jenis", label: "Jenis" }, { key: "Kategori", label: "Kategori" }, { key: "Periode", label: "Periode" },
    { key: "Jatuh Tempo", label: "Jatuh Tempo" },
    { key: "Nominal", label: "Nominal", type: "money" }, { key: "Denda", label: "Denda", type: "money" },
    { key: "Total", label: "Total", type: "money" }, { key: "Biaya Gateway", label: "Biaya Gateway", type: "money" },
    { key: "Diterima", label: "Diterima Bersih", type: "money" },
    { key: "Status", label: "Status", type: "status" },
    { key: "Metode", label: "Metode" },
    { key: "Kanal", label: "Kanal" },
    { key: "Dibayar Pada", label: "Dibayar Pada" },
    { key: "Status Pencairan", label: "Status Pencairan", type: "status" },
    { key: "Wali/Ortu", label: "Wali/Ortu" }, { key: "No HP", label: "No HP" },
  ];

  return (
    <ReportShell
      title="Rekap Pembayaran SPP"
      subtitle="Sinkron dengan Bendahara — Saldo Aktif, Pencairan, Fee Gateway"
      icon={Receipt}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`SPP_${from}_${to}`, filtered.map(({ _method, _settlement_id, ...r }) => r), headers)}
      extraFilters={
        <>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="paid">Lunas</SelectItem>
              <SelectItem value="unpaid">Belum Bayar</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kanal</SelectItem>
              <SelectItem value="online">Online (QRIS/VA)</SelectItem>
              <SelectItem value="offline">Offline (Tunai/Manual)</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      summary={
        <StatsRow items={[
          { label: "Invoice", value: summary.total, tone: "primary" },
          { label: "Lunas / Belum", value: `${summary.lunas} / ${summary.belum}`, tone: "emerald" },
          { label: "Total Bruto (Online)", value: fmtIDR(summary.bruto), tone: "indigo" },
          { label: "Fee Gateway", value: fmtIDR(summary.fee), tone: "amber" },
          { label: "Diterima Bersih", value: fmtIDR(summary.bersih), tone: "emerald" },
          { label: "Sudah Dicairkan", value: fmtIDR(summary.dicairkan), tone: "primary" },
          { label: "Saldo Aktif", value: fmtIDR(summary.saldoAktif), tone: "emerald" },
          { label: "Denda", value: fmtIDR(summary.denda), tone: "rose" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={filtered} headers={headers} />
    </ReportShell>
  );
}
