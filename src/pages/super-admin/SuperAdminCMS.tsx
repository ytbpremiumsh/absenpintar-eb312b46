import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuperAdminLanding from "./SuperAdminLanding";
import SuperAdminPresentation from "./SuperAdminPresentation";
import SuperAdminPenawaran from "./SuperAdminPenawaran";
import SuperAdminPanduan from "./SuperAdminPanduan";
import SuperAdminTestimonials from "./SuperAdminTestimonials";
import SuperAdminAutoCaption from "./SuperAdminAutoCaption";
import SuperAdminShortlinks from "./SuperAdminShortlinks";
import SuperAdminMetaPixel from "./SuperAdminMetaPixel";

export default function SuperAdminCMS() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "landing";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="rounded-xl flex-wrap h-auto">
        <TabsTrigger value="landing" className="rounded-lg">Branding & Landing</TabsTrigger>
        <TabsTrigger value="fitur" className="rounded-lg">Halaman Fitur</TabsTrigger>
        <TabsTrigger value="penawaran" className="rounded-lg">Penawaran</TabsTrigger>
        <TabsTrigger value="panduan" className="rounded-lg">Panduan</TabsTrigger>
        <TabsTrigger value="testimoni" className="rounded-lg">Testimoni</TabsTrigger>
        <TabsTrigger value="caption" className="rounded-lg">Auto Caption AI</TabsTrigger>
        <TabsTrigger value="shortlink" className="rounded-lg">Shortlink</TabsTrigger>
        <TabsTrigger value="pixel" className="rounded-lg">Meta Pixel</TabsTrigger>
      </TabsList>
      <TabsContent value="landing" className="mt-4"><SuperAdminLanding /></TabsContent>
      <TabsContent value="fitur" className="mt-4"><SuperAdminPresentation /></TabsContent>
      <TabsContent value="penawaran" className="mt-4"><SuperAdminPenawaran /></TabsContent>
      <TabsContent value="panduan" className="mt-4"><SuperAdminPanduan /></TabsContent>
      <TabsContent value="testimoni" className="mt-4"><SuperAdminTestimonials /></TabsContent>
      <TabsContent value="caption" className="mt-4"><SuperAdminAutoCaption /></TabsContent>
      <TabsContent value="shortlink" className="mt-4"><SuperAdminShortlinks /></TabsContent>
      <TabsContent value="pixel" className="mt-4"><SuperAdminMetaPixel /></TabsContent>
    </Tabs>
  );
}
