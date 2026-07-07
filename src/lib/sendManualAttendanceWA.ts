import { supabase } from "@/integrations/supabase/client";

interface Args {
  schoolId: string;
  studentId: string;
  status: string; // hadir/izin/sakit/alfa
  attendanceType: "datang" | "pulang";
  date: string; // YYYY-MM-DD
  timeStr: string; // HH:MM:SS
  recordedBy?: string; // e.g. "Manual Wali Kelas" or "Manual Admin"
}

/**
 * Send WhatsApp notification when a teacher/admin marks a student "hadir" manually.
 * Sends to parent and/or class group based on school_integrations.wa_delivery_target.
 * Only triggers when status === "hadir" and date is today.
 */
export async function sendManualAttendanceWA({
  schoolId,
  studentId,
  status,
  attendanceType,
  date,
  timeStr,
  recordedBy = "Manual Dashboard",
}: Args) {
  try {
    if (status !== "hadir") return;
    if (date !== new Date().toISOString().slice(0, 10)) return;

    const [integrationRes, schoolRes, studentRes] = await Promise.all([
      supabase
        .from("school_integrations")
        .select(
          "attendance_arrive_template, attendance_depart_template, attendance_group_template, wa_delivery_target, wa_enabled"
        )
        .eq("school_id", schoolId)
        .eq("integration_type", "onesender")
        .maybeSingle(),
      supabase.from("schools").select("name").eq("id", schoolId).single(),
      supabase
        .from("students")
        .select("name, class, student_id, parent_phone, parent_name")
        .eq("id", studentId)
        .single(),
    ]);

    const integration: any = integrationRes.data;
    if (!integration || integration.wa_enabled === false) return;
    const student: any = studentRes.data;
    if (!student) return;

    const classRes = await supabase
      .from("classes")
      .select("wa_group_id")
      .eq("school_id", schoolId)
      .eq("name", student.class)
      .maybeSingle();

    const schoolName = schoolRes.data?.name || "";
    const groupId = (classRes.data as any)?.wa_group_id || null;
    const deliveryTarget = integration.wa_delivery_target || "parent_only";

    const now = new Date();
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    const dayName = dayNames[now.getDay()];
    const dateStr = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const hhmm = timeStr.slice(0, 5);
    const typeLabel = attendanceType === "pulang" ? "Pulang" : "Datang (Hadir)";

    const apply = (tpl: string) =>
      tpl
        .replace(/\{student_name\}/g, student.name)
        .replace(/\{class\}/g, student.class)
        .replace(/\{time\}/g, hhmm)
        .replace(/\{day\}/g, dayName)
        .replace(/\{date\}/g, dateStr)
        .replace(/\{student_id\}/g, student.student_id || "")
        .replace(/\{method\}/g, recordedBy)
        .replace(/\{parent_name\}/g, student.parent_name || "")
        .replace(/\{school_name\}/g, schoolName)
        .replace(/\{type\}/g, typeLabel);

    const tasks: Promise<any>[] = [];
    const parentPhone = student.parent_phone || "";

    if ((deliveryTarget === "parent_only" || deliveryTarget === "both") && parentPhone) {
      const tpl =
        attendanceType === "pulang"
          ? integration.attendance_depart_template || ""
          : integration.attendance_arrive_template || "";
      const message = tpl
        ? apply(tpl)
        : `📋 *Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nAnanda *${student.name}* (Kelas ${student.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${hhmm}.\n\nMetode: ${recordedBy}\n\n─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;
      tasks.push(
        supabase.functions.invoke("send-whatsapp", {
          body: { school_id: schoolId, phone: parentPhone, message, message_type: "attendance", student_name: student.name },
        })
      );
    }

    if ((deliveryTarget === "group_only" || deliveryTarget === "both") && groupId) {
      const tpl = integration.attendance_group_template || "";
      const message = tpl
        ? apply(tpl)
        : `📋 *Notifikasi Absensi ${typeLabel}*\n\n${schoolName}\n\nSiswa *${student.name}* (Kelas ${student.class}) telah tercatat ${typeLabel.toLowerCase()} pada ${dayName}, pukul ${hhmm}.\n\nMetode: ${recordedBy}\n\n─────────────\n_ATSkolla — Platform Digital Sekolah Terintegrasi_`;
      tasks.push(
        supabase.functions.invoke("send-whatsapp", {
          body: { school_id: schoolId, group_id: groupId, message, message_type: "attendance_group", student_name: student.name },
        })
      );
    }

    if (tasks.length > 0) await Promise.allSettled(tasks);
  } catch {
    // silent
  }
}
