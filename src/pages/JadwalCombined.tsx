import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeachingSchedule from "./TeachingSchedule";
import LiveSchedule from "./LiveSchedule";

export default function JadwalCombined() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "mengajar";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="mengajar" className="rounded-lg">Jadwal Mengajar</TabsTrigger>
          <TabsTrigger value="live" className="rounded-lg">Jadwal Live</TabsTrigger>
        </TabsList>
        <TabsContent value="mengajar" className="mt-4"><TeachingSchedule /></TabsContent>
        <TabsContent value="live" className="mt-4"><LiveSchedule /></TabsContent>
      </Tabs>
    </div>
  );
}
