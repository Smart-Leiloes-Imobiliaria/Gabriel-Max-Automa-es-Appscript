import { Link, useLocation, useNavigate } from "react-router-dom";
import { Video, LayoutDashboard, FileText, Home, LogOut, Briefcase, ShieldCheck, Crown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getAgencyById } from "@/lib/agencies";
import logoAsset from "@/assets/smart-leiloes-header.png.asset.json";

export function AppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, profile, signOut } = useAuth();

  const nav = [
    { to: "/", label: "Início", icon: Home, roles: ["parceiro", "gerente", "admin", "proprietario"] },
    { to: "/agendar", label: "Agendar", icon: Video, roles: ["parceiro", "gerente"] },
    { to: "/tratativas", label: "Contrato", icon: FileText, roles: ["parceiro", "proprietario"] },
    { to: "/painel", label: "Painel", icon: LayoutDashboard, roles: ["parceiro", "gerente", "admin", "proprietario"] },
    { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin"] },
    { to: "/admin", label: "Admin", icon: Crown, roles: ["admin"] },
  ].filter((n) => !role || n.roles.includes(role));

  const agency = profile?.agency_id ? getAgencyById(profile.agency_id) : null;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[hsl(214,65%,15%)] border-b border-[hsl(214,55%,22%)] shadow-card">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoAsset.url} alt="Smart Leilões" className="h-10 w-auto object-contain" />
          <div className="leading-tight hidden sm:block">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/75">Agendamento & Contrato</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/10 border border-white/15 backdrop-blur">
          {nav.map((n) => {
            const active = pathname === n.to;
            return (
              <Link key={n.to} to={n.to}
                className={cn("flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all",
                  active
                    ? "bg-white text-[hsl(214,65%,18%)] shadow-md"
                    : "text-white/85 hover:text-white hover:bg-white/15")}>
                <n.icon className="w-4 h-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {role && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs">
              {role === "admin" ? <Crown className="w-3.5 h-3.5" /> : role === "gerente" ? <ShieldCheck className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
              <span className="font-medium capitalize">{role}</span>
              {agency && <span className="text-white/75">• {agency.name}</span>}
            </div>
          )}
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
