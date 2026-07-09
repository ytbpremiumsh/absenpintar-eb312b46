import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PackageType = "payment" | "mandiri";
export type PackageStatus = "active" | "pending_activation";

export interface PackageState {
  loading: boolean;
  packageType: PackageType;
  packageStatus: PackageStatus;
  lastPaymentActivityAt: string | null;
  packageStatusChangedAt: string | null;
  disabledFeatures: string[];
  gracePeriodDays: number;
  mandiriMonthlyRate: number;
  isFeatureBlocked: (feature: string) => boolean;
  refresh: () => void;
}

const DEFAULT_DISABLED = ["attendance_create", "scan_qr", "face_recognition", "rfid"];

export function usePackageStatus(): PackageState {
  const { profile } = useAuth();
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({
    loading: true,
    packageType: "payment" as PackageType,
    packageStatus: "active" as PackageStatus,
    lastPaymentActivityAt: null as string | null,
    packageStatusChangedAt: null as string | null,
    disabledFeatures: DEFAULT_DISABLED,
    gracePeriodDays: 90,
    mandiriMonthlyRate: 1000,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile?.school_id) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const [{ data: school }, { data: settings }] = await Promise.all([
        supabase
          .from("schools")
          .select("package_type, package_status, last_payment_activity_at, package_status_changed_at")
          .eq("id", profile.school_id)
          .maybeSingle(),
        supabase.from("package_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (!alive) return;
      setState({
        loading: false,
        packageType: (school?.package_type as PackageType) || "payment",
        packageStatus: (school?.package_status as PackageStatus) || "active",
        lastPaymentActivityAt: school?.last_payment_activity_at ?? null,
        packageStatusChangedAt: school?.package_status_changed_at ?? null,
        disabledFeatures: (settings?.disabled_features as string[]) || DEFAULT_DISABLED,
        gracePeriodDays: settings?.grace_period_days ?? 90,
        mandiriMonthlyRate: Number(settings?.mandiri_monthly_rate ?? 1000),
      });
    })();
    return () => {
      alive = false;
    };
  }, [profile?.school_id, tick]);

  const isFeatureBlocked = (feature: string) =>
    state.packageStatus === "pending_activation" &&
    state.packageType === "payment" &&
    state.disabledFeatures.includes(feature);

  return { ...state, isFeatureBlocked, refresh: () => setTick((t) => t + 1) };
}
