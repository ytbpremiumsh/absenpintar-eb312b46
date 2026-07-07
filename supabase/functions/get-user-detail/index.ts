import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/respond.ts";

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const caller = await verifyCaller(req);
    if (!caller) return fail("Unauthorized");

    const admin = getAdminClient();

    const { data: rolesData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.userId);
    const callerRoles = (rolesData || []).map((r: { role: string }) => r.role);
    if (!callerRoles.includes("school_admin") && !callerRoles.includes("super_admin")) {
      return fail("Insufficient permissions");
    }

    const body = await req.json().catch(() => ({}));
    const user_id = body?.user_id as string | undefined;
    if (!user_id) return fail("user_id is required");

    const { data: prof } = await admin
      .from("profiles")
      .select("phone, nip")
      .eq("user_id", user_id)
      .maybeSingle();

    const { data: authData } = await admin.auth.admin.getUserById(user_id);

    return ok({
      email: authData?.user?.email || "",
      phone: prof?.phone || "",
      nip: (prof as { nip?: string } | null)?.nip || "",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return fail(msg);
  }
});
