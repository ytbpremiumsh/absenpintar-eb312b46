// Shared helpers untuk perhitungan saldo & pencairan Bendahara.
// Dipakai di dashboard Bendahara sekolah maupun Super Admin agar angka konsisten.

export const OFFLINE_PAYMENT_METHODS = new Set(["offline_cash", "offline_transfer"]);
export const DEFAULT_WITHDRAW_FEE = 3000;

export const isOfflinePayment = (method?: string | null) =>
  OFFLINE_PAYMENT_METHODS.has((method || "").toLowerCase());

export type SaldoInvoice = {
  status: string;
  payment_method: string | null;
  settlement_id: string | null;
  total_amount: number | null;
  gateway_fee?: number | null;
  net_amount?: number | null;
};

export type SaldoSettlement = {
  status: string;
  final_payout: number | null;
  withdraw_fee?: number | null;
};

/**
 * Hitung saldo aktif (net) yang bisa dicairkan sekolah.
 * Hanya invoice online yang lunas & belum ter-link ke settlement.
 * Formula: Σ net_amount - withdraw_fee (satu kali per rencana pencairan).
 */
export function computeAvailableSaldo(
  invoices: SaldoInvoice[],
  withdrawFee: number = DEFAULT_WITHDRAW_FEE,
) {
  let count = 0;
  let gross = 0;
  let fee = 0;
  let net = 0;
  for (const inv of invoices) {
    if (inv.status !== "paid") continue;
    if (isOfflinePayment(inv.payment_method)) continue;
    if (inv.settlement_id) continue;
    count += 1;
    gross += inv.total_amount || 0;
    fee += inv.gateway_fee || 0;
    net += inv.net_amount ?? (inv.total_amount || 0);
  }
  const finalPayout = Math.max(0, net - (count > 0 ? withdrawFee : 0));
  return { count, gross, fee, net, finalPayout };
}

/**
 * Angka yang sudah dicairkan (settlement status=paid).
 * TIDAK pakai fallback ke gross/net untuk menghindari nilai bias.
 */
export function sumDisbursed(settlements: SaldoSettlement[]) {
  return settlements
    .filter((s) => s.status === "paid")
    .reduce((a, s) => a + (s.final_payout || 0), 0);
}

/**
 * Nilai pencairan yang sedang menunggu (requested/approved/processing).
 */
export function sumPendingPayout(settlements: SaldoSettlement[]) {
  // 'pending' = baru diajukan (default DB); 'requested'/'approved'/'processing' = tahap lanjut sebelum paid.
  const PENDING = new Set(["pending", "requested", "approved", "processing"]);
  return settlements
    .filter((s) => PENDING.has(s.status))
    .reduce((a, s) => a + (s.final_payout || 0), 0);
}

export function countPendingPayout(settlements: SaldoSettlement[]) {
  const PENDING = new Set(["pending", "requested", "approved", "processing"]);
  return settlements.filter((s) => PENDING.has(s.status)).length;
}
