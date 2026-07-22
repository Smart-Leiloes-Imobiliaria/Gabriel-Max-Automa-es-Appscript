import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { getScheduleByProtocol, type VideoConferenceSchedule } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { ScheduleStatusBadge } from "@/components/StatusBadge";

export default function Confirmacao() {
  const { protocol } = useParams();
  const [item, setItem] = useState<VideoConferenceSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!protocol) { setLoading(false); return; }
    let cancelled = false;
    getScheduleByProtocol(protocol)
      .then((s) => { if (!cancelled) { setItem(s); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [protocol]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <AppHeader />
        <main className="container py-12 text-center text-muted-foreground">Carregando...</main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <AppHeader />
        <main className="container py-12 text-center">
          <p className="text-muted-foreground">Agendamento não encontrado.</p>
          <Link to="/"><Button className="mt-4">Voltar ao início</Button></Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-12 max-w-2xl">
        <Card className="p-8 shadow-elevated text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-9 h-9 text-success" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Agendamento confirmado</h1>
          <p className="text-muted-foreground mb-6">Sua videoconferência foi registrada e a agência responsável foi notificada.</p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-mono text-sm mb-6">
            {item.protocol}
            <button onClick={() => { navigator.clipboard.writeText(item.protocol); toast.success("Protocolo copiado"); }} className="hover:text-primary">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-left rounded-xl border border-border divide-y divide-border">
            <Row label="Status"><ScheduleStatusBadge status={item.status} /></Row>
            <Row label="Agência responsável">{item.agencyName}</Row>
            <Row label="Estado do imóvel">{item.state}</Row>
            <Row label="Cartório">{item.notaryOfficeName}</Row>
            <Row label="Parceiro responsável">{item.partnerResponsibleName}</Row>
            <Row label="Cliente">{item.clientName}</Row>
            <Row label="Código do imóvel">{item.propertyCode}</Row>
            <Row label="Data e horário">{item.conferenceDate} às {item.conferenceTime}</Row>
            <Row label="Cliente presente na reunião">{item.clientPresent ? "Sim" : "Não"}</Row>
            {item.clientPresent && (
              <>
                <Row label="Telefone do cliente">{item.clientPhone ?? "—"}</Row>
                <Row label="E-mail do cliente">{item.clientEmail ?? "—"}</Row>
              </>
            )}
          </div>

          <div className="text-left rounded-xl border border-border divide-y divide-border mt-4">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">Status de envio ao cliente</div>
            {item.clientPresent ? (
              <>
                <Row label="Telefone/WhatsApp">
                  <span className={item.clientWhatsappStatus === "Erro ao enviar" ? "text-destructive" : item.clientWhatsappStatus === "Enviado com sucesso" ? "text-success" : ""}>
                    {item.clientWhatsappStatus ?? "Aguardando envio"}
                  </span>
                  {item.clientWhatsappError && <div className="text-xs text-destructive mt-0.5">{item.clientWhatsappError}</div>}
                </Row>
                <Row label="E-mail">
                  <span className={item.clientEmailStatus === "Erro ao enviar" ? "text-destructive" : item.clientEmailStatus === "Enviado com sucesso" ? "text-success" : ""}>
                    {item.clientEmailStatus ?? "Aguardando envio"}
                  </span>
                  {item.clientEmailError && <div className="text-xs text-destructive mt-0.5">{item.clientEmailError}</div>}
                </Row>
              </>
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">Não se aplica, pois a reunião não terá cliente presente.</div>
            )}
          </div>


          <div className="flex gap-3 justify-center mt-7">
            <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1.5" /> Início</Button></Link>
            <Link to="/painel"><Button>Ir ao painel</Button></Link>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{children}</span>
    </div>
  );
}
