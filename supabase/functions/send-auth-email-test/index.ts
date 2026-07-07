import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map our template types → supported auth generateLink types.
// email_change & reauthentication cannot be triggered as ad-hoc test emails,
// so we fall back to magiclink for those (the visual template is still the
// one under test if the admin chose "magiclink"; for the other two we just
// send a magiclink to the recipient so they can visually inspect delivery).
const LINK_TYPE: Record<string, "signup" | "magiclink" | "recovery" | "invite"> = {
  signup: "signup",
  magiclink: "magiclink",
  recovery: "recovery",
  invite: "invite",
  email_change: "magiclink",
  reauthentication: "magiclink",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: caller must be super admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: isSuper } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "super_admin",
    });
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    // Input
    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "").trim();
    const to = String(body.to || "").trim();
    if (!type || !to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return json({ error: "type dan email tujuan wajib diisi" }, 400);
    }
    const linkType = LINK_TYPE[type];
    if (!linkType) return json({ error: `Tipe tidak didukung: ${type}` }, 400);

    // Trigger the real Supabase auth flow → fires auth-email-hook with a valid
    // run_id, which enqueues via the Lovable email pipeline using our custom
    // template + sender domain (notify.atskolla.com).
    const redirectTo = `https://${new URL(supabaseUrl).host.split(".")[0]}.lovable.app`;

    let genErr: unknown = null;
    if (linkType === "signup") {
      // Signup requires a password; use a random one — user only receives the
      // confirmation email. If the email already exists, fall back to magiclink.
      const tmpPassword = crypto.randomUUID() + "Aa1!";
      const { error } = await admin.auth.admin.generateLink({
        type: "signup",
        email: to,
        password: tmpPassword,
        options: { redirectTo },
      });
      if (error && /already|registered|exists/i.test(error.message)) {
        const { error: e2 } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: to,
          options: { redirectTo },
        });
        genErr = e2;
      } else {
        genErr = error;
      }
    } else if (linkType === "invite") {
      const { error } = await admin.auth.admin.generateLink({
        type: "invite",
        email: to,
        options: { redirectTo },
      });
      if (error && /already|registered|exists/i.test(error.message)) {
        const { error: e2 } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: to,
          options: { redirectTo },
        });
        genErr = e2;
      } else {
        genErr = error;
      }
    } else {
      const { error } = await admin.auth.admin.generateLink({
        type: linkType,
        email: to,
        options: { redirectTo },
      });
      genErr = error;
    }

    if (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      return json({ error: "Gagal memicu email: " + msg }, 500);
    }

    return json({
      success: true,
      via: "lovable_auth_hook",
      note:
        type === "email_change" || type === "reauthentication"
          ? "Tipe ini tidak bisa diuji langsung; magiclink dikirim sebagai gantinya untuk verifikasi pengiriman."
          : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
