import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";

// Sistem trial / paket langganan sudah dihapus. Edge function ini dipertahankan
// sebagai no-op agar cron / pemanggilan lama tidak error.
serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  return new Response(JSON.stringify({
    success: true,
    downgraded: 0,
    warned: 0,
    note: 'subscription system removed',
    checked_at: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
