import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminSchools from "./SuperAdminSchools";
import SuperAdminLoginLogs from "./SuperAdminLoginLogs";

export default function SuperAdminSekolahHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "schools";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="rounded-xl">
        <TabsTrigger value="schools" className="rounded-lg">Daftar Sekolah</TabsTrigger>
        <TabsTrigger value="logs" className="rounded-lg">Log Login</TabsTrigger>
      </TabsList>
      <TabsContent value="schools" className="mt-4"><SuperAdminSchools /></TabsContent>
      <TabsContent value="logs" className="mt-4"><SuperAdminLoginLogs /></TabsContent>
    </Tabs>
  );
}
