import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, Clock, Loader2, ArrowRight, Coins, ExternalLink } from "lucide-react";

const fmtIDR = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

export type InstallmentSummary = {
  invoice: any;
  installments: any[];
  locked_amount: number;
  paid_amount?: number;
  pending_amount?: number;
  remaining: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  invoice: any | null;
  loading: boolean;
  summary: InstallmentSummary | null;
  onContinue: (mode: "full" | "installment", amount: number) => void;
  onResumePending?: (installment: any) => void;
}

export function InstallmentChoiceDialog({ open, onClose, invoice, loading, summary, onContinue, onResumePending }: Props) {
  const [mode, setMode] = useState<"full" | "installment">("installment");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) { setMode("installment"); setAmount(""); }
  }, [open, invoice?.id]);

  if (!invoice) return null;
  const total = invoice.total_amount || 0;
  const remaining = summary?.remaining ?? total;
  const paid = summary?.paid_amount ?? Math.max(0, total - remaining);
  const pendingAmt = summary?.pending_amount ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const nominal = mode === "full" ? remaining : (Number(amount.replace(/\D/g, "")) || 0);
  const canContinue = nominal >= 10000 && nominal <= remaining && remaining > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-[#5B6CF9]" /> Bayar Tagihan
          </DialogTitle>
          <DialogDescription className="text-xs">
            {invoice.period_label} • {fmtIDR(total)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat data cicilan…
          </div>
        ) : (
          <>
            {/* Progress ringkasan */}
            <div className="rounded-xl bg-gradient-to-br from-[#5B6CF9]/10 to-[#5B6CF9]/5 border border-[#5B6CF9]/20 p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sudah dibayar (valid)</span>
                <span className="font-bold">{fmtIDR(paid)} / {fmtIDR(total)}</span>
              </div>
              <Progress value={pct} className="h-2" />
              {pendingAmt > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Menunggu pembayaran</span>
                  <span className="font-semibold text-amber-600">{fmtIDR(pendingAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sisa</span>
                <span className={`font-bold ${remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {remaining > 0 ? fmtIDR(remaining) : "Lunas"}
                </span>
              </div>
            </div>

            {remaining > 0 && (
              <>
                {/* Pilihan mode */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode("full")}
                    className={`rounded-xl border-2 p-3 text-left transition ${mode === "full" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-muted hover:border-muted-foreground/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className={`h-4 w-4 ${mode === "full" ? "text-emerald-600" : "text-muted-foreground"}`} />
                      <p className="text-sm font-bold">Bayar Lunas</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Bayar sisa penuh</p>
                    <p className="text-xs font-bold mt-1">{fmtIDR(remaining)}</p>
                  </button>
                  <button
                    onClick={() => setMode("installment")}
                    className={`rounded-xl border-2 p-3 text-left transition ${mode === "installment" ? "border-[#5B6CF9] bg-[#5B6CF9]/10" : "border-muted hover:border-muted-foreground/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className={`h-4 w-4 ${mode === "installment" ? "text-[#5B6CF9]" : "text-muted-foreground"}`} />
                      <p className="text-sm font-bold">Cicil</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Bayar sebagian</p>
                    <p className="text-xs font-bold mt-1">Min Rp 10.000</p>
                  </button>
                </div>

                {mode === "installment" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nominal cicilan (Rp)</Label>
                    <Input
                      inputMode="numeric"
                      value={amount ? Number(amount).toLocaleString("id-ID") : ""}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                      placeholder={`Maks ${fmtIDR(remaining)}`}
                      className="h-10 text-base font-semibold"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[100000, 250000, 500000, remaining].filter((v, i, a) => v > 0 && v <= remaining && a.indexOf(v) === i).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAmount(String(v))}
                          className="text-[10px] px-2 py-1 rounded-md border border-[#5B6CF9]/30 text-[#5B6CF9] hover:bg-[#5B6CF9]/10"
                        >
                          {v === remaining ? "Sisa" : fmtIDR(v)}
                        </button>
                      ))}
                    </div>
                    {nominal > 0 && nominal < 10000 && <p className="text-[11px] text-red-600">Minimum Rp 10.000</p>}
                    {nominal > remaining && <p className="text-[11px] text-red-600">Melebihi sisa tagihan</p>}
                  </div>
                )}

                <Button
                  onClick={() => onContinue(mode, nominal)}
                  disabled={!canContinue}
                  className="w-full h-10 bg-[#5B6CF9] hover:bg-[#4c5ded]"
                >
                  Lanjut Pilih Metode ({fmtIDR(nominal)}) <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}

            {/* Riwayat */}
            {summary && summary.installments.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Riwayat Transaksi Cicilan</p>
                {summary.installments.map((r) => {
                  const isPaid = r.status === "paid";
                  const isPending = r.status === "pending";
                  const expiredMs = r.expired_at ? new Date(r.expired_at).getTime() : 0;
                  const canResume = isPending && r.mayar_payment_url && (!expiredMs || expiredMs > Date.now());
                  return (
                    <div key={r.id} className="rounded-lg border p-2 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">{fmtIDR(r.amount)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {r.paid_at
                              ? new Date(r.paid_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
                              : new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        {isPaid ? (
                          <Badge className="bg-emerald-500 text-white border-0 gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Lunas</Badge>
                        ) : isPending ? (
                          <Badge className="bg-amber-500 text-white border-0 gap-1"><Clock className="h-2.5 w-2.5" /> Menunggu</Badge>
                        ) : (
                          <Badge variant="outline">{r.status}</Badge>
                        )}
                      </div>
                      {canResume && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-8 text-[11px] border-[#5B6CF9]/40 text-[#5B6CF9] hover:bg-[#5B6CF9]/10"
                          onClick={() => onResumePending?.(r)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" /> Lanjutkan Pembayaran
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
