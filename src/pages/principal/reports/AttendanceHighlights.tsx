import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown } from "lucide-react";

export type HighlightRow = {
  id: string;
  name: string;
  photo?: string | null;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
};

interface Props {
  title: string;
  rows: HighlightRow[];
  loading?: boolean;
}

export function AttendanceHighlights({ title, rows, loading }: Props) {
  if (loading || rows.length === 0) return null;

  const topPresent = [...rows]
    .sort((a, b) => b.hadir - a.hadir)
    .slice(0, 3)
    .filter((r) => r.hadir > 0);
  const topAbsent = [...rows]
    .sort((a, b) => (b.alfa + b.sakit + b.izin) - (a.alfa + a.sakit + a.izin))
    .slice(0, 3)
    .filter((r) => r.alfa + r.sakit + r.izin > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[#5B6CF9]" />
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border border-border/50 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-xs font-semibold">Paling Rajin (Terbanyak Hadir)</p>
            </div>
            {topPresent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada data</p>
            ) : (
              <div className="space-y-1.5">
                {topPresent.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-300 text-orange-900"}`}>{i + 1}</span>
                    <Avatar className="h-6 w-6">
                      {r.photo && <AvatarImage src={r.photo} />}
                      <AvatarFallback className="text-[9px] bg-[#5B6CF9]/10 text-[#5B6CF9]">{r.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-medium truncate flex-1">{r.name}</p>
                    <span className="text-xs font-bold text-emerald-600">{r.hadir}H</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/50 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              <p className="text-xs font-semibold">Perlu Perhatian (Terbanyak Absen)</p>
            </div>
            {topAbsent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Semua hadir penuh</p>
            ) : (
              <div className="space-y-1.5">
                {topAbsent.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-100 text-red-700">{i + 1}</span>
                    <Avatar className="h-6 w-6">
                      {r.photo && <AvatarImage src={r.photo} />}
                      <AvatarFallback className="text-[9px] bg-red-100 text-red-700">{r.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-medium truncate flex-1">{r.name}</p>
                    <span className="text-xs font-bold text-red-600">A:{r.alfa} S:{r.sakit} I:{r.izin}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
