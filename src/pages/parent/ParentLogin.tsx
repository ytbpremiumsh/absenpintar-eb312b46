import { Navigate } from "react-router-dom";

// Parent login lives at /login (school/guru moved to /admin).
export default function ParentLogin() {
  return <Navigate to="/login" replace />;
}
