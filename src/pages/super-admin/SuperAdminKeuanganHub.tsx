import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminPayments from "./SuperAdminPayments";
import SuperAdminBendahara from "./SuperAdminBendahara";

export default function SuperAdminKeuanganHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "payments";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="rounded-xl flex-wrap h-auto">
        <TabsTrigger value="payments" className="rounded-lg">Konfirmasi Bayar</TabsTrigger>
        <TabsTrigger value="bendahara" className="rounded-lg">Bendahara</TabsTrigger>
      </TabsList>
      <TabsContent value="payments" className="mt-4"><SuperAdminPayments /></TabsContent>
      <TabsContent value="bendahara" className="mt-4"><SuperAdminBendahara /></TabsContent>
    </Tabs>
  );
}
