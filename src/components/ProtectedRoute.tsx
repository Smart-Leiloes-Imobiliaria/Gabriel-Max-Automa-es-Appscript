import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "@/lib/auth";

export function ProtectedRoute({ children, allow }: { children: ReactNode; allow?: Role[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (allow && role && !allow.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
