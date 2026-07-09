import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { School, Users, Eye, CreditCard, Pencil, Ban, PlayCircle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export interface SchoolData {
  id: string;
  name: string;
  address: string | null;
  slug?: string | null;
  npsn: string | null;
  city: string | null;
  province: string | null;
  timezone: string | null;
  logo: string | null;
  created_at: string;
  is_suspended?: boolean;
  suspended_reason?: string | null;
  studentCount?: number;
  classCount?: number;
  adminEmail?: string | null;
  adminPhone?: string | null;
  adminName?: string | null;
  subscription?: {
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    expires_at: string | null;
  } | null;
}

interface SchoolCardProps {
  school: SchoolData;
  index: number;
  onDetail: (s: SchoolData) => void;
  onSubscription: (s: SchoolData) => void;
  onEdit: (s: SchoolData) => void;
  onSuspend: (s: SchoolData) => void;
  onDelete: (s: SchoolData) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

const SchoolCard = ({ school, index, onDetail, onSubscription, onEdit, onSuspend, onDelete, getStatusBadge }: SchoolCardProps) => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Card className="border-0 shadow-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              {school.logo ? (
                <img src={school.logo} alt={school.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <School className="h-6 w-6 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground truncate">{school.name}</h3>
              {school.address && <p className="text-xs text-muted-foreground truncate">{school.address}</p>}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {/* Usage stats grouped in a single pill with divider */}
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-2.5 py-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {school.studentCount ?? 0} siswa
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {school.classCount ?? 0} kelas
                  </span>
                </div>

                {school.subscription ? (
                  <>
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {school.subscription.plan_name}
                    </span>
                    {getStatusBadge(school.subscription.status)}
                  </>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Belum berlangganan
                  </span>
                )}

                {school.is_suspended && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                    <Ban className="h-3 w-3" /> Ditangguhkan
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 flex-wrap justify-end">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Detail" onClick={() => onDetail(school)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ubah Langganan" onClick={() => onSubscription(school)}>
                <CreditCard className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => onEdit(school)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${school.is_suspended ? "text-success hover:text-success" : "text-amber-600 hover:text-amber-700"}`}
                title={school.is_suspended ? "Aktifkan kembali" : "Tangguhkan akses"}
                onClick={() => onSuspend(school)}
              >
                {school.is_suspended ? <PlayCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Hapus sekolah"
                onClick={() => onDelete(school)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SchoolCard;
