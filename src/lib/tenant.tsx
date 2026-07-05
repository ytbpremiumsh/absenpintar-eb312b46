import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tenant resolver (multi-tenant subdomain).
 * Host examples:
 *   atskolla.com / www.atskolla.com / absenpintar.lovable.app / localhost
 *     -> root mode (landing/marketing), tenant = null
 *   smkcendikia.atskolla.com -> tenant slug "smkcendikia"
 *   smk-cendikia.absenpintar.online -> tenant slug "smk-cendikia"
 *
 * Root domains are configurable via VITE_ROOT_HOSTS (comma-separated).
 * Default root hosts include the production domains and lovable preview hosts.
 */

const ROOT_HOSTS = new Set<string>(
  (import.meta.env.VITE_ROOT_HOSTS || "atskolla.com,absenpintar.online,absenpintar.com,localhost,lovable.app,lovableproject.com")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const RESERVED = new Set([
  "www", "app", "api", "admin", "super", "superadmin", "affiliate", "parent",
  "support", "help", "docs", "blog", "mail", "email", "wa", "whatsapp", "cdn",
  "static", "assets", "dashboard", "login", "register", "auth", "panduan",
  "pricing", "fitur", "presentation", "penawaran", "proposal", "pitch",
  "monitoring", "scan", "public", "test", "dev", "staging", "demo", "root",
  "id-preview--be8d9619-1add-4ede-b66b-9c44088286b4", // lovable preview prefix
]);

/**
 * Detect tenant slug from URL path prefix: /t/{slug}/...
 * Returns null if not a tenant path.
 */
export function parseTenantPath(pathname: string = window.location.pathname): string | null {
  const m = pathname.match(/^\/t\/([a-z0-9][a-z0-9-]{1,62}[a-z0-9])(?:\/|$)/i);
  if (!m) return null;
  const sub = m[1].toLowerCase();
  if (RESERVED.has(sub)) return null;
  return sub;
}

/** Basename for BrowserRouter when accessed via path-based tenant. */
export function getTenantBasename(pathname: string = typeof window !== "undefined" ? window.location.pathname : "/"): string {
  const slug = parseTenantPath(pathname);
  return slug ? `/t/${slug}` : "";
}

export function parseSubdomain(hostname: string = window.location.hostname): string | null {
  const host = hostname.toLowerCase();

  // Strip port if any
  const clean = host.split(":")[0];

  // Path-based tenant takes precedence when present (secure fallback for
  // schools whose subdomain does not yet have a wildcard SSL certificate).
  if (typeof window !== "undefined") {
    const pathSlug = parseTenantPath(window.location.pathname);
    if (pathSlug) return pathSlug;
  }

  // Exact root match
  if (ROOT_HOSTS.has(clean)) return null;
  // www.X where X is a root host
  if (clean.startsWith("www.")) {
    const rest = clean.slice(4);
    if (ROOT_HOSTS.has(rest)) return null;
  }

  // IP address -> no tenant
  if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) return null;

  // Lovable preview / project hosts: <slug>.lovable.app / .lovableproject.com
  if (clean.endsWith(".lovable.app") || clean.endsWith(".lovableproject.com")) return null;

  // Find the matching root suffix
  const parts = clean.split(".");
  if (parts.length < 3) return null; // need at least sub.domain.tld

  // Match last 2 parts vs root hosts (e.g. atskolla.com)
  const lastTwo = parts.slice(-2).join(".");
  if (!ROOT_HOSTS.has(lastTwo)) return null;

  const sub = parts.slice(0, parts.length - 2).join("-").toLowerCase();
  if (!sub || sub === "www" || RESERVED.has(sub)) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(sub)) return null;
  return sub;
}


export type TenantSchool = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

type TenantState = {
  loading: boolean;
  slug: string | null;
  school: TenantSchool | null;
  notFound: boolean;
};

const TenantContext = createContext<TenantState>({
  loading: true,
  slug: null,
  school: null,
  notFound: false,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantState>(() => {
    const slug = typeof window !== "undefined" ? parseSubdomain() : null;
    return { loading: !!slug, slug, school: null, notFound: false };
  });

  useEffect(() => {
    if (!state.slug) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, slug, logo")
        .eq("slug", state.slug!)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setState((s) => ({ ...s, loading: false, school: null, notFound: true }));
      } else {
        setState((s) => ({ ...s, loading: false, school: data as TenantSchool, notFound: false }));
        // Update <title>
        try { document.title = `${data.name} - ATSkolla`; } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [state.slug]);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}

/**
 * Return the "root domain" the app should hang subdomains under.
 * Priority:
 *   1. Last-2 host parts if they match VITE_ROOT_HOSTS (e.g. absenpintar.online)
 *   2. Any explicit VITE_ROOT_HOSTS entry (first one that looks like a real domain)
 *   3. Fallback to the current hostname (dev / self-hosted with no env set)
 */
export function getRootDomain(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname.toLowerCase().split(":")[0];
  const parts = host.split(".");
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join(".");
    if (ROOT_HOSTS.has(lastTwo)) return lastTwo;
  }
  // Prefer an env-configured root that has a dot (skip "localhost")
  for (const h of ROOT_HOSTS) {
    if (h.includes(".") && !h.endsWith("lovable.app") && !h.endsWith("lovableproject.com")) {
      return h;
    }
  }
  return host;
}

/** True if the current hostname is a root host (no tenant subdomain). */
export function isRootHost(): boolean {
  if (typeof window === "undefined") return true;
  return parseSubdomain() === null;
}

/**
 * Build a tenant URL using the school's own subdomain
 * (e.g. https://smkcendikia.atskolla.com/admin). Requires wildcard SSL /
 * DNS to be provisioned for the root domain — that is now the default on
 * Lovable-managed hosting for ATSkolla.
 */
export function buildTenantUrl(slug: string, path: string = "/"): string {
  if (typeof window === "undefined") return path;
  const root = getRootDomain();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (root && root !== "localhost") {
    return `${window.location.protocol}//${slug}.${root}${normalizedPath}`;
  }
  // Local dev fallback keeps the path-based form so React Router basename resolves it.
  return `/t/${slug}${normalizedPath}`;
}

/** Path-based tenant URL (legacy fallback for schools without wildcard SSL). */
export function buildTenantPathUrl(slug: string, path: string = "/"): string {
  if (typeof window === "undefined") return path;
  const root = getRootDomain();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (root && root !== "localhost") {
    return `${window.location.protocol}//${root}/t/${slug}${normalizedPath}`;
  }
  return `/t/${slug}${normalizedPath}`;
}

/** @deprecated Use buildTenantUrl — it now returns the subdomain form by default. */
export const buildTenantSubdomainUrl = buildTenantUrl;


