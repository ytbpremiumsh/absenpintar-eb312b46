import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminWhatsApp from "./SuperAdminWhatsApp";
import SuperAdminRegistrationWA from "./SuperAdminRegistrationWA";

export default function SuperAdminWhatsAppHub() {
  const [tab, setTab] = useState<string>("api");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="rounded-xl">
        <TabsTrigger value="api" className="rounded-lg">Konfigurasi API</TabsTrigger>
        <TabsTrigger value="aktivasi" className="rounded-lg">Aktivasi Sekolah</TabsTrigger>
      </TabsList>
      <TabsContent value="api" className="mt-4"><SuperAdminWhatsApp /></TabsContent>
      <TabsContent value="aktivasi" className="mt-4"><SuperAdminRegistrationWA /></TabsContent>
    </Tabs>
  );
}
