import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PlanFeatures {
  planName: string;
  isTrial: boolean;
  trialDaysLeft: number | null;
  trialExpiresAt: string | null;
  canImportExport: boolean;
  canUploadPhoto: boolean;
  canExportReport: boolean;
  canCustomLogo: boolean;
  canMultiBranch: boolean;
  canWhatsApp: boolean;
  canMultiStaff: boolean;
  canFaceRecognition: boolean;
  maxClasses: number;
  maxStudentsPerClass: number;
  maxStudentsTotal: number | null;
  subscriptionEnabled: boolean;
  loading: boolean;
}

const PLAN_FEATURES: Record<string, Omit<PlanFeatures, "planName" | "loading" | "isTrial" | "trialDaysLeft" | "trialExpiresAt" | "subscriptionEnabled">> = {
  Free: {
    canImportExport: false,
    canUploadPhoto: false,
    canExportReport: false,
    canCustomLogo: false,
    canMultiBranch: false,
    canWhatsApp: false,
    canMultiStaff: false,
    canFaceRecognition: false,
    maxClasses: 2,
    maxStudentsPerClass: 10,
    maxStudentsTotal: 20,
  },
  Basic: {
    canImportExport: true,
    canUploadPhoto: true,
    canExportReport: true,
    canCustomLogo: false,
    canMultiBranch: false,
    canWhatsApp: false,
    canMultiStaff: false,
    canFaceRecognition: false,
    maxClasses: 10,
    maxStudentsPerClass: 50,
    maxStudentsTotal: 200,
  },
  School: {
    canImportExport: true,
    canUploadPhoto: true,
    canExportReport: true,
    canCustomLogo: true,
    canMultiBranch: false,
    canWhatsApp: true,
    canMultiStaff: true,
    canFaceRecognition: true,
    maxClasses: 999,
    maxStudentsPerClass: 999,
    maxStudentsTotal: null,
  },
  Premium: {
    canImportExport: true,
    canUploadPhoto: true,
    canExportReport: true,
    canCustomLogo: true,
    canMultiBranch: true,
    canWhatsApp: true,
    canMultiStaff: true,
    canFaceRecognition: true,
    maxClasses: 999,
    maxStudentsPerClass: 999,
    maxStudentsTotal: null,
  },
};

// Simple module-level cache for the global subscription toggle (survives per-page mounts)
let subscriptionEnabledCache: boolean | null = null;
let subscriptionEnabledPromise: Promise<boolean> | null = null;

async function getSubscriptionEnabled(): Promise<boolean> {
  if (subscriptionEnabledCache !== null) return subscriptionEnabledCache;
  if (subscriptionEnabledPromise) return subscriptionEnabledPromise;
  subscriptionEnabledPromise = (async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "subscription_enabled")
        .maybeSingle();
      // Default: true (system enabled). Only "false" disables it.
      const enabled = data?.value !== "false";
      subscriptionEnabledCache = enabled;
      return enabled;
    } catch {
      subscriptionEnabledCache = true;
      return true;
    }
  })();
  return subscriptionEnabledPromise;
}

export function invalidateSubscriptionEnabledCache() {
  subscriptionEnabledCache = null;
  subscriptionEnabledPromise = null;
}

export function useSubscriptionFeatures(): PlanFeatures {
  const { profile } = useAuth();
  const [planName, setPlanName] = useState("Free");
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const enabled = await getSubscriptionEnabled();
      setSubscriptionEnabled(enabled);

      if (!profile?.school_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("school_subscriptions")
        .select("*, subscription_plans(name)")
        .eq("school_id", profile.school_id)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const sub = data as any;
        const name = sub.subscription_plans?.name || "Free";
        const isTrialSub = sub.status === "trial";

        if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
          setPlanName("Free");
          setIsTrial(false);
          setTrialDaysLeft(null);
          setTrialExpiresAt(null);
        } else {
          setPlanName(name);
          setIsTrial(isTrialSub);
          setTrialExpiresAt(sub.expires_at || null);
          if (isTrialSub && sub.expires_at) {
            const days = Math.ceil(
              (new Date(sub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            setTrialDaysLeft(Math.max(0, days));
          } else {
            setTrialDaysLeft(null);
            setTrialExpiresAt(null);
          }
        }
      }
      setLoading(false);
    };
    fetch();
  }, [profile?.school_id]);

  // Ketika sistem langganan dinonaktifkan Super Admin: semua sekolah otomatis Premium unlimited.
  if (!subscriptionEnabled) {
    return {
      planName: "Premium",
      isTrial: false,
      trialDaysLeft: null,
      trialExpiresAt: null,
      subscriptionEnabled: false,
      loading,
      ...PLAN_FEATURES.Premium,
    };
  }

  const baseFeatures = PLAN_FEATURES[planName] || PLAN_FEATURES.Free;
  const features = isTrial ? { ...baseFeatures, canFaceRecognition: true } : baseFeatures;

  return { planName, isTrial, trialDaysLeft, trialExpiresAt, subscriptionEnabled, loading, ...features };
}
