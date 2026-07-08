import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Wallet, Banknote, CheckCircle2, AlertCircle } from "lucide-react";

const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

export type InstallmentInvoice = {
  id: string;
  school_id: string;
  student_id: string;
  invoice_number: string;
  student_name: string;
  class_name: string;
  period_label: string;
  total_amount: number;
  installment_paid_amount?: number | null;
  allow_installment?: boolean | null;
  status: string;
  bill_type?: string | null;
};

type InstallmentRow = {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  invoice: InstallmentInvoice | null;
  schoolInstallmentEnabled: boolean;
  onChanged?: () => void;
}

export function InstallmentDialog({ open, onClose, invoice, schoolInstallmentEnabled, onChanged }: Props) {
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allow, setAllow] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("offline_cash");
  const [notes, setNotes] = useState("");

  const isSpp = invoice?.bill_type === "spp";
  const total = invoice?.total_amount || 0;
  const paid = rows.filter(r => r.status === "paid").reduce((s, r) => s + (r.amount || 0), 0);
  const remaining = Math.max(0, total - paid);
  const progressPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const load = useCallback(async () => {
    if (!invoice?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("spp_installments")
      .select("id,amount,payment_method,status,paid_at,notes,created_at")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Gagal memuat cicilan: " + error.message);
    setRows((data || []) as InstallmentRow[]);
    setAllow(!!invoice.allow_installment);
    setLoading(false);
  }, [invoice?.id, invoice?.allow_installment]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const toggleAllow = async (v: boolean) => {
    if (!invoice) return;
    setAllow(v);
    const { error } = await supabase
      .from("spp_invoices")
      .update({ allow_installment: v })
      .eq("id", invoice.id);
    if (error) {
      toast.error("Gagal: " + error.message);
      setAllow(!v);
      return;
    }
    toast.success(v ? "Cicilan diaktifkan untuk tagihan ini" : "Cicilan dinonaktifkan");
    onChanged?.();
  };

  const addInstallment = async () => {
    if (!invoice) return;
    const amt = Number(amount.replace(/\D/g, ""));
    if (!amt || amt <= 0) return toast.error("Nominal cicilan tidak valid");
    if (amt > remaining) return toast.error(`Melebihi sisa tagihan (${fmtIDR(remaining)})`);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("spp_installments").insert({
      invoice_id: invoice.id,
      school_id: invoice.school_id,
      student_id: invoice.student_id,
      amount: amt,
      payment_method: method,
      status: "paid",
      paid_at: new Date().toISOString(),
      notes: notes || null,
      created_by: user?.id || null,
    });
    setSaving(false);
    if (error) return toast.error("Gagal simpan: " + error.message);
    toast.success("Cicilan berhasil dicatat");
    setAmount(""); setNotes("");
    await load();
    onChanged?.();
  };

  const removeInstallment = async (id: string) => {
    if (!confirm("Hapus cicilan ini? Status tagihan akan disesuaikan kembali.")) return;
    const { error } = await supabase.from("spp_installments").delete().eq("id", id);
    if (error) return toast.error("Gagal hapus: " + error.message);
    toast.success("Cicilan dihapus");
    await load();
    onChanged?.();
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#5B6CF9]" /> Cicilan Tagihan
          </DialogTitle>
          <DialogDescription className="text-xs">
            {invoice.student_name} • {invoice.class_name} • {invoice.period_label}
          </DialogDescription>
        </DialogHeader>

        {isSpp ? (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-800 dark:text-amber-300">Tagihan SPP wajib bayar penuh</p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">Fitur cicilan hanya berlaku untuk Tagihan Lainnya (Non-SPP).</p>
            </div>
          </div>
        ) : !schoolInstallmentEnabled ? (
          <div className="rounded-lg border-2 border-slate-300 bg-slate-50 dark:bg-slate-900/30 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold">Fitur cicilan dinonaktifkan</p>
              <p className="text-muted-foreground mt-0.5">Hubungi Super Admin untuk mengaktifkan cicilan di sekolah ini.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toggle allow_installment */}
            <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Izinkan Cicilan untuk Tagihan Ini</p>
                <p className="text-[11px] text-muted-foreground">Bila aktif, orang tua & bendahara boleh mencatat pembayaran bertahap.</p>
              </div>
              <Switch checked={allow} onCheckedChange={toggleAllow} />
            </div>

            {allow && (
              <>
                {/* Progress */}
                <div className="rounded-lg bg-gradient-to-br from-[#5B6CF9]/10 to-[#5B6CF9]/5 border border-[#5B6CF9]/20 p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sudah Dibayar</span>
                    <span className="font-bold">{fmtIDR(paid)} / {fmtIDR(total)}</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sisa Tagihan</span>
                    <span className="font-bold text-emerald-600">{fmtIDR(remaining)}</span>
                  </div>
                </div>

                {/* Form tambah */}
                {remaining > 0 && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Catat Pembayaran Cicilan</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Nominal (Rp)</Label>
                        <Input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                          placeholder={String(remaining)}
                          className="h-9 text-sm"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Metode</Label>
                        <Select value={method} onValueChange={setMethod}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offline_cash">Tunai</SelectItem>
                            <SelectItem value="offline_transfer">Transfer Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Catatan (opsional)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis: transfer BCA a.n Budi ref 1234" rows={2} className="text-sm" />
                    </div>
                    <Button onClick={addInstallment} disabled={saving} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded] h-9">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Banknote className="h-4 w-4 mr-1" /> Simpan Cicilan</>}
                    </Button>
                  </div>
                )}

                {/* Riwayat */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">Riwayat Cicilan ({rows.length})</p>
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground text-xs"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat...</div>
                  ) : rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Belum ada cicilan tercatat</p>
                  ) : rows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{fmtIDR(r.amount)}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {r.payment_method === "offline_cash" ? "Tunai" : r.payment_method === "offline_transfer" ? "Transfer" : r.payment_method}
                          </Badge>
                          {r.status === "paid" && <Badge className="bg-emerald-500 text-white border-0 text-[10px] gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> Lunas</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {r.paid_at ? new Date(r.paid_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                        </p>
                        {r.notes && <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{r.notes}"</p>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-red-300 text-red-600 hover:bg-red-50" onClick={() => removeInstallment(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
