// Konfigurasi channel pembayaran ATSkolla → dipakai di UI (picker) & disinkronkan
// dengan edge function `spp-mayar` (sisi server juga meng-clamp fee via whitelist).
// Fee ditambahkan ke amount tagihan wali (ditanggung wali murid).

import mandiriAsset from "@/assets/payment/mandiri.png.asset.json";
import briAsset from "@/assets/payment/bri.png.asset.json";
import bniAsset from "@/assets/payment/bni.png.asset.json";
import bcaAsset from "@/assets/payment/bca.png.asset.json";
import bsiAsset from "@/assets/payment/bsi.png.asset.json";
import qrisAsset from "@/assets/payment/qris.png.asset.json";
import alfamartAsset from "@/assets/payment/alfamart.png.asset.json";
import indomaretAsset from "@/assets/payment/indomaret.png.asset.json";

// Aset dilayani melalui path internal `/__l5e/assets-v1/...` yang hanya tersedia
// di hosting Lovable. Saat aplikasi di-deploy di VPS sendiri (nginx), path itu
// menghasilkan 404 sehingga logo tidak muncul. Prefix ke domain publik Lovable
// jika origin saat ini bukan *.lovable.app / *.lovable.dev.
const LOVABLE_ASSET_HOST = "https://absenpintar.lovable.app";
function assetUrl(u: string): string {
  if (!u || /^https?:\/\//i.test(u)) return u;
  if (typeof window === "undefined") return u;
  const host = window.location.hostname;
  const isLovableHost = /\.lovable\.(app|dev)$/i.test(host) || host === "localhost";
  if (isLovableHost) return u;
  return LOVABLE_ASSET_HOST + u;
}

export type PaymentChannelId = "va" | "qris" | "retail";

export type BankBadge = {
  code: string;
  name: string;
  logo: string;
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
      { code: "MANDIRI", name: "Mandiri", logo: mandiriAsset.url },
      { code: "BRI", name: "BRI", logo: briAsset.url },
      { code: "BNI", name: "BNI", logo: bniAsset.url },
      { code: "BCA", name: "BCA", logo: bcaAsset.url },
      { code: "BSI", name: "BSI", logo: bsiAsset.url },
    ],
  },
  {
    id: "qris",
    label: "QRIS",
    description: "Scan QR dari semua e-wallet & mobile banking (GoPay, OVO, DANA, ShopeePay, dll)",
    fee: 5000,
    banks: [
      { code: "QRIS", name: "QRIS", logo: qrisAsset.url },
    ],
  },
  {
    id: "retail",
    label: "Retail (Alfamart / Indomaret)",
    description: "Bayar tunai di kasir Alfamart atau Indomaret terdekat",
    fee: 8000,
    banks: [
      { code: "ALFAMART", name: "Alfamart", logo: alfamartAsset.url },
      { code: "INDOMARET", name: "Indomaret", logo: indomaretAsset.url },
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
