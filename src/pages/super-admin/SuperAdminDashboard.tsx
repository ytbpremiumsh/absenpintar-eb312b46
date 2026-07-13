import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  School, CreditCard, GraduationCap, UserCheck, MessageSquare, TrendingUp,
  ChevronRight, LifeBuoy, Wallet, Bell, AlertCircle, ArrowUpRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";

interface PendingItem {
  id: string;
  title: string;
  detail: string;
  amount?: number;
  created_at: string;
  path: string;
  kind: "ticket" | "settlement" | "withdrawal";
}

interface DashboardStats {
  totalSchools: number;
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  activeSubscriptions: number;
  pendingPayments: number;
  totalRevenue: number;
  recentPayments: any[];
  schools: any[];
  monthlyRevenue: number;
  paidCount: number;
  waActiveCount: number;
  planDistribution: { name: string; value: number; color: string }[];
  pendingTickets: number;
  pendingSettlements: number;
  pendingWithdrawals: number;
  actionQueue: PendingItem[];
  notifications: any[];
  expiringSoon: { school_id: string; school_name: string; plan_name: string; status: string; expires_at: string; days_left: number }[];
}

const fmtIDR = (n: number) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}d lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`;
  return `${Math.floor(s / 86400)}h lalu`;
};

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSchools: 0, totalStudents: 0, totalStaff: 0, totalClasses: 0,
    activeSubscriptions: 0, pendingPayments: 0,
    totalRevenue: 0, monthlyRevenue: 0, paidCount: 0, waActiveCount: 0,
    recentPayments: [], schools: [], planDistribution: [],
    pendingTickets: 0, pendingSettlements: 0, pendingWithdrawals: 0,
    actionQueue: [], notifications: [], expiringSoon: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      const [
        schoolsRes, studentsRes, classesRes, paymentsRes, rolesRes, integrationsRes,
        ticketsRes, settlementsRes, withdrawalsRes, notifRes,
      ] = await Promise.all([
        supabase.from("schools").select("id, name, created_at, logo, address"),
        supabase.from("students").select("id, school_id"),
        supabase.from("classes").select("id, school_id"),
        supabase.from("payment_transactions").select("id, school_id, amount, status, paid_at, created_at, schools(name)").order("created_at", { ascending: false }).limit(10),
        supabase.from("user_roles").select("id, role"),
        supabase.from("school_integrations").select("school_id, is_active").eq("is_active", true),
        supabase.from("support_tickets").select("id, subject, priority, status, created_at, schools(name)").in("status", ["open", "pending"]).order("created_at", { ascending: false }).limit(20),
        supabase.from("spp_settlements").select("id, settlement_code, final_payout, bank_name, status, created_at, schools(name)").in("status", ["pending", "requested", "review"]).order("created_at", { ascending: false }).limit(20),
        supabase.from("affiliate_withdrawals").select("id, amount, bank_name, account_holder, status, created_at, affiliates(full_name)").eq("status", "pending").order("created_at", { ascending: false }).limit(20),
        supabase.from("notifications").select("id, title, message, type, is_read, created_at").is("school_id", null).order("created_at", { ascending: false }).limit(12),
      ]);

      const schools = schoolsRes.data || [];
      const students = studentsRes.data || [];
      const payments = paymentsRes.data || [];
      const roles = rolesRes.data || [];
      const integrations = integrationsRes.data || [];
      const tickets = ticketsRes.data || [];
      const settlements = settlementsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];
      const notifications = notifRes.data || [];

      const pendingPayments = payments.filter((p: any) => p.status === "pending");
      const paidPayments = payments.filter((p: any) => p.status === "paid");
      const totalRevenue = paidPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthlyRevenue = paidPayments
        .filter((p: any) => p.paid_at && p.paid_at >= startOfMonth)
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const staffCount = roles.filter((r: any) => r.role !== "super_admin").length;
      const waActiveSchools = new Set(integrations.map((i: any) => i.school_id)).size;

      const planDistribution: { name: string; value: number; color: string }[] = [];
      const expiringSoon: any[] = [];

      const actionQueue: PendingItem[] = [
        ...tickets.map((t: any) => ({
          id: `t-${t.id}`, kind: "ticket" as const,
          title: t.subject || "Tiket Baru",
          detail: `${t.schools?.name || "—"} • Prioritas ${t.priority || "normal"}`,
          created_at: t.created_at, path: "/super-admin/tickets",
        })),
        ...settlements.map((s: any) => ({
          id: `s-${s.id}`, kind: "settlement" as const,
          title: `Pencairan SPP • ${s.settlement_code || "—"}`,
          detail: `${s.schools?.name || "—"} → ${s.bank_name || "-"}`,
          amount: s.final_payout, created_at: s.created_at, path: "/super-admin/bendahara",
        })),
        ...withdrawals.map((w: any) => ({
          id: `w-${w.id}`, kind: "withdrawal" as const,
          title: `Pencairan Affiliate`,
          detail: `${w.affiliates?.full_name || w.account_holder || "—"} → ${w.bank_name || "-"}`,
          amount: w.amount, created_at: w.created_at, path: "/super-admin/referral",
        })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      setStats({
        totalSchools: schools.length,
        totalStudents: students.length,
        totalStaff: staffCount,
        totalClasses: (classesRes.data || []).length,
        activeSubscriptions: 0,
        pendingPayments: pendingPayments.length,
        totalRevenue, monthlyRevenue,
        paidCount: paidPayments.length,
        waActiveCount: waActiveSchools,
        recentPayments: payments, schools, planDistribution,
        pendingTickets: tickets.length,
        pendingSettlements: settlements.length,
        pendingWithdrawals: withdrawals.length,
        actionQueue, notifications, expiringSoon,
      });
      setLoading(false);
    };

    fetchStats();

    const channel = supabase
      .channel("super-admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "spp_settlements" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_withdrawals" }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-[#7c3aed] border-t-transparent rounded-full" /></div>;

  const statCards = [
    { label: "TOTAL SEKOLAH", value: stats.totalSchools, desc: "terdaftar di platform", icon: School, iconBg: "bg-violet-100 dark:bg-violet-900/40", iconColor: "text-violet-600 dark:text-violet-300" },
    { label: "TOTAL SISWA", value: stats.totalStudents.toLocaleString("id-ID"), desc: "di seluruh sekolah", icon: GraduationCap, iconBg: "bg-purple-100 dark:bg-purple-900/40", iconColor: "text-purple-600 dark:text-purple-300" },
    { label: "TOTAL PENGGUNA", value: stats.totalStaff, desc: "admin & operator", icon: UserCheck, iconBg: "bg-fuchsia-100 dark:bg-fuchsia-900/40", iconColor: "text-fuchsia-600 dark:text-fuchsia-300" },
    { label: "WA AKTIF", value: stats.waActiveCount, desc: "sekolah pakai notif WA", icon: MessageSquare, iconBg: "bg-indigo-100 dark:bg-indigo-900/40", iconColor: "text-indigo-600 dark:text-indigo-300" },
  ];

  const alertBadges = [
    { label: "Tiket Bantuan", value: stats.pendingTickets, icon: LifeBuoy, path: "/super-admin/tickets", tone: "from-rose-500 to-pink-600" },
    { label: "Pencairan SPP", value: stats.pendingSettlements, icon: Wallet, path: "/super-admin/bendahara", tone: "from-amber-500 to-orange-600" },
    { label: "Pencairan Affiliate", value: stats.pendingWithdrawals, icon: TrendingUp, path: "/super-admin/referral", tone: "from-violet-500 to-purple-600" },
    { label: "Pembayaran Pending", value: stats.pendingPayments, icon: CreditCard, path: "/super-admin/payments", tone: "from-fuchsia-500 to-purple-600" },
  ];
  const totalPending = alertBadges.reduce((s, a) => s + a.value, 0);

  const quickActions = [
    { label: "Kelola Sekolah", desc: "Daftar & detail sekolah", icon: School, bg: "bg-violet-50 dark:bg-violet-950/30", iconColor: "text-violet-600 dark:text-violet-300", path: "/super-admin/sekolah" },
    { label: "Langganan", desc: "Konfirmasi pembayaran", icon: CreditCard, bg: "bg-purple-50 dark:bg-purple-950/30", iconColor: "text-purple-600 dark:text-purple-300", path: "/super-admin/payments" },
    { label: "Pencairan SPP", desc: "Review permintaan bendahara", icon: Wallet, bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", iconColor: "text-fuchsia-600 dark:text-fuchsia-300", path: "/super-admin/bendahara" },
    { label: "Tiket Bantuan", desc: "Balas pertanyaan sekolah", icon: LifeBuoy, bg: "bg-indigo-50 dark:bg-indigo-950/30", iconColor: "text-indigo-600 dark:text-indigo-300", path: "/super-admin/tickets" },
  ];

  const kindMeta: Record<PendingItem["kind"], { color: string; icon: any; label: string }> = {
    ticket: { color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", icon: LifeBuoy, label: "Tiket" },
    settlement: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Wallet, label: "SPP" },
    withdrawal: { color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", icon: TrendingUp, label: "Affiliate" },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Super Admin Dashboard"
        subtitle={`Pantau seluruh platform ATSkolla — ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        variant="purple"
        actions={
          <Button
            onClick={() => navigate("/super-admin/sekolah")}
            className="bg-white text-[#6d28d9] hover:bg-white/90 rounded-xl shadow-sm font-semibold"
          >
            <School className="h-4 w-4 mr-2" />
            Kelola Sekolah
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        }
      />

      {/* Pending alerts banner */}
      {totalPending > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/30 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-white dark:bg-violet-900/60 flex items-center justify-center shadow-sm border border-violet-200/60 dark:border-violet-700/40 shrink-0">
              <AlertCircle className="h-5 w-5 text-violet-600 dark:text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-violet-900 dark:text-violet-100">
                {totalPending} item butuh perhatian Anda
              </p>
              <p className="text-xs text-violet-700/80 dark:text-violet-300/80 mt-0.5">
                Pencairan, tiket, dan pembayaran menunggu review.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Alert badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {alertBadges.map((a, i) => (
          <motion.button key={a.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => navigate(a.path)}
            className={`relative overflow-hidden rounded-2xl p-4 text-left text-white bg-gradient-to-br ${a.tone} shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all`}
          >
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-white/80">{a.label}</p>
                <p className="text-3xl font-bold mt-1">{a.value}</p>
                <p className="text-[11px] text-white/80 mt-0.5">menunggu tindakan</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <a.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground tracking-wider uppercase">{s.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{s.value}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                  <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${s.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Action Queue + Notifications */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-violet-600" />
              Antrian Tindakan
            </CardTitle>
            <Badge className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0 text-xs font-bold px-2.5">
              {stats.actionQueue.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {stats.actionQueue.length === 0 ? (
              <div className="text-center py-10">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                </div>
                <p className="text-sm font-semibold text-foreground">Semua bersih</p>
                <p className="text-xs text-muted-foreground mt-1">Tidak ada pencairan, tiket, atau pembayaran yang menunggu.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {stats.actionQueue.slice(0, 12).map((item) => {
                  const meta = kindMeta[item.kind];
                  return (
                    <button key={item.id} onClick={() => navigate(item.path)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-violet-200 dark:hover:border-violet-800/60 hover:bg-violet-50/60 dark:hover:bg-violet-950/30 transition-all text-left">
                      <div className={`h-9 w-9 rounded-xl ${meta.color} flex items-center justify-center shrink-0`}>
                        <meta.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-full text-[10px] font-semibold px-2 py-0 h-4">{meta.label}</Badge>
                          <span className="text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate mt-0.5">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {item.amount != null && (
                          <p className="text-sm font-bold text-foreground">{fmtIDR(item.amount)}</p>
                        )}
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground ml-auto mt-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-violet-600" />
              Notifikasi Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada notifikasi</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {stats.notifications.map((n: any) => {
                  const tone =
                    n.type === "warning" ? "bg-amber-500" :
                    n.type === "error" ? "bg-rose-500" :
                    n.type === "success" ? "bg-emerald-500" : "bg-violet-500";
                  return (
                    <div key={n.id} className={`flex gap-3 p-3 rounded-xl border ${n.is_read ? "border-border/40 bg-background" : "border-violet-200/70 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20"}`}>
                      <div className={`h-2 w-2 rounded-full ${tone} mt-1.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring subscriptions + Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Langganan Segera Berakhir
              <span className="text-[10px] font-normal text-muted-foreground ml-1">(≤ 7 hari)</span>
            </CardTitle>
            {stats.expiringSoon.length > 0 && (
              <Badge className="rounded-full text-xs font-bold px-2.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">
                {stats.expiringSoon.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {stats.expiringSoon.length === 0 ? (
              <div className="py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                  <UserCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm text-muted-foreground">Semua langganan aman — tidak ada yang berakhir dalam 7 hari</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                {stats.expiringSoon.map((s) => {
                  const isExpired = s.days_left < 0;
                  const isCritical = s.days_left <= 2;
                  const tone = isExpired
                    ? "border-rose-200 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/20"
                    : isCritical
                      ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20"
                      : "border-border/40 bg-background";
                  const dayLabel = isExpired
                    ? `Berakhir ${Math.abs(s.days_left)} hari lalu`
                    : s.days_left === 0 ? "Berakhir hari ini"
                    : `${s.days_left} hari lagi`;
                  const dayTone = isExpired ? "text-rose-600 dark:text-rose-400"
                    : isCritical ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground";
                  return (
                    <button
                      key={s.school_id + s.expires_at}
                      onClick={() => navigate("/super-admin/sekolah")}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition hover:border-violet-300 dark:hover:border-violet-700 ${tone}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{s.school_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Paket {s.plan_name} • {s.status === "trial" ? "Trial" : "Aktif"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${dayTone}`}>{dayLabel}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(s.expires_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>


        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Aksi Cepat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button key={action.label} onClick={() => navigate(action.path)}
                  className={`text-left rounded-2xl border border-border/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 ${action.bg}`}>
                  <action.icon className={`h-6 w-6 ${action.iconColor} mb-3`} />
                  <p className={`text-sm font-semibold ${action.iconColor}`}>{action.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{action.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-violet-600" />
            Transaksi Terbaru
          </CardTitle>
          <Button size="sm" variant="ghost" className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40" onClick={() => navigate("/super-admin/payments")}>
            Lihat semua <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {stats.recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada transaksi</p>
          ) : (
            <div className="space-y-2">
              {stats.recentPayments.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{(p as any).schools?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{(p as any).subscription_plans?.name} • {new Date(p.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{fmtIDR(p.amount)}</p>
                    <Badge className={`text-[10px] rounded-full border-0 px-2 ${p.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>
                      {p.status === "paid" ? "Lunas" : p.status === "pending" ? "Pending" : p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;
