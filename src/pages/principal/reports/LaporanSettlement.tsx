import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { format } from "date-fns";
import { fmtIDR } from "../_shared";

export default function LaporanSettlement() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const now = new Date();
  const first = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10);
  const { last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("spp_settlements")
        .select("*")
        .eq("school_id", schoolId)
        .gte("requested_at", from)
        .lte("requested_at", to + "T23:59:59")
        .order("requested_at", { ascending: false });
      setRows((data || []).map((s: any) => ({
        Kode: s.settlement_code,
        "Diminta": s.requested_at ? format(new Date(s.requested_at), "dd/MM/yy HH:mm") : "-",
        "Disetujui": s.approved_at ? format(new Date(s.approved_at), "dd/MM/yy HH:mm") : "-",
        "Dicairkan": s.paid_at ? format(new Date(s.paid_at), "dd/MM/yy HH:mm") : "-",
        Status: s.status,
        Transaksi: s.total_transactions,
        Gross: s.total_gross,
        "Biaya Gateway": s.total_gateway_fee,
        Net: s.total_net,
        "Biaya Withdraw": s.withdraw_fee,
        "Cair Bersih": s.final_payout,
        Bank: s.bank_name || "-",
        "No Rekening": s.account_number || "-",
        Penerima: s.account_holder || "-",
        Catatan: s.notes || "-",
      })));
      setLoading(false);
    })();
  }, [schoolId, from, to]);

  const summary = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.Status === "pending").length,
    completed: rows.filter((r) => r.Status === "completed" || r.Status === "settled").length,
    rejected: rows.filter((r) => r.Status === "rejected").length,
    gross: rows.reduce((s, r) => s + (r.Gross || 0), 0),
    payout: rows.reduce((s, r) => s + (r["Cair Bersih"] || 0), 0),
  }), [rows]);

  const headers: Header[] = [
    { key: "Kode", label: "Kode" }, { key: "Diminta", label: "Diminta" }, { key: "Disetujui", label: "Disetujui" }, { key: "Dicairkan", label: "Dicairkan" },
    { key: "Status", label: "Status", type: "status" },
    { key: "Transaksi", label: "Transaksi" },
    { key: "Gross", label: "Gross", type: "money" }, { key: "Biaya Gateway", label: "Biaya Gateway", type: "money" },
    { key: "Net", label: "Net", type: "money" }, { key: "Biaya Withdraw", label: "Biaya Withdraw", type: "money" },
    { key: "Cair Bersih", label: "Cair Bersih", type: "money" },
    { key: "Bank", label: "Bank" }, { key: "No Rekening", label: "No Rekening" }, { key: "Penerima", label: "Penerima" }, { key: "Catatan", label: "Catatan" },
  ];

  return (
    <ReportShell
      title="Rekap Settlement / Pencairan"
      subtitle="Riwayat lengkap pencairan dana SPP"
      icon={Landmark}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Settlement_${from}_${to}`, rows, headers)}
      summary={
        <StatsRow items={[
          { label: "Total Pencairan", value: summary.total, tone: "primary" },
          { label: "Menunggu", value: summary.pending, tone: "amber" },
          { label: "Selesai", value: summary.completed, tone: "emerald" },
          { label: "Ditolak", value: summary.rejected, tone: "rose" },
          { label: "Total Gross", value: fmtIDR(summary.gross), tone: "indigo" },
          { label: "Total Cair", value: fmtIDR(summary.payout), tone: "emerald" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={rows} headers={headers} />
    </ReportShell>
  );
}
