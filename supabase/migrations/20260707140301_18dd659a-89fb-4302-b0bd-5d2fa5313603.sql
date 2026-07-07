
CREATE TABLE public.auth_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  sender_name text NOT NULL DEFAULT 'ATSkolla',
  subject text NOT NULL,
  html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_email_templates TO authenticated;
GRANT ALL ON public.auth_email_templates TO service_role;

ALTER TABLE public.auth_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages auth email templates"
  ON public.auth_email_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_auth_email_templates_updated
  BEFORE UPDATE ON public.auth_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.auth_email_templates (type, sender_name, subject, html) VALUES
('signup', 'ATSkolla', 'Konfirmasi Email Anda — ATSkolla',
 '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0b1020;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 16px rgba(11,16,32,.06);">
        <tr><td style="text-align:center;padding-bottom:16px;">
          <img src="https://absenpintar.online/images/logo-atskolla.png" alt="ATSkolla" height="40" style="display:inline-block;" />
        </td></tr>
        <tr><td>
          <h1 style="font-size:22px;margin:0 0 16px;color:#0b1020;">Konfirmasi Email Anda</h1>
          <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">Halo <strong>{{recipient}}</strong>,</p>
          <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 24px;">Terima kasih telah mendaftar di <strong>{{site_name}}</strong>. Silakan konfirmasi email Anda dengan menekan tombol di bawah ini agar akun dapat diaktivasi.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{{confirmation_url}}" style="display:inline-block;background:#5B6CF9;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 32px;border-radius:12px;">Konfirmasi Email</a>
          </div>
          <p style="font-size:13px;line-height:1.6;color:#64748b;margin:24px 0 0;">Jika tombol tidak berfungsi, salin dan tempel tautan berikut di browser Anda:<br/><a href="{{confirmation_url}}" style="color:#5B6CF9;word-break:break-all;">{{confirmation_url}}</a></p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
          <p style="font-size:12px;color:#94a3b8;margin:0;">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
          <p style="font-size:12px;color:#94a3b8;margin:8px 0 0;">— ATSkolla, Platform Digital Sekolah Terintegrasi</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
 </body></html>'),
('recovery', 'ATSkolla', 'Reset Password Anda — ATSkolla',
 '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0b1020;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 16px rgba(11,16,32,.06);">
      <tr><td style="text-align:center;padding-bottom:16px;"><img src="https://absenpintar.online/images/logo-atskolla.png" alt="ATSkolla" height="40" /></td></tr>
      <tr><td>
        <h1 style="font-size:22px;margin:0 0 16px;color:#0b1020;">Reset Password</h1>
        <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">Halo <strong>{{recipient}}</strong>,</p>
        <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 24px;">Kami menerima permintaan untuk mereset password akun Anda di <strong>{{site_name}}</strong>. Tekan tombol di bawah untuk memilih password baru.</p>
        <div style="text-align:center;margin:32px 0;"><a href="{{confirmation_url}}" style="display:inline-block;background:#5B6CF9;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 32px;border-radius:12px;">Reset Password</a></div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
        <p style="font-size:12px;color:#94a3b8;margin:0;">Jika Anda tidak meminta reset password, abaikan email ini — password Anda tetap tidak berubah.</p>
      </td></tr>
    </table>
  </td></tr></table>
 </body></html>'),
('magiclink', 'ATSkolla', 'Tautan Login Anda — ATSkolla',
 '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0b1020;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:32px;"><tr><td><h1 style="font-size:22px;margin:0 0 16px;">Tautan Login Anda</h1><p style="font-size:15px;line-height:1.6;color:#334155;">Klik tombol di bawah untuk masuk ke {{site_name}}.</p><div style="text-align:center;margin:32px 0;"><a href="{{confirmation_url}}" style="display:inline-block;background:#5B6CF9;color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">Login</a></div></td></tr></table></td></tr></table></body></html>'),
('invite', 'ATSkolla', 'Anda Diundang — ATSkolla',
 '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0b1020;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:32px;"><tr><td><h1 style="font-size:22px;margin:0 0 16px;">Anda Diundang</h1><p style="font-size:15px;line-height:1.6;color:#334155;">Anda diundang bergabung ke {{site_name}}. Klik tombol di bawah untuk menerima undangan.</p><div style="text-align:center;margin:32px 0;"><a href="{{confirmation_url}}" style="display:inline-block;background:#5B6CF9;color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">Terima Undangan</a></div></td></tr></table></td></tr></table></body></html>'),
('email_change', 'ATSkolla', 'Konfirmasi Perubahan Email — ATSkolla',
 '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0b1020;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:32px;"><tr><td><h1 style="font-size:22px;margin:0 0 16px;">Konfirmasi Perubahan Email</h1><p style="font-size:15px;line-height:1.6;color:#334155;">Anda meminta perubahan email dari <strong>{{old_email}}</strong> ke <strong>{{new_email}}</strong>.</p><div style="text-align:center;margin:32px 0;"><a href="{{confirmation_url}}" style="display:inline-block;background:#5B6CF9;color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;">Konfirmasi Perubahan</a></div></td></tr></table></td></tr></table></body></html>'),
('reauthentication', 'ATSkolla', 'Kode Verifikasi Anda — ATSkolla',
 '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0b1020;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:32px;"><tr><td><h1 style="font-size:22px;margin:0 0 16px;">Kode Verifikasi</h1><p style="font-size:15px;line-height:1.6;color:#334155;">Gunakan kode berikut untuk mengonfirmasi identitas Anda:</p><p style="text-align:center;font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:6px;color:#0b1020;margin:24px 0;">{{token}}</p></td></tr></table></td></tr></table></body></html>');
