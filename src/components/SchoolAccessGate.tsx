import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertOctagon, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
}

/**
 * Blocks the app UI when the current user's school has been suspended
 * by a Super Admin. Super Admin themselves are never blocked.
 */
export function SchoolAccessGate({ children }: Props) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [suspended, setSuspended] = useState<{ reason: string | null } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (roles.includes("super_admin")) { setChecked(true); return; }
      if (!profile?.school_id) { setChecked(true); return; }
      const { data } = await supabase
        .from("schools")
        .select("is_suspended, suspended_reason")
        .eq("id", profile.school_id)
        .maybeSingle();
      if (!alive) return;
      if (data?.is_suspended) setSuspended({ reason: data.suspended_reason ?? null });
      else setSuspended(null);
      setChecked(true);
    };
    run();
    return () => { alive = false; };
  }, [profile?.school_id, roles]);

  if (!checked) return <>{children}</>;
  if (!suspended) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-5 border rounded-2xl p-8 shadow-elevated bg-card">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertOctagon className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Akses Sekolah Ditangguhkan</h1>
          <p className="text-sm text-muted-foreground">
            Dashboard sekolah Anda saat ini sedang ditangguhkan oleh administrator.
            Silakan hubungi tim support untuk informasi lebih lanjut.
          </p>
          {suspended.reason && (
            <p className="text-xs text-foreground bg-muted rounded-lg p-3 text-left">
              <span className="font-semibold">Alasan: </span>{suspended.reason}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => { await signOut(); navigate("/admin"); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Keluar
        </Button>
      </div>
    </div>
  );
}
