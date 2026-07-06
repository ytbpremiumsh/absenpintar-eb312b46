import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BendaharaSaldo, BendaharaPencairan } from "./BendaharaPages";

export default function BendaharaWithdraw() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "saldo";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="saldo" className="rounded-lg">Saldo & Riwayat</TabsTrigger>
          <TabsTrigger value="pencairan" className="rounded-lg">Pencairan</TabsTrigger>
        </TabsList>
        <TabsContent value="saldo" className="mt-4"><BendaharaSaldo /></TabsContent>
        <TabsContent value="pencairan" className="mt-4"><BendaharaPencairan /></TabsContent>
      </Tabs>
    </div>
  );
}
