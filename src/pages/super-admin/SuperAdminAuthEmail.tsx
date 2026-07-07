import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Mail, Save, Eye } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type Tpl = {
  id: string;
  type: string;
  sender_name: string;
  subject: string;
  html: string;
  updated_at: string;
};

const TYPES: { key: string; label: string; hint: string }[] = [
  { key: "signup", label: "Konfirmasi Pendaftaran", hint: "Dikirim saat user mendaftar — email wajib divalidasi sebelum akun bisa dipakai." },
  { key: "recovery", label: "Reset Password", hint: "Dikirim ketika user meminta reset password." },
  { key: "magiclink", label: "Magic Link Login", hint: "Login tanpa password via tautan email." },
  { key: "invite", label: "Undangan", hint: "Dikirim ketika mengundang user baru." },
  { key: "email_change", label: "Perubahan Email", hint: "Konfirmasi saat user mengubah alamat email." },
  { key: "reauthentication", label: "Verifikasi Ulang", hint: "Kode verifikasi 6 digit untuk aksi sensitif." },
];

const VARS_BY_TYPE: Record<string, string[]> = {
  signup: ["{{site_name}}", "{{recipient}}", "{{confirmation_url}}"],
  recovery: ["{{site_name}}", "{{recipient}}", "{{confirmation_url}}"],
  magiclink: ["{{site_name}}", "{{confirmation_url}}"],
  invite: ["{{site_name}}", "{{confirmation_url}}"],
  email_change: ["{{site_name}}", "{{old_email}}", "{{new_email}}", "{{confirmation_url}}"],
  reauthentication: ["{{site_name}}", "{{token}}"],
};

export default function SuperAdminAuthEmail() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Record<string, Tpl>>({});
  const [active, setActive] = useState<string>("signup");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("auth_email_templates")
        .select("id, type, sender_name, subject, html, updated_at");
      if (error) toast.error("Gagal memuat template");
      const map: Record<string, Tpl> = {};
      (data || []).forEach((r: any) => { map[r.type] = r; });
      setRows(map);
      setLoading(false);
    })();
  }, []);

  const current = rows[active];

  const update = (patch: Partial<Tpl>) => {
    if (!current) return;
    setRows((r) => ({ ...r, [active]: { ...current, ...patch } }));
  };

  const save = async () => {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase
      .from("auth_email_templates")
      .update({
        sender_name: current.sender_name,
        subject: current.subject,
        html: current.html,
      })
      .eq("id", current.id);
    setSaving(false);
    if (error) return toast.error("Gagal menyimpan: " + error.message);
    toast.success("Template tersimpan");
  };

  const previewSrc = useMemo(() => {
    if (!current) return "";
    const vars: Record<string, string> = {
      site_name: "ATSkolla",
      site_url: "https://atskolla.com",
      recipient: "user@contoh.com",
      email: "user@contoh.com",
      confirmation_url: "https://atskolla.com/verify?token=preview",
      token: "123456",
      old_email: "lama@contoh.com",
      new_email: "baru@contoh.com",
    };
    return current.html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => vars[String(k).toLowerCase()] ?? "");
  }, [current]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Custom Auth Email"
        subtitle="Kelola template email otentikasi (konfirmasi pendaftaran, reset password, dll.) — subjek, nama pengirim, dan isi HTML."
      />

      {loading ? (
        <Card><CardContent className="p-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : (
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="flex flex-wrap h-auto">
            {TYPES.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs sm:text-sm">{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TYPES.map((t) => {
            const row = rows[t.key];
            if (!row || active !== t.key) return <TabsContent key={t.key} value={t.key} />;
            return (
              <TabsContent key={t.key} value={t.key} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t.hint}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Nama Pengirim</Label>
                        <Input
                          value={row.sender_name}
                          onChange={(e) => update({ sender_name: e.target.value })}
                          placeholder="ATSkolla"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Ditampilkan di kolom "From" penerima. Alamat: noreply@atskolla.com</p>
                      </div>
                      <div>
                        <Label>Subjek Email</Label>
                        <Input
                          value={row.subject}
                          onChange={(e) => update({ subject: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Isi Email (HTML)</Label>
                        <div className="text-[11px] text-muted-foreground">
                          Variabel: {VARS_BY_TYPE[t.key]?.join(" ")}
                        </div>
                      </div>
                      <Textarea
                        value={row.html}
                        onChange={(e) => update({ html: e.target.value })}
                        className="font-mono text-xs min-h-[360px]"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Simpan Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</CardTitle>
                    <p className="text-xs text-muted-foreground">Variabel diganti dengan contoh data.</p>
                  </CardHeader>
                  <CardContent>
                    <iframe
                      title="preview"
                      srcDoc={previewSrc}
                      className="w-full h-[520px] rounded-lg border bg-white"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
