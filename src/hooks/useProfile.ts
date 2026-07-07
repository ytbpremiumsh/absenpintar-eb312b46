import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserProfile = {
  full_name: string;
  school_id: string | null;
  avatar_url: string | null;
} | null;

export type ProfileBundle = {
  profile: UserProfile;
  roles: string[];
};

const EMPTY: ProfileBundle = { profile: null, roles: [] };

export const profileQueryKey = (userId: string | null | undefined) =>
  ["profile-bundle", userId ?? "anon"] as const;

async function fetchProfileBundle(userId: string): Promise<ProfileBundle> {
  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, school_id, avatar_url")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return {
    profile: profileRes.data ?? null,
    roles: rolesRes.data ? rolesRes.data.map((r) => r.role as string) : [],
  };
}

/**
 * React Query-backed profile + roles fetcher.
 * Safe to call anywhere below <QueryClientProvider>.
 * When userId is null the hook returns the empty bundle without hitting the network.
 */
export function useProfileQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId ?? null),
    queryFn: () => fetchProfileBundle(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    initialData: userId ? undefined : EMPTY,
  });
}

/**
 * Convenience hook for callers that only need the current user's profile.
 * Uses the auth cache; import { useAuth } separately if you also need the user object.
 */
export function useProfile() {
  const { data, isLoading, refetch } = useProfileQuery(
    // Lazy import to avoid circular ref with useAuth
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require("@/hooks/useAuth") as typeof import("@/hooks/useAuth")).useAuth().user?.id ?? null,
  );
  return {
    profile: data?.profile ?? null,
    roles: data?.roles ?? [],
    isLoading,
    refetch,
  };
}

export function useInvalidateProfile() {
  const qc = useQueryClient();
  return (userId: string | null | undefined) =>
    qc.invalidateQueries({ queryKey: profileQueryKey(userId ?? null) });
}
