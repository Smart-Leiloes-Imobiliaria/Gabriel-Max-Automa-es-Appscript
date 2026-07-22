import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Crown, ShieldAlert } from "lucide-react";
import UsersManager from "@/components/admin/UsersManager";

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
};

export default function Admin() {
  const { role } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<AuditRow[]>([]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("id, actor_email, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data ?? []) as AuditRow[]);
  };

  useEffect(() => { if (role === "admin") loadLogs(); }, [role]);

  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <AppHeader />
        <main className="container py-12 grid place-items-center">
          <Card className="p-8 max-w-md text-center">
            <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
            <h1 className="text-xl font-bold">Acesso restrito</h1>
            <p className="text-muted-foreground text-sm mt-2">Esta área é exclusiva para administradores.</p>
          </Card>
        </main>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-admin", {
      body: { email, password, full_name: fullName },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Falha ao criar administrador.");
    }
    toast.success("Novo administrador criado com sucesso.");
    setEmail(""); setPassword(""); setFullName("");
    loadLogs();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Administração</h1>
            <p className="text-sm text-muted-foreground">Gerencie administradores e audite ações sensíveis.</p>
          </div>
        </div>

        <UsersManager />

        <Card className="p-6 max-w-xl">
          <h2 className="font-semibold mb-4">Criar novo administrador</h2>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Nome completo</Label><Input className="mt-1.5" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input className="mt-1.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Senha</Label><Input className="mt-1.5" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={busy} className="bg-gradient-hero shadow-glow">
              {busy ? "Criando..." : "Criar administrador"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Auditoria recente</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-muted/40">
                  <tr><th className="text-left p-2">Quando</th><th className="text-left p-2">Autor</th><th className="text-left p-2">Ação</th><th className="text-left p-2">Alvo</th><th className="text-left p-2">Detalhes</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="p-2">{l.actor_email ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{l.action}</td>
                      <td className="p-2 text-xs">{l.target_type}{l.target_id ? `:${l.target_id.slice(0, 8)}` : ""}</td>
                      <td className="p-2 text-xs text-muted-foreground max-w-xs truncate">{l.details ? JSON.stringify(l.details) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
