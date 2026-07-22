import { Link } from "react-router-dom";
import { Video, FileText, ArrowRight, Shield, Clock, Bell, LayoutDashboard } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";

export default function Index() {
  const { role } = useAuth();
  const isManager = role === "gerente";
  const isOwner = role === "proprietario";
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-12 md:py-20">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold mb-5">
            <Shield className="w-3.5 h-3.5" /> {isManager ? "Painel do gerente" : isOwner ? "Área do proprietário" : "Plataforma operacional Smart Leilões"}
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-5 leading-[1.05]">
            {isManager ? <>Acompanhe e valide<br /></> : isOwner ? <>Gerencie seus<br /></> : <>Centralize videoconferências e<br /></>}
            <span className="bg-gradient-hero bg-clip-text [-webkit-text-fill-color:transparent] [color:transparent]">
              {isManager ? "as minutas da sua agência" : isOwner ? "contratos de imóveis" : "contratos de imóveis"}
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isManager
              ? "Visualize agendamentos e contratos da sua agência e responda à validação das minutas."
              : isOwner
              ? "Registre e acompanhe seus contratos de imóveis com rastreabilidade total."
              : "Agende videoconferências entre cartórios e agências sem duplicidade, e acompanhe minutas, cobranças e assinaturas com rastreabilidade total."}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {isManager ? (
            <>
              <FlowCard to="/painel" icon={LayoutDashboard} title="Painel da agência" description="Veja agendamentos e contratos, e valide minutas dos parceiros." cta="Abrir painel" tone="primary" />
              <FlowCard to="/agendar" icon={Video} title="Novo agendamento" description="Crie uma videoconferência diretamente como gerente da agência." cta="Agendar agora" tone="info" />
            </>
          ) : isOwner ? (
            <>
              <FlowCard to="/tratativas" icon={FileText} title="Registrar contrato de imóvel" description="Acompanhe validação de minuta, cobrança ao gerente e assinatura de contrato." cta="Registrar contrato" tone="primary" />
              <FlowCard to="/painel" icon={LayoutDashboard} title="Meus contratos" description="Acompanhe seus contratos em um único painel." cta="Abrir painel" tone="info" />
            </>
          ) : (
            <>
              <FlowCard to="/agendar" icon={Video} title="Agendar videoconferência" description="Solicite uma videoconferência entre cartório e agência responsável pelo estado do imóvel." cta="Iniciar agendamento" tone="primary" />
              <FlowCard to="/tratativas" icon={FileText} title="Registrar contrato de imóvel" description="Acompanhe validação de minuta, cobrança ao gerente e assinatura de contrato." cta="Registrar contrato" tone="info" />
            </>
          )}
        </div>

        {!isOwner && (
        <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-12">
          <Feature icon={Clock} title="Sem duplicidade" text="Horários ocupados ficam indisponíveis automaticamente." />
          <Feature icon={Shield} title="Direcionamento correto" text="Estado do imóvel define a agência responsável." />
          <Feature icon={Bell} title="Notificações" text="Cada evento gera um log de auditoria e notifica os responsáveis envolvidos." />
        </div>
        )}
      </main>
    </div>
  );
}

function FlowCard({ to, icon: Icon, title, description, cta, tone }: any) {
  return (
    <Link to={to}
      className="group relative block p-7 bg-card rounded-2xl ring-1 ring-border/70 shadow-card hover:shadow-elevated hover:ring-primary/30 transition-all hover:-translate-y-1 duration-300">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${tone === "primary" ? "bg-gradient-hero shadow-glow" : "bg-info/10 ring-1 ring-info/20"}`}>
        <Icon className={`w-6 h-6 ${tone === "primary" ? "text-primary-foreground" : "text-info"}`} />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 leading-relaxed">{description}</p>
      <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm">
        {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

function Feature({ icon: Icon, title, text }: any) {
  return (
    <div className="p-5 rounded-xl bg-card ring-1 ring-border/70 shadow-sm hover:shadow-card transition-shadow">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <div className="font-semibold text-foreground mb-1">{title}</div>
      <div className="text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
