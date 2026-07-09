import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, BookOpen, GraduationCap, Mail, Phone, IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SchoolData } from "./SchoolCard";
import { StudentIdCard } from "@/components/StudentIdCard";

interface StudentData {
  id: string;
  name: string;
  student_id: string;
  class: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  photo_url?: string | null;
  card_number?: string | null;
  qr_code?: string | null;
}

interface ClassData {
  name: string;
  studentCount: number;
}

interface SchoolDetailDialogProps {
  school: SchoolData | null;
  onClose: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

const SchoolDetailDialog = ({ school, onClose, getStatusBadge }: SchoolDetailDialogProps) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [cardStudent, setCardStudent] = useState<StudentData | null>(null);

  useEffect(() => {
    if (school) {
      fetchSchoolDetails(school.id);
    } else {
      setStudents([]);
      setClasses([]);
      setStudentSearch("");
    }
  }, [school]);

  const fetchSchoolDetails = async (schoolId: string) => {
    setLoadingStudents(true);
    const { data } = await supabase
      .from("students")
      .select("id, name, student_id, class, gender, parent_name, parent_phone, photo_url, card_number, qr_code")
      .eq("school_id", schoolId)
      .order("class")
      .order("name");

    const studentList = data || [];
    setStudents(studentList);

    // Build class summary
    const classMap: Record<string, number> = {};
    studentList.forEach((s) => {
      classMap[s.class] = (classMap[s.class] || 0) + 1;
    });
    const classList = Object.entries(classMap)
      .map(([name, studentCount]) => ({ name, studentCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setClasses(classList);
    setLoadingStudents(false);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.student_id.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.class.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (!school) return null;

  return (
    <Dialog open={!!school} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {school.name}
          </DialogTitle>
        </DialogHeader>

        {/* School Info Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">NPSN</p>
            <p className="text-sm font-semibold text-foreground">{school.npsn || "—"}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kota</p>
            <p className="text-sm font-semibold text-foreground">{school.city || "—"}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Provinsi</p>
            <p className="text-sm font-semibold text-foreground">{school.province || "—"}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Timezone</p>
            <p className="text-sm font-semibold text-foreground">{school.timezone || "WIB"}</p>
          </div>
        </div>

        {((school as any).email || (school as any).whatsapp || school.adminName || school.adminEmail || school.adminPhone) && (
          <div className="rounded-lg border bg-muted/30 p-3 mb-3 space-y-2">
            {((school as any).email || (school as any).whatsapp) && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Kontak Sekolah Terdaftar</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(school as any).email && (
                    <a href={`mailto:${(school as any).email}`} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Mail className="h-3.5 w-3.5" />{(school as any).email}
                    </a>
                  )}
                  {(school as any).whatsapp && (
                    <a href={`https://wa.me/${String((school as any).whatsapp).replace(/^0/, '62').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" />{(school as any).whatsapp}
                    </a>
                  )}
                </div>
              </div>
            )}
            {(school.adminName || school.adminEmail || school.adminPhone) && (
              <div className="space-y-1 pt-2 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Penanggung Jawab</p>
                {school.adminName && <p className="text-sm font-semibold text-foreground">{school.adminName}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {school.adminEmail && (
                    <a href={`mailto:${school.adminEmail}`} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Mail className="h-3.5 w-3.5" />{school.adminEmail}
                    </a>
                  )}
                  {school.adminPhone && (
                    <a href={`https://wa.me/${school.adminPhone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" />{school.adminPhone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {school.subscription ? (
            <>
              <Badge className="bg-success/10 text-success border-success/20">{school.subscription.plan_name}</Badge>
              {getStatusBadge(school.subscription.status)}
              {school.subscription.expires_at && (
                <span className="text-xs text-muted-foreground">
                  s/d {new Date(school.subscription.expires_at).toLocaleDateString("id-ID")}
                </span>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Belum berlangganan</Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Terdaftar {new Date(school.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="students" className="flex-1 gap-1">
              <Users className="h-3.5 w-3.5" />
              Siswa ({students.length})
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex-1 gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              Kelas ({classes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari nama, NIS, atau kelas..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            {loadingStudents ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Tidak ada siswa ditemukan</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>JK</TableHead>
                      <TableHead>Orang Tua</TableHead>
                      <TableHead>No. HP</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.slice(0, 100).map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs">{s.student_id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{s.class}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{s.gender === "L" ? "L" : "P"}</TableCell>
                        <TableCell className="text-xs">{s.parent_name}</TableCell>
                        <TableCell className="text-xs">{s.parent_phone}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setCardStudent(s)}>
                            <IdCard className="h-3.5 w-3.5 mr-1" /> Kartu
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredStudents.length > 100 && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    Menampilkan 100 dari {filteredStudents.length} siswa
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="classes">
            {classes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Tidak ada data kelas</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {classes.map((c) => (
                  <div key={c.name} className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="font-bold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.studentCount} siswa</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <Dialog open={!!cardStudent} onOpenChange={(o) => !o && setCardStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" /> Kartu Pelajar
            </DialogTitle>
          </DialogHeader>
          {cardStudent && (
            <StudentIdCard
              student={{
                id: cardStudent.id,
                name: cardStudent.name,
                class: cardStudent.class,
                student_id: cardStudent.student_id,
                photo_url: cardStudent.photo_url,
                gender: cardStudent.gender,
                school_id: school.id,
                schools: { name: school.name, logo: school.logo },
                ...(cardStudent.card_number ? { card_number: cardStudent.card_number } : {}),
                ...(cardStudent.qr_code ? { qr_code: cardStudent.qr_code } : {}),
              } as any}
            />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default SchoolDetailDialog;
