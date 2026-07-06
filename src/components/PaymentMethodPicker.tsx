import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ArrowRight, Wallet, QrCode, Store, Check } from "lucide-react";
import {
  PAYMENT_CHANNELS,
  PaymentChannelId,
  formatIDR,
  getChannel,
  computeChannelFee,
} from "@/lib/paymentChannels";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  billAmount: number;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  feeOverrides?: Partial<Record<PaymentChannelId, number>>;
  onConfirm: (channel: PaymentChannelId, fee: number, total: number) => void | Promise<void>;
};

const CHANNEL_ICONS: Record<PaymentChannelId, any> = {
  va: Wallet,
  qris: QrCode,
  retail: Store,
};

export function PaymentMethodPicker({
  open,
  onOpenChange,
  billAmount,
  title = "Pilih Metode Pembayaran",
  subtitle,
  loading = false,
  feeOverrides,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<PaymentChannelId>("qris");
  const feeFor = (id: PaymentChannelId) => computeChannelFee(id, billAmount, feeOverrides);
  const chan = getChannel(selected)!;
  const fee = feeFor(selected);
  const total = (billAmount || 0) + fee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        {/* Rincian tagihan */}
        <div className="rounded-xl bg-secondary/60 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total Tagihan</p>
            <p className="text-lg font-bold text-foreground">{formatIDR(billAmount)}</p>
          </div>
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
        </div>

        {/* Daftar channel */}
        <div className="space-y-2.5">
          {PAYMENT_CHANNELS.map((c) => {
            const Icon = CHANNEL_ICONS[c.id];
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                  active
                    ? "border-[#5B6CF9] bg-[#5B6CF9]/5 shadow-sm"
                    : "border-border/70 hover:border-[#5B6CF9]/40 bg-background"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? "bg-[#5B6CF9] text-white" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{c.label}</p>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          active ? "bg-[#5B6CF9] text-white" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        +{formatIDR(feeFor(c.id))}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {c.banks.map((b) => (
                        <div
                          key={b.code}
                          className="h-8 w-16 rounded-md bg-white border border-border/50 flex items-center justify-center p-1 shadow-sm"
                        >
                          <img
                            src={b.logo}
                            alt={b.name}
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {active && (
                    <div className="h-5 w-5 rounded-full bg-[#5B6CF9] flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Ringkasan total */}
        <div className="rounded-xl border border-border/70 p-3 space-y-1.5 bg-background">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tagihan</span>
            <span className="font-medium">{formatIDR(billAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Biaya Layanan</span>
            <span className="font-medium">{formatIDR(fee)}</span>
          </div>
          <div className="border-t border-border/60 pt-1.5 flex justify-between">
            <span className="font-semibold text-foreground">Total Bayar</span>
            <span className="font-bold text-[#5B6CF9] text-lg">{formatIDR(total)}</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Biaya layanan ditanggung wali murid dan sudah termasuk pada total bayar. Pastikan memilih metode
          pembayaran sesuai channel yang akan digunakan di halaman Mayar.
        </p>

        <Button
          size="lg"
          disabled={loading}
          onClick={() => onConfirm(selected, fee, total)}
          className="w-full bg-[#5B6CF9] hover:bg-[#5065E8] text-white font-semibold shadow-lg shadow-[#5B6CF9]/20"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...
            </>
          ) : (
            <>
              Lanjut Bayar {formatIDR(total)} <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
