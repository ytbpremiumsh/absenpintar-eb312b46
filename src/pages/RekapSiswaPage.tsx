import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExportHistory from "./ExportHistory";
import History from "./History";
import EditAttendance from "./EditAttendance";

export default function RekapSiswaPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "rekap";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="rekap" className="rounded-lg">Rekap Siswa</TabsTrigger>
          <TabsTrigger value="analitik" className="rounded-lg">Analitik Kelas</TabsTrigger>
          <TabsTrigger value="riwayat" className="rounded-lg">Riwayat Edit</TabsTrigger>
        </TabsList>
        <TabsContent value="rekap" className="mt-4"><ExportHistory /></TabsContent>
        <TabsContent value="analitik" className="mt-4"><History /></TabsContent>
        <TabsContent value="riwayat" className="mt-4"><EditAttendance /></TabsContent>
      </Tabs>
    </div>
  );
}

