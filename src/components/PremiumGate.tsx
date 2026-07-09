import { ReactNode } from "react";

// Sistem langganan berpaket dihapus. Semua fitur aktif untuk semua sekolah,
// jadi PremiumGate menjadi pass-through agar pemanggilan lama tetap valid.
interface PremiumGateProps {
  children: ReactNode;
  featureKey?: string;
  requiredPlan?: string;
  featureLabel?: string;
}

export function PremiumGate({ children }: PremiumGateProps) {
  return <>{children}</>;
}
