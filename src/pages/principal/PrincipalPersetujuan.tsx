import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrincipalData } from "@/hooks/usePrincipalData";
import { fmtIDR } from "./_shared";

export default function PrincipalPersetujuan() {
  const { user } = useAuth();
  const { loading, leaves, setLeaves, pendingSettlements, withdrawals, announcements } = usePrincipalData();

  const approveLeave = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("parent_leave_requests")
      .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Gagal memperbarui");
    toast.success(status === "approved" ? "Disetujui" : "Ditolak");
    setLeaves(leaves.filter((x: any) => x.id !== id));
  };

  if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const total = leaves.length + pendingSettlements.length + withdrawals.length + announcements.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Persetujuan"
        subtitle={`${total} pengajuan menunggu tinjauan`}
        icon={ClipboardList}
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Approval Center</CardTitle>
          <CardDescription>Setujui atau tolak pengajuan dari berbagai modul</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="leaves">
            <TabsList className="mb-3 flex-wrap h-auto">
              <TabsTrigger value="leaves">Izin Siswa ({leaves.length})</TabsTrigger>
              <TabsTrigger value="settlements">Pencairan SPP ({pendingSettlements.length})</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdraw Afiliasi ({withdrawals.length})</TabsTrigger>
              <TabsTrigger value="announcements">Pengumuman ({announcements.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="leaves" className="space-y-2">
              {leaves.length === 0 && <Empty text="Tidak ada pengajuan izin siswa" />}
              {leaves.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{l.students?.name || "Siswa"} • {l.students?.class || "-"}</div>
                    <div className="text-xs text-muted-foreground">{l.type} • {l.date} • {l.reason}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => approveLeave(l.id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" />Tolak</Button>
                    <Button size="sm" onClick={() => approveLeave(l.id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Setujui</Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="settlements" className="space-y-2">
              {pendingSettlements.length === 0 && <Empty text="Tidak ada pencairan menunggu" />}
              {pendingSettlements.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{s.settlement_code} • {fmtIDR(s.final_payout)}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.bank_name} • {s.account_number} • {s.account_holder}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">Menunggu proses</Badge>
                </div>
              ))}
              {pendingSettlements.length > 0 && (
                <div className="text-[11px] text-muted-foreground pt-1">
                  Pencairan diproses otomatis oleh sistem bendahara setelah verifikasi.
                </div>
              )}
            </TabsContent>

            <TabsContent value="withdrawals" className="space-y-2">
              {withdrawals.length === 0 && <Empty text="Tidak ada withdraw afiliasi" />}
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60">
                  <div>
                    <div className="text-sm font-semibold">{fmtIDR(w.amount)}</div>
                    <div className="text-xs text-muted-foreground">{w.bank_name} • {w.account_holder}</div>
                  </div>
                  <Badge variant="secondary">{w.status}</Badge>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="announcements" className="space-y-2">
              {announcements.length === 0 && <Empty text="Tidak ada pengumuman menunggu" />}
              {announcements.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl border border-border/60">
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.target_audience || "semua"}</div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground text-center py-8">{text}</div>;
}
