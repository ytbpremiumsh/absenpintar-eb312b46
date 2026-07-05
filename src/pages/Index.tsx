import { Navigate } from "react-router-dom";
import { parseSubdomain } from "@/lib/tenant";

const Index = () => {
  // Jika diakses via subdomain sekolah, arahkan langsung ke portal wali murid.
  const slug = typeof window !== "undefined" ? parseSubdomain() : null;
  if (slug) return <Navigate to="/login" replace />;
  return <Navigate to="/admin" replace />;
};

export default Index;
