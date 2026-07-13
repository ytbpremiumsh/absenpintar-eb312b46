// Cancel a pending SPP settlement — unlinks its invoices and marks it 'cancelled'.
// Allowed only for the bendahara who requested it (or school_admin at same school),
// and only while status = 'pending'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { requireCaller } from "../_shared/auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const pre = handlePreflight(req); if (pre) return pre;
  try {
    const caller = await requireCaller(req).catch(() => null);
    if (!caller) return json({ error: "Unauthorized" });
    const { settlement_id, reason } = (await req.json().catch(() => ({}))) || {};
    if (!settlement_id) return json({ error: "settlement_id wajib" });

    const admin = getAdminClient();
    const { data: st } = await admin.from("spp_settlements")
      .select("id, school_id, status, requested_by").eq("id", settlement_id).maybeSingle();
    if (!st) return json({ error: "Pengajuan tidak ditemukan" });
    if (st.status !== "pending") return json({ error: "Hanya pengajuan berstatus pending yang bisa dibatalkan" });

    const { data: profile } = await admin.from("profiles").select("school_id").eq("user_id", caller.userId).maybeSingle();
    if (!profile || profile.school_id !== st.school_id) return json({ error: "Akses ditolak" });

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.userId);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const isOwner = st.requested_by === caller.userId;
    const isAllowed = isOwner || roleSet.has("school_admin") || roleSet.has("super_admin");
    if (!isAllowed) return json({ error: "Hanya pemohon atau admin sekolah yang bisa membatalkan" });

    // Unlink invoices & flip status
    await admin.from("spp_invoices").update({ settlement_id: null }).eq("settlement_id", settlement_id);
    await admin.from("spp_settlements").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: caller.userId,
      cancel_reason: typeof reason === "string" ? reason.slice(0, 300) : null,
    }).eq("id", settlement_id);

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message || "Terjadi kesalahan" });
  }
});
