import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminAnnouncements from "./SuperAdminAnnouncements";
import SuperAdminTickets from "./SuperAdminTickets";
import SuperAdminWhatsAppHub from "./SuperAdminWhatsAppHub";

export default function SuperAdminKomunikasiHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "announcements";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="rounded-xl flex-wrap h-auto">
        <TabsTrigger value="announcements" className="rounded-lg">Pengumuman</TabsTrigger>
        <TabsTrigger value="tickets" className="rounded-lg">Tiket Bantuan</TabsTrigger>
        <TabsTrigger value="whatsapp" className="rounded-lg">WhatsApp</TabsTrigger>
      </TabsList>
      <TabsContent value="announcements" className="mt-4"><SuperAdminAnnouncements /></TabsContent>
      <TabsContent value="tickets" className="mt-4"><SuperAdminTickets /></TabsContent>
      <TabsContent value="whatsapp" className="mt-4"><SuperAdminWhatsAppHub /></TabsContent>
    </Tabs>
  );
}
