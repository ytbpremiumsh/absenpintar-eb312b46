import { toast } from "sonner";

/**
 * Central error normalization + user-facing toast.
 * Business logic stays intact — this only standardizes messages/logging.
 */

export type NormalizedError = {
  message: string;
  code?: string;
  original: unknown;
};

const NETWORK_HINTS = ["Failed to fetch", "NetworkError", "network request failed"];
const AUTH_HINTS = ["JWT", "Invalid Refresh Token", "not authenticated", "Auth session missing"];

export function normalizeError(err: unknown): NormalizedError {
  if (!err) return { message: "Terjadi kesalahan tidak diketahui", original: err };

  // Supabase / PostgREST style
  const anyErr = err as Record<string, unknown>;
  const rawMsg =
    (typeof anyErr?.message === "string" && anyErr.message) ||
    (typeof anyErr?.error_description === "string" && anyErr.error_description) ||
    (typeof anyErr?.error === "string" && anyErr.error) ||
    (err instanceof Error ? err.message : "") ||
    "";

  const code = typeof anyErr?.code === "string" ? anyErr.code : undefined;

  let message = rawMsg || "Terjadi kesalahan tidak diketahui";

  if (NETWORK_HINTS.some((h) => rawMsg.includes(h))) {
    message = "Koneksi bermasalah. Periksa jaringan Anda dan coba lagi.";
  } else if (AUTH_HINTS.some((h) => rawMsg.includes(h))) {
    message = "Sesi Anda telah berakhir. Silakan login kembali.";
  } else if (code === "PGRST116") {
    message = "Data tidak ditemukan.";
  } else if (code === "23505") {
    message = "Data sudah ada (duplikat).";
  } else if (code === "42501" || rawMsg.toLowerCase().includes("permission denied")) {
    message = "Anda tidak memiliki izin untuk aksi ini.";
  }

  return { message, code, original: err };
}

/**
 * Log to console + show toast. Returns the normalized error for chaining.
 */
export function handleError(err: unknown, context?: string): NormalizedError {
  const norm = normalizeError(err);
  // eslint-disable-next-line no-console
  console.error(`[error${context ? `:${context}` : ""}]`, err);
  toast.error(norm.message);
  return norm;
}

/**
 * Safe wrapper for async calls. Returns [data, error] tuple.
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<[T | null, NormalizedError | null]> {
  try {
    const data = await fn();
    return [data, null];
  } catch (err) {
    return [null, handleError(err, context)];
  }
}
