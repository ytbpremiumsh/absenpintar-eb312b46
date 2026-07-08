import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminBackup from "./SuperAdminBackup";
import SuperAdminServerInfo from "./SuperAdminServerInfo";
import SuperAdminRFID from "./SuperAdminRFID";

export default function SuperAdminSistemHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "backup";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="rounded-xl flex-wrap h-auto">
        <TabsTrigger value="backup" className="rounded-lg">Backup & Migrasi</TabsTrigger>
        <TabsTrigger value="server" className="rounded-lg">Server Info</TabsTrigger>
        <TabsTrigger value="rfid" className="rounded-lg">USB RFID</TabsTrigger>
      </TabsList>
      <TabsContent value="backup" className="mt-4"><SuperAdminBackup /></TabsContent>
      <TabsContent value="server" className="mt-4"><SuperAdminServerInfo /></TabsContent>
      <TabsContent value="rfid" className="mt-4"><SuperAdminRFID /></TabsContent>
    </Tabs>
  );
}
