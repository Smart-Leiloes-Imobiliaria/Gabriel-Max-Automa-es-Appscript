import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getAllAgencies } from "@/lib/agencies";
import { BarChart3, FileSignature, FileCheck2, Video, Users, Trophy, Medal, Award, Crown, Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";

type ManagerRow = {
  id: string;
  name: string;
  agencyId: string | null;
  agencyName: string;
  contratos: number;
  minutas: number;
  videos: number;
  pendentesMinutas: number;
  pendentesContratos: number;
  pendentesVideos: number;
  pendentes: number;
};

type Treatment = {
  id: string; agency_id: string | null; created_at: string;
  manager_validated: boolean | null; manager_validated_at: string | null;
  manager_contract_file_path: string | null; manager_contract_uploaded_at: string | null;
  signature_type: string | null;
};
type VC = {
  id: string; agency_id: string | null; manager_confirmed_by: string | null;
  manager_confirmed_at: string | null; completed_at: string | null; status: string;
};
type ProfileRow = { id: string; full_name: string; agency_id: string | null };

const PERIODS = [
  { id: "7", label: "Últimos 7 dias" },
  { id: "30", label: "Últimos 30 dias" },
  { id: "90", label: "Últimos 90 dias" },
  { id: "all", label: "Todo o período" },
];

export default function AdminDashboard() {
  const { role } = useAuth();
  const agencies = useMemo(() => getAllAgencies(), []);
  const [period, setPeriod] = useState<string>("30");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [metric, setMetric] = useState<string>("all");

  const [managers, setManagers] = useState<ProfileRow[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [videos, setVideos] = useState<VC[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gerente");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, full_name, agency_id").in("id", ids)
      : { data: [] as any[] };
    const { data: trs } = await supabase
      .from("property_treatments")
      .select("id, agency_id, created_at, manager_validated, manager_validated_at, manager_contract_file_path, manager_contract_uploaded_at, signature_type");
    const { data: vcs } = await supabase
      .from("video_conferences")
      .select("id, agency_id, manager_confirmed_by, manager_confirmed_at, completed_at, status");
    setManagers((profs ?? []) as ProfileRow[]);
    setTreatments((trs ?? []) as Treatment[]);
    setVideos((vcs ?? []) as VC[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "property_treatments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "video_conferences" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const sinceDate = useMemo(() => {
    if (period === "all") return null;
    const d = new Date(); d.setDate(d.getDate() - Number(period));
    return d;
  }, [period]);

  const within = (iso?: string | null) => {
    if (!sinceDate) return true;
    if (!iso) return false;
    return new Date(iso) >= sinceDate;
  };

  const agencyName = (id: string | null) => agencies.find((a) => a.id === id)?.name ?? "—";

  const rows = useMemo<ManagerRow[]>(() => {
    return managers
      .filter((m) => managerFilter === "all" || m.id === managerFilter)
      .filter((m) => agencyFilter === "all" || m.agency_id === agencyFilter)
      .map((m) => {
        const agencyTrs = treatments.filter((t) => t.agency_id === m.agency_id);
        const contratos = agencyTrs.filter((t) => t.manager_contract_file_path && within(t.manager_contract_uploaded_at)).length;
        const minutas = agencyTrs.filter((t) => t.manager_validated === true && within(t.manager_validated_at)).length;
        const myVideos = videos.filter((v) => v.manager_confirmed_by === m.id && v.status === "Concluída" && within(v.completed_at));
        const pendentesMinutas = agencyTrs.filter((t) => t.manager_validated !== true && within(t.created_at)).length;
        const pendentesContratos = agencyTrs.filter((t) => t.manager_validated === true && !t.manager_contract_file_path && within(t.manager_validated_at)).length;
        const agencyVcs = videos.filter((v) => v.agency_id === m.agency_id);
        const pendentesVideos = agencyVcs.filter((v) => v.status !== "Concluída" && v.status !== "Cancelada").length;
        const pendentes = pendentesMinutas + pendentesContratos + pendentesVideos;
        return {
          id: m.id,
          name: m.full_name || "Sem nome",
          agencyId: m.agency_id,
          agencyName: agencyName(m.agency_id),
          contratos, minutas, videos: myVideos.length,
          pendentesMinutas, pendentesContratos, pendentesVideos, pendentes,
        };
      });
  }, [managers, treatments, videos, managerFilter, agencyFilter, sinceDate]);

  const totals = useMemo(() => {
    const visibleAgencies = new Set(rows.map((r) => r.agencyId).filter(Boolean) as string[]);
    const inScope = (aid: string | null) => !!aid && visibleAgencies.has(aid);
    const trs = treatments.filter((t) => inScope(t.agency_id));
    const vcs = videos.filter((v) => inScope(v.agency_id));
    const contratos = trs.filter((t) => t.manager_contract_file_path && within(t.manager_contract_uploaded_at)).length;
    const minutas = trs.filter((t) => t.manager_validated === true && within(t.manager_validated_at)).length;
    const vids = vcs.filter((v) => v.status === "Concluída" && within(v.completed_at)).length;
    const pendentesMinutas = trs.filter((t) => t.manager_validated !== true && within(t.created_at)).length;
    const pendentesContratos = trs.filter((t) => t.manager_validated === true && !t.manager_contract_file_path && within(t.manager_validated_at)).length;
    const pendentesVideos = vcs.filter((v) => v.status !== "Concluída" && v.status !== "Cancelada").length;
    return {
      contratos, minutas, videos: vids,
      pendentesMinutas, pendentesContratos, pendentesVideos,
      pendentes: pendentesMinutas + pendentesContratos + pendentesVideos,
      gerentes: rows.length,
    };
  }, [rows, treatments, videos, sinceDate]);

  // Evolução por período (últimos N dias agrupados por dia)
  const evolution = useMemo(() => {
    const days = period === "all" ? 30 : Number(period);
    const out: { date: string; label: string; contratos: number; minutas: number; videos: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), contratos: 0, minutas: 0, videos: 0 });
    }
    const mgrIds = new Set(rows.map((r) => r.id));
    const mgrAgencies = new Set(rows.map((r) => r.agencyId).filter(Boolean) as string[]);
    treatments.forEach((t) => {
      if (!t.agency_id || !mgrAgencies.has(t.agency_id)) return;
      if (t.manager_contract_file_path && t.manager_contract_uploaded_at) {
        const k = t.manager_contract_uploaded_at.slice(0, 10);
        const row = out.find((r) => r.date === k);
        if (row) row.contratos += 1;
      }
      if (t.manager_validated && t.manager_validated_at) {
        const k = t.manager_validated_at.slice(0, 10);
        const row = out.find((r) => r.date === k);
        if (row) row.minutas += 1;
      }
    });
    videos.forEach((v) => {
      if (!v.manager_confirmed_by || !mgrIds.has(v.manager_confirmed_by)) return;
      if (v.status !== "Concluída" || !v.completed_at) return;
      const k = v.completed_at.slice(0, 10);
      const row = out.find((r) => r.date === k);
      if (row) row.videos += 1;
    });
    return out;
  }, [treatments, videos, rows, period]);

  const compareData = useMemo(
    () => [...rows].sort((a, b) => (b.contratos + b.minutas + b.videos) - (a.contratos + a.minutas + a.videos)).slice(0, 10),
    [rows]
  );

  const rkContratos = useMemo(() => [...rows].sort((a, b) => b.contratos - a.contratos).slice(0, 10), [rows]);
  const rkMinutas = useMemo(() => [...rows].sort((a, b) => b.minutas - a.minutas).slice(0, 10), [rows]);
  const rkVideos = useMemo(() => [...rows].sort((a, b) => b.videos - a.videos).slice(0, 10), [rows]);
  const rkPendentes = useMemo(() => [...rows].sort((a, b) => b.pendentes - a.pendentes).slice(0, 10), [rows]);

  const showAll = metric === "all";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
              <p className="text-sm text-muted-foreground">Desempenho dos gerentes em tempo real.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</Button>
        </div>

        {/* Filtros */}
        <Card className="p-4 shadow-card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Gerente</label>
              <Select value={managerFilter} onValueChange={setManagerFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os gerentes</SelectItem>
                  {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Agência</label>
              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as agências</SelectItem>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Etapa</label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="contratos">Contratos assinados</SelectItem>
                  <SelectItem value="minutas">Minutas validadas</SelectItem>
                  <SelectItem value="videos">Videoconferências</SelectItem>
                  <SelectItem value="pendentes">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(showAll || metric === "contratos") && (
            <KpiCard icon={FileSignature} label="Contratos assinados" value={totals.contratos} tone="primary" />
          )}
          {(showAll || metric === "minutas") && (
            <KpiCard icon={FileCheck2} label="Minutas validadas" value={totals.minutas} tone="success" />
          )}
          {(showAll || metric === "videos") && (
            <KpiCard icon={Video} label="Videoconferências realizadas" value={totals.videos} tone="info" />
          )}
          {(showAll || metric === "pendentes") && (
            <KpiCard icon={Clock} label="Pendentes (total)" value={totals.pendentes} tone="warning" />
          )}
          {metric === "pendentes" && (
            <>
              <KpiCard icon={FileCheck2} label="Minutas pendentes" value={totals.pendentesMinutas} tone="warning" />
              <KpiCard icon={FileSignature} label="Contratos pendentes" value={totals.pendentesContratos} tone="warning" />
              <KpiCard icon={Video} label="Videoconferências pendentes" value={totals.pendentesVideos} tone="warning" />
            </>
          )}
          {showAll && (
            <KpiCard icon={Users} label="Gerentes ativos" value={totals.gerentes} tone="muted" />
          )}
        </div>

        {/* Gráfico principal: evolução */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Evolução por período</h2>
              <p className="text-xs text-muted-foreground">Atividade diária dos gerentes filtrados.</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(showAll || metric === "contratos") && <Line type="monotone" dataKey="contratos" name="Contratos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />}
                {(showAll || metric === "minutas") && <Line type="monotone" dataKey="minutas" name="Minutas" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />}
                {(showAll || metric === "videos") && <Line type="monotone" dataKey="videos" name="Videoconferências" stroke="hsl(var(--info))" strokeWidth={2} dot={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Comparativo geral entre gerentes */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Comparativo entre gerentes (Top 10)</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} height={50} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(showAll || metric === "contratos") && <Bar dataKey="contratos" name="Contratos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />}
                {(showAll || metric === "minutas") && <Bar dataKey="minutas" name="Minutas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />}
                {(showAll || metric === "videos") && <Bar dataKey="videos" name="Vídeos" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />}
                {metric === "pendentes" && <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(showAll || metric === "contratos") && (
            <RankingCard title="Contratos assinados" icon={FileSignature} data={rkContratos} valueKey="contratos" />
          )}
          {(showAll || metric === "minutas") && (
            <RankingCard title="Minutas validadas" icon={FileCheck2} data={rkMinutas} valueKey="minutas" />
          )}
          {(showAll || metric === "videos") && (
            <RankingCard title="Videoconferências" icon={Video} data={rkVideos} valueKey="videos" />
          )}
          {metric === "pendentes" && (
            <RankingCard title="Pendentes (total)" icon={Clock} data={rkPendentes} valueKey="pendentes" />
          )}
        </div>

        {/* Tabela detalhada */}
        <Card className="overflow-hidden shadow-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Detalhamento por gerente</h2>
            <p className="text-xs text-muted-foreground">Indicadores filtrados pelo período selecionado.</p>
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum gerente encontrado com os filtros atuais.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Gerente</th>
                    <th className="text-left px-4 py-3">Agência</th>
                    <th className="text-right px-4 py-3">Contratos</th>
                    <th className="text-right px-4 py-3">Minutas</th>
                    <th className="text-right px-4 py-3">Vídeos</th>
                    <th className="text-right px-4 py-3">Pendentes</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.agencyName}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.contratos}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.minutas}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.videos}</td>
                      <td className="px-4 py-3 text-right font-mono text-warning">{r.pendentes}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{r.contratos + r.minutas + r.videos}</td>
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

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "primary" | "success" | "info" | "muted" | "warning" }) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", toneMap[tone])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function RankingCard({ title, icon: Icon, data, valueKey }: { title: string; icon: any; data: ManagerRow[]; valueKey: keyof ManagerRow }) {
  const podiumIcon = (pos: number) =>
    pos === 0 ? <Crown className="w-4 h-4 text-warning" />
    : pos === 1 ? <Medal className="w-4 h-4 text-muted-foreground" />
    : pos === 2 ? <Award className="w-4 h-4 text-escalated" />
    : null;
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-warning" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <ol className="space-y-2">
          {data.map((r, i) => (
            <li key={r.id} className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg border",
              i === 0 ? "bg-warning/5 border-warning/30"
              : i === 1 ? "bg-muted/40 border-border"
              : i === 2 ? "bg-escalated/5 border-escalated/20"
              : "border-transparent"
            )}>
              <div className="w-6 text-center font-bold text-muted-foreground">{i + 1}º</div>
              {podiumIcon(i)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.agencyName}</div>
              </div>
              <div className="font-mono font-semibold">{r[valueKey] as number}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
