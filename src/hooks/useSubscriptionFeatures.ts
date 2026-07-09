// Sistem langganan berpaket (Free/Basic/School/Premium) dihapus.
// Semua sekolah otomatis mendapat semua fitur. Hook ini dipertahankan
// sebagai pass-through agar komponen lama tidak perlu diubah.

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

const ALL_ENABLED: Omit<PlanFeatures, "planName" | "loading" | "isTrial" | "trialDaysLeft" | "trialExpiresAt" | "subscriptionEnabled"> = {
  canImportExport: true,
  canUploadPhoto: true,
  canExportReport: true,
  canCustomLogo: true,
  canMultiBranch: true,
  canWhatsApp: true,
  canMultiStaff: true,
  canFaceRecognition: true,
  maxClasses: 9999,
  maxStudentsPerClass: 9999,
  maxStudentsTotal: null,
};

export function invalidateSubscriptionEnabledCache() {
  /* no-op: sistem langganan dihapus */
}

export function useSubscriptionFeatures(): PlanFeatures {
  return {
    planName: "",
    isTrial: false,
    trialDaysLeft: null,
    trialExpiresAt: null,
    subscriptionEnabled: false,
    loading: false,
    ...ALL_ENABLED,
  };
}
