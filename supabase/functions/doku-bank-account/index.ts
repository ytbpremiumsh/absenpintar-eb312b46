// DOKU Settlement Bank Account API
// Endpoints: create | update | get
//
// Auth: DOKU host-to-host signature
//   Digest = base64(SHA256(rawBody))    (empty string body for GET)
//   Component =
//     "Client-Id:" + clientId + "\n"
//     "Request-Id:" + requestId + "\n"
//     "Request-Timestamp:" + timestamp + "\n"
//     "Request-Target:" + path + "\n"
//     "Digest:" + digest              (Digest line omitted when body empty)
//   Signature = "HMACSHA256=" + base64(HMAC-SHA256(secretKey, component))
//
// Secrets required: DOKU_CLIENT_ID, DOKU_SECRET_KEY
// Optional: DOKU_ENV (sandbox|production), DOKU_BASE_URL override

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

type Action = "create" | "update" | "get";

interface Payload {
  action: Action;
  account_id?: string; // bendahara_bank_accounts.id (server looks up rest)
  // Optional direct fields (fallback if account_id not provided)
  bank_code?: string;
  account_number?: string;
  account_holder?: string;
  bank_account_settlement_id?: string;
}

const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function sha256b64(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return b64(buf);
}

async function hmacSha256b64(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return b64(sig);
}

function isoTimestamp(): string {
  // ISO 8601 UTC without ms — DOKU accepts standard ISO
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function randomRequestId(): string {
  return crypto.randomUUID();
}

function baseUrl(): string {
  const override = Deno.env.get("DOKU_BASE_URL");
  if (override) return override.replace(/\/+$/, "");
  const env = (Deno.env.get("DOKU_ENV") || "sandbox").toLowerCase();
  return env === "production"
    ? "https://api.doku.com/fc-h2h-api"
    : "https://api-sandbox.doku.com/fc-h2h-api";
}

async function buildHeaders(method: string, targetPath: string, body: string): Promise<Record<string, string>> {
  const clientId = Deno.env.get("DOKU_CLIENT_ID");
  const secretKey = Deno.env.get("DOKU_SECRET_KEY");
  if (!clientId || !secretKey) {
    throw new Error("DOKU_CLIENT_ID / DOKU_SECRET_KEY belum diset di secrets");
  }
  const requestId = randomRequestId();
  const timestamp = isoTimestamp();

  const digest = body ? await sha256b64(body) : "";
  const lines = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${targetPath}`,
  ];
  if (digest) lines.push(`Digest:${digest}`);
  const component = lines.join("\n");
  const signature = "HMACSHA256=" + await hmacSha256b64(secretKey, component);

  const headers: Record<string, string> = {
    "Client-Id": clientId,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    "Signature": signature,
    "Accept": "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";
  return headers;
}

async function dokuFetch(method: "GET" | "POST" | "PUT", path: string, body?: unknown) {
  const raw = body ? JSON.stringify(body) : "";
  const headers = await buildHeaders(method, path, raw);
  const url = baseUrl() + path;
  const res = await fetch(url, { method, headers, body: raw || undefined });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = getAdminClient();
    const { data: userData } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.action) {
      return new Response(JSON.stringify({ error: "action_required" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load referenced account (source of truth) when account_id present
    let acct: any = null;
    if (payload.account_id) {
      const { data } = await admin
        .from("bendahara_bank_accounts")
        .select("*")
        .eq("id", payload.account_id)
        .maybeSingle();
      acct = data;
      if (!acct) {
        return new Response(JSON.stringify({ error: "account_not_found" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Authorization: user must be super_admin OR belong to the same school
      const { data: rolesRows } = await admin
        .from("user_roles").select("role").eq("user_id", user.id);
      const roles = (rolesRows || []).map((r: any) => r.role);
      const { data: prof } = await admin
        .from("profiles").select("school_id").eq("user_id", user.id).maybeSingle();
      const sameSchool = prof?.school_id && prof.school_id === acct.school_id;
      const allowed = roles.includes("super_admin") || (sameSchool && (roles.includes("school_admin") || roles.includes("bendahara")));
      if (!allowed) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const bankCode = payload.bank_code || acct?.doku_bank_code || "";
    const accountNumber = payload.account_number || acct?.account_number || "";
    const accountHolder = payload.account_holder || acct?.account_holder || "";
    const settlementId = payload.bank_account_settlement_id || acct?.doku_bank_account_settlement_id || "";

    let result;
    if (payload.action === "create") {
      if (!bankCode || !accountNumber || !accountHolder) {
        return new Response(JSON.stringify({ error: "bank_code/account_number/account_holder wajib" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = await dokuFetch("POST", "/v2/settlement-bank-account", {
        bank_account: {
          code: bankCode,
          number: accountNumber,
          name: accountHolder,
          currency: "IDR",
          country: "Indonesia",
        },
      });
    } else if (payload.action === "update") {
      if (!bankCode || !accountNumber || !accountHolder) {
        return new Response(JSON.stringify({ error: "bank_code/account_number/account_holder wajib" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = await dokuFetch("PUT", "/v2/settlement-bank-account", {
        bank_account: {
          code: bankCode,
          number: accountNumber,
          name: accountHolder,
          currency: "IDR",
          country: "Indonesia",
        },
      });
    } else if (payload.action === "get") {
      if (!settlementId) {
        return new Response(JSON.stringify({ error: "bank_account_settlement_id wajib" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = await dokuFetch("GET", `/v2/settlement-bank-account/${encodeURIComponent(settlementId)}`);
    } else {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist to DB if account_id provided and DOKU returned bank_account payload
    const returned = result.data?.bank_account;
    if (acct && returned) {
      const status = String(returned.status || "").toUpperCase();
      const verif = status === "VERIFIED" ? "verified" : status === "REJECTED" ? "rejected" : "pending";
      const patch: Record<string, unknown> = {
        doku_response: result.data,
        doku_synced_at: new Date().toISOString(),
        verification_status: verif,
      };
      if (returned.bank_account_settlement_id) {
        patch.doku_bank_account_settlement_id = returned.bank_account_settlement_id;
      }
      if (bankCode) patch.doku_bank_code = bankCode;
      if (verif === "verified") {
        patch.verified_at = new Date().toISOString();
        patch.verified_by = user.id;
      }
      await admin.from("bendahara_bank_accounts").update(patch).eq("id", acct.id);
    }

    return new Response(JSON.stringify({
      ok: result.ok,
      status: result.status,
      data: result.data,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
