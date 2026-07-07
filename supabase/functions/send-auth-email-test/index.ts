import { createClient } from "npm:@supabase/supabase-js@2";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_NAME = "ATSkolla";
const SITE_URL = "https://absenpintar.online";
const SENDER_DOMAIN = "notify.atskolla.com";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPPORTED_TYPES = new Set([
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
  "reauthentication",
]);

function replaceVars(input: string, vars: Record<string, string>) {
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => vars[String(key).toLowerCase()] ?? "");
}

function stripHtml(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function smtpUsesImplicitTls(settings: { smtp_port: number; smtp_secure: boolean }) {
  const port = Number(settings.smtp_port);
  if (port === 465) return true;
  if (port === 587) return false;
  return Boolean(settings.smtp_secure);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: caller must be super admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ success: false, error: "Unauthorized" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ success: false, error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: isSuper } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "super_admin",
    });
    if (!isSuper) return json({ success: false, error: "Forbidden" });

    // Input
    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "").trim();
    const to = String(body.to || "").trim();
    if (!type || !to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return json({ success: false, error: "type dan email tujuan wajib diisi" });
    }
    if (!SUPPORTED_TYPES.has(type)) return json({ success: false, error: `Tipe tidak didukung: ${type}` });

    const { data: template, error: templateError } = await admin
      .from("auth_email_templates")
      .select("type, sender_name, subject, html")
      .eq("type", type)
      .maybeSingle();

    if (templateError || !template?.html) {
      return json({ success: false, error: "Template email custom belum tersedia untuk tipe ini" });
    }

    const vars: Record<string, string> = {
      site_name: SITE_NAME,
      site_url: SITE_URL,
      recipient: to,
      email: to,
      confirmation_url: `${SITE_URL}/auth/callback?test_email=1&type=${encodeURIComponent(type)}`,
      token: "123456",
      old_email: "lama@contoh.com",
      new_email: to,
    };

    const subject = `[TEST] ${replaceVars(template.subject || "Email ATSkolla", vars)}`;
    const senderName = template.sender_name || SITE_NAME;
    const html = replaceVars(template.html, vars);
    const text = stripHtml(html);
    const messageId = crypto.randomUUID();

    const { data: settings } = await admin
      .from("email_settings")
      .select("smtp_host, smtp_port, smtp_username, smtp_password, smtp_secure, from_email, from_name, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let via = "lovable_email";
    try {
      if (settings?.smtp_host && settings?.smtp_username && settings?.smtp_password && settings?.from_email) {
        via = "smtp_settings";
        const client = new SMTPClient({
          connection: {
            hostname: settings.smtp_host,
            port: Number(settings.smtp_port) || 587,
            tls: smtpUsesImplicitTls(settings),
            auth: { username: settings.smtp_username, password: settings.smtp_password },
          },
        });

        try {
          await client.send({
            from: `${senderName || settings.from_name || SITE_NAME} <${settings.from_email}>`,
            to,
            subject,
            html,
            content: text,
          });
        } finally {
          try { await client.close(); } catch { /* ignore */ }
        }
      } else {
        const apiKey = Deno.env.get("LOVABLE_API_KEY");
        if (!apiKey) throw new Error("LOVABLE_API_KEY belum tersedia");

        await sendLovableEmail(
          {
            to,
            from: `${senderName} <noreply@${SENDER_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: "transactional",
            label: `${type}_test`,
            idempotency_key: messageId,
            unsubscribe_token: messageId,
            message_id: messageId,
          },
          { apiKey }
        );
      }

      await admin.from("email_logs").insert({
        to_email: to,
        subject,
        event_type: "test",
        status: "sent",
      });
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: `${type}_test`,
        recipient_email: to,
        status: "sent",
        metadata: { via },
      });
    } catch (sendError) {
      const msg = sendError instanceof Error ? sendError.message : String(sendError);
      await admin.from("email_logs").insert({
        to_email: to,
        subject,
        event_type: "test",
        status: "failed",
        error: msg.slice(0, 1000),
      });
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: `${type}_test`,
        recipient_email: to,
        status: "failed",
        error_message: msg.slice(0, 1000),
        metadata: { via },
      });
      return json({ success: false, error: `Gagal mengirim email uji: ${msg}`, via });
    }

    return json({
      success: true,
      via,
      message: `Email uji terkirim ke ${to}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg });
  }
});
