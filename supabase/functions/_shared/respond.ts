// Standard JSON response envelope.
// Enforces the project rule "always return 200 OK from edge functions"
// so the frontend never crashes on non-2xx.
import { corsHeaders } from "./cors.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

export function ok<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

export function fail(
  error: string,
  extra: Record<string, unknown> = {},
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200, // deliberate: keep 200 so `supabase.functions.invoke` resolves
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

export function raw(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}
