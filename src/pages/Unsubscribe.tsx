import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error">("validating");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON },
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setState("invalid"); setMessage(j?.error || "Link tidak valid."); return; }
        if (j?.reason === "already_unsubscribed") { setState("already"); return; }
        if (j?.valid) { setState("ready"); return; }
        setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) { setState("error"); setMessage(error.message); return; }
      if ((data as any)?.reason === "already_unsubscribed") { setState("already"); return; }
      setState("done");
    } catch (e: any) {
      setState("error"); setMessage(e?.message || String(e));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F4F5FB]">
      <Card className="max-w-md w-full border-0 shadow-elevated rounded-2xl">
        <CardContent className="p-8 text-center space-y-4">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-[#5B6CF9]/10 flex items-center justify-center">
            <MailX className="h-7 w-7 text-[#5B6CF9]" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Berhenti Berlangganan Email</h1>

          {state === "validating" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memvalidasi...</div>
          )}

          {state === "ready" && (
            <>
              <p className="text-sm text-muted-foreground">Klik tombol di bawah untuk berhenti menerima email dari ATSkolla.</p>
              <Button onClick={confirm} className="w-full bg-[#5B6CF9] hover:bg-[#4c5ded] text-white rounded-xl">Konfirmasi Berhenti Berlangganan</Button>
            </>
          )}

          {state === "submitting" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</div>
          )}

          {state === "done" && (
            <div className="space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="text-sm text-foreground font-medium">Berhasil berhenti berlangganan.</p>
              <p className="text-xs text-muted-foreground">Anda tidak akan menerima email dari alamat ini lagi.</p>
            </div>
          )}

          {state === "already" && (
            <div className="space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="text-sm text-foreground font-medium">Email ini sudah berhenti berlangganan sebelumnya.</p>
            </div>
          )}

          {(state === "invalid" || state === "error") && (
            <div className="space-y-2">
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <p className="text-sm text-foreground font-medium">Link tidak valid atau kadaluarsa.</p>
              {message && <p className="text-xs text-muted-foreground">{message}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
