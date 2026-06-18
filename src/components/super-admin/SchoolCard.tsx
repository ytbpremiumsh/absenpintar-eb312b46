import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { School, Users, Eye, CreditCard, Pencil, Mail, Phone } from "lucide-react";
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
  getStatusBadge: (status: string) => React.ReactNode;
}

const SchoolCard = ({ school, index, onDetail, onSubscription, onEdit, getStatusBadge }: SchoolCardProps) => {
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
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">
                  <Users className="h-3 w-3 mr-0.5" />{school.studentCount} siswa
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {school.classCount} kelas
                </Badge>
                {school.subscription ? (
                  <>
                    <Badge className="bg-success/10 text-success border-success/20 text-[10px]">{school.subscription.plan_name}</Badge>
                    {getStatusBadge(school.subscription.status)}
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Belum berlangganan</Badge>
                )}
              </div>
              {/* Admin Contact Info */}
              {(school.adminEmail || school.adminPhone) && (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {school.adminEmail && (
                    <a href={`mailto:${school.adminEmail}`} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                      <Mail className="h-3 w-3" />{school.adminEmail}
                    </a>
                  )}
                  {school.adminPhone && (
                    <a href={`https://wa.me/${school.adminPhone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                      <Phone className="h-3 w-3" />{school.adminPhone}
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Detail" onClick={() => onDetail(school)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ubah Langganan" onClick={() => onSubscription(school)}>
                <CreditCard className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => onEdit(school)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SchoolCard;
