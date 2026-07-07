// Manual JWT verification for edge functions deployed with verify_jwt = false.
// Import: import { verifyCaller } from "../_shared/auth.ts";
import { getAdminClient } from "./supabaseAdmin.ts";

export type CallerClaims = {
  userId: string;
  email: string | null;
  raw: Record<string, unknown>;
};

export async function verifyCaller(req: Request): Promise<CallerClaims | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const admin = getAdminClient();
    // getClaims is the recommended path with the signing-keys system.
    // Fall back to getUser if the SDK lacks it.
    // deno-lint-ignore no-explicit-any
    const anyAuth = admin.auth as any;
    if (typeof anyAuth.getClaims === "function") {
      const { data, error } = await anyAuth.getClaims(token);
      if (error || !data?.claims?.sub) return null;
      return {
        userId: String(data.claims.sub),
        email: (data.claims.email as string) ?? null,
        raw: data.claims,
      };
    }
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return { userId: data.user.id, email: data.user.email ?? null, raw: {} };
  } catch {
    return null;
  }
}

export async function requireCaller(req: Request): Promise<CallerClaims> {
  const c = await verifyCaller(req);
  if (!c) throw new Error("Unauthorized");
  return c;
}
