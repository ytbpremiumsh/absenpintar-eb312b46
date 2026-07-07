import { Wallet, GraduationCap, Shield, LayoutDashboard, Crown, School } from "lucide-react";

export interface DashboardOption {
  key: string;
  label: string;
  description: string;
  path: string;
  icon: any;
  gradient: string;
}

/**
 * Returns the list of dashboards a user with the given roles can access.
 * Used by /select-role and the "Switch Dashboard" menu.
 */
export function getAvailableDashboards(roles: string[]): DashboardOption[] {
  const out: DashboardOption[] = [];

  if (roles.includes("super_admin")) {
    out.push({
      key: "super_admin",
      label: "Super Admin",
      description: "Kelola seluruh platform",
      path: "/super-admin",
      icon: Crown,
      gradient: "from-amber-500 to-orange-600",
    });
  }
  if (roles.includes("principal")) {
    out.push({
      key: "principal",
      label: "Kepala Sekolah",
      description: "Pusat monitoring seluruh sekolah",
      path: "/kepsek",
      icon: School,
      gradient: "from-indigo-500 to-blue-600",
    });
  }
  if (roles.includes("school_admin")) {
    out.push({
      key: "school_admin",
      label: "Admin Sekolah",
      description: "Dashboard utama sekolah",
      path: "/dashboard",
      icon: LayoutDashboard,
      gradient: "from-[#5B6CF9] to-[#4c5ded]",
    });
  }
  if (roles.includes("staff") && !roles.includes("school_admin")) {
    out.push({
      key: "staff",
      label: "Operator",
      description: "Operasional absensi & data",
      path: "/dashboard",
      icon: Shield,
      gradient: "from-sky-500 to-blue-600",
    });
  }
  if (roles.includes("teacher")) {
    out.push({
      key: "teacher",
      label: "Wali Kelas / Guru",
      description: "Kelola kelas & siswa Anda",
      path: "/teacher-dashboard",
      icon: GraduationCap,
      gradient: "from-violet-500 to-purple-600",
    });
  }
  if (roles.includes("bendahara")) {
    out.push({
      key: "bendahara",
      label: "Bendahara",
      description: "Sistem keuangan SPP",
      path: "/bendahara",
      icon: Wallet,
      gradient: "from-violet-500 to-purple-600",
    });
  }
  return out;
}
