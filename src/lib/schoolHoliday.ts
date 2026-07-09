import { supabase } from "@/integrations/supabase/client";

export type HolidayStatus = {
  isHoliday: boolean;
  reason: string | null;
  mode: boolean;
  modeLabel: string | null;
};

const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const DAY_LABELS: Record<number, string> = {
  0: "Minggu", 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu",
};

export async function fetchSchoolHolidayStatus(schoolId: string, when: Date = new Date()): Promise<HolidayStatus> {
  const [sRes, hRes] = await Promise.all([
    supabase.from("schools").select("holiday_mode, holiday_mode_label, holiday_days").eq("id", schoolId).maybeSingle(),
    supabase.from("school_holidays").select("date, label").eq("school_id", schoolId).eq("date", dateKey(when)).eq("is_holiday", true).limit(1).maybeSingle(),
  ]);
  const s: any = sRes.data || {};
  const mode = !!s.holiday_mode;
  const modeLabel = s.holiday_mode_label || null;
  if (mode) {
    return { isHoliday: true, reason: `Mode Libur aktif${modeLabel ? ` — ${modeLabel}` : ""}`, mode, modeLabel };
  }
  const days: number[] = Array.isArray(s.holiday_days) ? s.holiday_days : [];
  const dow = when.getDay();
  if (days.includes(dow)) {
    return { isHoliday: true, reason: `Hari ${DAY_LABELS[dow]} adalah hari libur mingguan sekolah`, mode, modeLabel };
  }
  if (hRes.data) {
    const label = (hRes.data as any).label as string | null;
    return { isHoliday: true, reason: `Tanggal merah sekolah${label ? ` — ${label}` : ""}`, mode, modeLabel };
  }
  return { isHoliday: false, reason: null, mode, modeLabel };
}
