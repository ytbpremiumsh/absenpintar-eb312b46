// Disbursement payload builder & bank code map.
// API belum diintegrasikan — file ini menyiapkan struktur data yang dibutuhkan
// gateway (mis. DOKU Disbursement) sehingga tinggal dipanggil pada tahap
// implementasi berikutnya.

export type DisbursementPayload = {
  beneficiaryName: string;
  bankCode: string;
  accountNumber: string;
  amount: number;
  referenceId: string;
  notes?: string;
  callbackUrl?: string;
};

// Peta nama bank populer di Indonesia → kode bank DOKU / SKN.
// Tambahkan sesuai kebutuhan; unknown fallback ke "OTHER".
const BANK_CODE_MAP: Record<string, string> = {
  bca: "014",
  "bank bca": "014",
  mandiri: "008",
  "bank mandiri": "008",
  bni: "009",
  "bank bni": "009",
  bri: "002",
  "bank bri": "002",
  bsi: "451",
  "bank bsi": "451",
  cimb: "022",
  "cimb niaga": "022",
  permata: "013",
  "bank permata": "013",
  danamon: "011",
  "bank danamon": "011",
  btn: "200",
  "bank btn": "200",
  ocbc: "028",
  "ocbc nisp": "028",
  maybank: "016",
  panin: "019",
  mega: "426",
  "bank mega": "426",
  jago: "542",
  "bank jago": "542",
  seabank: "535",
  jenius: "213",
  "bank neo": "490",
  gopay: "GOPAY",
  ovo: "OVO",
  dana: "DANA",
  shopeepay: "SHOPEEPAY",
  linkaja: "LINKAJA",
};

export function resolveBankCode(bankName: string): string {
  if (!bankName) return "OTHER";
  const key = bankName.trim().toLowerCase();
  return BANK_CODE_MAP[key] || "OTHER";
}

export function buildDisbursementPayload(input: {
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  referenceId: string;
  notes?: string;
  callbackUrl?: string;
}): DisbursementPayload {
  return {
    beneficiaryName: input.beneficiaryName,
    bankCode: resolveBankCode(input.bankName),
    accountNumber: input.accountNumber,
    amount: input.amount,
    referenceId: input.referenceId,
    notes: input.notes || "",
    callbackUrl: input.callbackUrl || "",
  };
}
