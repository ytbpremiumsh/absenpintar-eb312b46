## Fitur: Wali Murid Bayar Cicilan Langsung Online

Wali murid buka tagihan yang mengaktifkan cicilan. Klik **Bayar** → muncul pilihan **Bayar Penuh** atau **Cicil (isi nominal)** → lanjut ke pemilihan metode (QRIS/VA/Retail) sesuai gateway aktif sekolah. Setelah wali membayar, cicilan otomatis tercatat "paid" dan progress invoice terupdate.

### 1. Database (migration)
- Tambah kolom `gateway text` dan `expired_at timestamptz` di `spp_installments` (menandai gateway asal & masa aktif link).
- Tambah kolom `mayar_invoice_id text` (untuk sinkron via Mayar API).
- Index `idx_spp_installments_mayar_txn` pada `mayar_transaction_id` (webhook lookup cepat).

### 2. Edge Functions Gateway (spp-mayar, spp-doku, spp-ipaymu)
Tambah action baru **`parent_create_installment_payment`** di masing-masing:
- Validasi: parent token, invoice bukan SPP, `allow_installment=true`, sekolah `installment_enabled`, `amount ≤ sisa tagihan`, `amount ≥ 10.000`.
- Buat link payment provider dengan amount = nominal cicilan (deskripsi: "Cicilan {period_label} - {student_name}").
- Insert row `spp_installments` status `pending` dengan `gateway`, `mayar_transaction_id`, `mayar_payment_url`, `expired_at`, `payment_method: online_{gateway}`.
- Return `payment_url` + `installment_id`.

### 3. Webhook Handler (mayar-webhook, doku-webhook, ipaymu-webhook)
Setelah update invoice biasa, cek: `SELECT * FROM spp_installments WHERE mayar_transaction_id = <txn_id>`. Jika match, update `status='paid'`, `paid_at=now()`. Trigger DB `recalc_invoice_after_installment` otomatis mengupdate `installment_paid_amount` & menandai invoice `paid` bila lunas.

### 4. Parent Portal Edge Function (parent-portal)
- `spp_list`: tambah `allow_installment, installment_paid_amount, bill_type` di select.
- Action baru **`installment_list`**: return semua cicilan (paid/pending) untuk invoice tertentu.
- Action baru **`spp_pay_installment`**: routing ke `spp-{gateway}` action `parent_create_installment_payment`, teruskan `amount` + `channel`.

### 5. UI Parent Dashboard (ParentDashboard.tsx)
- Setelah klik **Bayar** pada invoice `allow_installment=true` (non-SPP), buka **InstallmentChoiceDialog** baru:
  - Info total tagihan, sudah dibayar, sisa
  - 2 pilihan: **Bayar Lunas** (nominal = sisa) / **Cicil** (input nominal, max = sisa, min 10rb)
  - List riwayat cicilan (nominal + tanggal + status)
  - Tombol **Lanjut ke Pembayaran** → buka `PaymentMethodPicker` seperti biasa
- Untuk invoice SPP atau non-installment: tetap flow lama (langsung picker).
- `confirmPaySpp`: jika mode cicilan aktif, panggil `spp_pay_installment` (bukan `spp_pay`).

### 6. Tampilan Sisa & Detail
- Tiap invoice di parent dashboard menampilkan progress bar cicilan bila `installment_paid_amount > 0`: "Cicilan: Rp X • Sisa: Rp Y" atau badge "Lunas".
- Dialog cicilan menampilkan riwayat transaksi (nominal, metode, waktu, status pending/lunas).

### Yang tidak diubah
- SPP tetap wajib penuh (validasi trigger DB).
- Bendahara masih bisa catat cicilan offline manual seperti sekarang.
- Toggle `installment_enabled` per sekolah tetap dihormati.

### Catatan teknis
- Payment link cicilan reuse mekanisme Mayar/Doku/iPaymu yang sama seperti pembayaran full — hanya beda amount + insert baris installment.
- Setelah invoice fully paid via cumulative cicilan, tidak boleh lagi bikin cicilan baru (validasi di parent-portal).
