import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { getAllAgencies, getAgencyById, BRAZIL_STATES } from "@/lib/agencies";
import { toast } from "sonner";
import { Users, Pencil, Trash2, Plus, Search } from "lucide-react";

type Role = "parceiro" | "gerente" | "admin" | "proprietario";

type ManagedUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  full_name: string;
  role: Role | null;
  agency_id: string | null;
  notary_office_name: string | null;
  uf: string | null;
  is_active: boolean;
};

const ROLE_LABEL: Record<Role, string> = { parceiro: "Parceiro", gerente: "Gerente", admin: "Administrador", proprietario: "Proprietário" };

export default function UsersManager() {
  const agencies = getAllAgencies();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterAgency, setFilterAgency] = useState<string>("all");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "list" } });
    setLoading(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Erro ao carregar usuários.");
    setUsers((data as any).users ?? []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (filterAgency !== "all" && u.agency_id !== filterAgency) return false;
      if (filterUf !== "all" && u.uf !== filterUf) return false;
      if (filterStatus !== "all" && String(u.is_active) !== filterStatus) return false;
      if (q) {
        const blob = [u.full_name, u.email, u.phone, u.notary_office_name, u.uf, u.role && ROLE_LABEL[u.role]].filter(Boolean).join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, filterRole, filterAgency, filterUf, filterStatus]);

  const toggleActive = async (u: ManagedUser) => {
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "set_active", user_id: u.id, is_active: !u.is_active },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Erro.");
    toast.success(!u.is_active ? "Usuário ativado." : "Usuário desativado.");
    load();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: deleteTarget.id },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Erro.");
    toast.success("Usuário excluído.");
    setDeleteTarget(null);
    load();
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Usuários cadastrados</h2>
            <p className="text-sm text-muted-foreground">{users.length} usuário(s) no total</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gradient-hero shadow-glow"><Plus className="w-4 h-4 mr-1" /> Novo usuário</Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, e-mail, cartório..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="gerente">Gerente</SelectItem>
            <SelectItem value="parceiro">Parceiro</SelectItem>
            <SelectItem value="proprietario">Proprietário</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAgency} onValueChange={setFilterAgency}>
          <SelectTrigger><SelectValue placeholder="Agência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as agências</SelectItem>
            {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUf} onValueChange={setFilterUf}>
          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as UF</SelectItem>
            {BRAZIL_STATES.map((s) => <SelectItem key={s.uf} value={s.uf}>{s.uf}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando usuários...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">E-mail</th>
                <th className="text-left p-2">Telefone</th>
                <th className="text-left p-2">Perfil</th>
                <th className="text-left p-2">Agência / Cartório</th>
                <th className="text-left p-2">UF</th>
                <th className="text-left p-2">Cadastro</th>
                <th className="text-left p-2">Último acesso</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => {
                const ag = u.agency_id ? getAgencyById(u.agency_id) : null;
                const fmtPhone = (p?: string | null) => {
                  if (!p) return "—";
                  const m = p.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
                  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : p;
                };
                return (
                  <tr key={u.id} className={!u.is_active ? "opacity-60" : ""}>
                    <td className="p-2 font-medium">{u.full_name || "—"}</td>
                    <td className="p-2">
                      <div className="flex flex-col">
                        <span>{u.email ?? "—"}</span>
                        {!u.email_confirmed_at && <span className="text-[10px] text-muted-foreground">não confirmado</span>}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs">{fmtPhone(u.phone)}</td>
                    <td className="p-2">
                      {u.role ? (
                        <Badge variant={u.role === "admin" ? "default" : u.role === "gerente" ? "secondary" : "outline"}>
                          {ROLE_LABEL[u.role]}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-2 text-xs">
                      {u.role === "gerente" ? (ag?.name ?? u.agency_id ?? "—") : (u.notary_office_name || "—")}
                    </td>
                    <td className="p-2">{u.uf || "—"}</td>
                    <td className="p-2 whitespace-nowrap text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-2 whitespace-nowrap text-xs">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} />
                        <span className="text-xs">{u.is_active ? "Ativo" : "Inativo"}</span>
                      </div>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(u)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {editing && <UserForm user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {creating && <UserForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O usuário {deleteTarget?.full_name} ({deleteTarget?.email}) perderá o acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function UserForm({ user, onClose, onSaved }: { user?: ManagedUser; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!user;
  const agencies = getAllAgencies();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>((user?.role as Role) ?? "parceiro");
  const [agencyId, setAgencyId] = useState(user?.agency_id ?? "");
  const [notaryOfficeName, setNotaryOfficeName] = useState(user?.notary_office_name ?? "");
  const [uf, setUf] = useState(user?.uf ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "gerente" && !agencyId) return toast.error("Selecione a agência.");
    if (role === "parceiro" && (!notaryOfficeName || !uf)) return toast.error("Preencha cartório e UF.");
    if (!isEdit && !password) return toast.error("Defina uma senha.");
    if (phone && !/^55\d{10,11}$/.test(phone)) return toast.error("Telefone deve estar no formato 55 + DDD + número (só dígitos).");
    setBusy(true);
    const body: any = isEdit
      ? { action: "update", user_id: user!.id, full_name: fullName, email, role, phone, agency_id: role === "gerente" ? agencyId : null, notary_office_name: role === "parceiro" ? notaryOfficeName : null, uf: role === "parceiro" ? uf : null }
      : { action: "create", full_name: fullName, email, password, role, phone, agency_id: agencyId, notary_office_name: notaryOfficeName, uf };
    if (isEdit && password) body.password = password;
    const { data, error } = await supabase.functions.invoke("manage-users", { body });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Erro.");
    toast.success(isEdit ? "Usuário atualizado." : "Usuário criado.");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Nome completo</Label><Input className="mt-1.5" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input className="mt-1.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {role !== "proprietario" && (
          <div>
            <Label>Telefone (WhatsApp)</Label>
            <Input
              className="mt-1.5"
              inputMode="numeric"
              placeholder="55 + DDD + número (ex: 5511999998888)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Somente dígitos, começando com 55.</p>
          </div>
          )}
          <div>
            <Label>{isEdit ? "Nova senha (opcional)" : "Senha"}</Label>
            <Input className="mt-1.5" type="password" minLength={6} required={!isEdit} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? "Deixe em branco para manter" : ""} />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parceiro">Parceiro</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="proprietario">Proprietário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "gerente" && (
            <div>
              <Label>Agência</Label>
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {role === "parceiro" && (
            <>
              <div><Label>Nome do cartório</Label><Input className="mt-1.5" value={notaryOfficeName} onChange={(e) => setNotaryOfficeName(e.target.value)} /></div>
              <div>
                <Label>UF de atuação</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BRAZIL_STATES.map((s) => <SelectItem key={s.uf} value={s.uf}>{s.uf} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={busy} className="bg-gradient-hero shadow-glow">{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
