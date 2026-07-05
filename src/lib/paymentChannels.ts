// Konfigurasi channel pembayaran ATSkolla → dipakai di UI (picker) & disinkronkan
// dengan edge function `spp-mayar` (sisi server juga meng-clamp fee via whitelist).
// Fee ditambahkan ke amount tagihan wali (ditanggung wali murid).

export type PaymentChannelId = "va" | "qris" | "retail";

export type BankBadge = {
  code: string;
  name: string;
  // Warna brand bank untuk pill/badge (tidak pakai logo eksternal supaya cepat load & konsisten).
  bg: string;
  fg?: string;
};

export type PaymentChannel = {
  id: PaymentChannelId;
  label: string;
  description: string;
  fee: number;
  banks: BankBadge[];
};

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  {
    id: "va",
    label: "Virtual Account (VA) Bank",
    description: "Transfer via ATM / Mobile Banking / Internet Banking",
    fee: 5000,
    banks: [
      { code: "BRI", name: "BRI", bg: "#00529C", fg: "#FFFFFF" },
      { code: "BNI", name: "BNI", bg: "#EE7623", fg: "#FFFFFF" },
      { code: "MANDIRI", name: "Mandiri", bg: "#003D79", fg: "#FFCC29" },
      { code: "BSI", name: "BSI", bg: "#00A39D", fg: "#FFFFFF" },
      { code: "BCA", name: "BCA", bg: "#0060AF", fg: "#FFFFFF" },
      { code: "PERMATA", name: "Permata", bg: "#00754A", fg: "#FFFFFF" },
      { code: "CIMB", name: "CIMB Niaga", bg: "#A6192E", fg: "#FFFFFF" },
      { code: "BJB", name: "BJB", bg: "#1E4B8F", fg: "#FFFFFF" },
      { code: "DANAMON", name: "Danamon", bg: "#F58220", fg: "#FFFFFF" },
    ],
  },
  {
    id: "qris",
    label: "QRIS",
    description: "Scan QR dari semua e-wallet & mobile banking (GoPay, OVO, DANA, ShopeePay, dll)",
    fee: 5000,
    banks: [
      { code: "QRIS", name: "QRIS", bg: "#EC1B23", fg: "#FFFFFF" },
      { code: "GOPAY", name: "GoPay", bg: "#00AAE4", fg: "#FFFFFF" },
      { code: "OVO", name: "OVO", bg: "#4C2A86", fg: "#FFFFFF" },
      { code: "DANA", name: "DANA", bg: "#118EEA", fg: "#FFFFFF" },
      { code: "SHOPEEPAY", name: "ShopeePay", bg: "#EE4D2D", fg: "#FFFFFF" },
    ],
  },
  {
    id: "retail",
    label: "Retail (Alfamart / Indomaret)",
    description: "Bayar tunai di kasir Alfamart atau Indomaret terdekat",
    fee: 8000,
    banks: [
      { code: "ALFAMART", name: "Alfamart", bg: "#E60012", fg: "#FFFFFF" },
      { code: "INDOMARET", name: "Indomaret", bg: "#F7C61D", fg: "#1A1A1A" },
    ],
  },
];

export function getChannelFee(id: PaymentChannelId | string | null | undefined): number {
  const c = PAYMENT_CHANNELS.find((x) => x.id === id);
  return c ? c.fee : 0;
}

export function getChannel(id: PaymentChannelId | string | null | undefined): PaymentChannel | undefined {
  return PAYMENT_CHANNELS.find((x) => x.id === id);
}

export function formatIDR(n: number): string {
  return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}
