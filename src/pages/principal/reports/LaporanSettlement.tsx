import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReportShell, ReportTable, StatsRow, downloadCSV, useMonthRange, type Header, type Row } from "./_common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { format } from "date-fns";
import { fmtIDR } from "../_shared";

/**
 * Sinkron dengan Bendahara → BendaharaPencairan.
 * Status Bendahara: pending → approved → paid (dicairkan) atau rejected.
 */
export default function LaporanSettlement() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;
  const now = new Date();
  const first = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10);
  const { last } = useMonthRange();
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [statusF, setStatusF] = useState("all");
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

  const filtered = useMemo(() => statusF === "all" ? rows : rows.filter((r) => r.Status === statusF), [rows, statusF]);

  const summary = useMemo(() => ({
    total: filtered.length,
    pending: filtered.filter((r) => r.Status === "pending").length,
    approved: filtered.filter((r) => r.Status === "approved").length,
    paid: filtered.filter((r) => r.Status === "paid").length,
    rejected: filtered.filter((r) => r.Status === "rejected").length,
    gross: filtered.reduce((s, r) => s + (r.Gross || 0), 0),
    fee: filtered.reduce((s, r) => s + (r["Biaya Gateway"] || 0) + (r["Biaya Withdraw"] || 0), 0),
    payout: filtered.filter((r) => r.Status === "paid").reduce((s, r) => s + (r["Cair Bersih"] || 0), 0),
    pendingPayout: filtered.filter((r) => r.Status === "pending" || r.Status === "approved").reduce((s, r) => s + (r.Net || 0), 0),
  }), [filtered]);

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
      subtitle="Sinkron dengan Bendahara — pending, approved, paid, rejected"
      icon={Landmark}
      from={from} to={to} onFromChange={setFrom} onToChange={setTo}
      onDownload={() => downloadCSV(`Settlement_${from}_${to}`, filtered, headers)}
      extraFilters={
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="paid">Dicairkan</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      }
      summary={
        <StatsRow items={[
          { label: "Total Pengajuan", value: summary.total, tone: "primary" },
          { label: "Pending", value: summary.pending, tone: "amber" },
          { label: "Disetujui", value: summary.approved, tone: "indigo" },
          { label: "Dicairkan", value: summary.paid, tone: "emerald" },
          { label: "Ditolak", value: summary.rejected, tone: "rose" },
          { label: "Total Gross", value: fmtIDR(summary.gross), tone: "indigo" },
          { label: "Menunggu Pencairan", value: fmtIDR(summary.pendingPayout), tone: "amber" },
          { label: "Sudah Cair", value: fmtIDR(summary.payout), tone: "emerald" },
        ]} />
      }
    >
      <ReportTable loading={loading} rows={filtered} headers={headers} />
    </ReportShell>
  );
}
