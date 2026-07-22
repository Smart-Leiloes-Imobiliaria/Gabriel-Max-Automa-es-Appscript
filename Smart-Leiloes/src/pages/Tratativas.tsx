import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/NumericInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAZIL_STATES, getAllAgencies, resolveAgenciesByState } from "@/lib/agencies";
import { nextProtocol, logNotification, type DemandStatus, type SignatureType } from "@/lib/db";
type AttachedFile = { name: string; type: string; dataUrl: string };
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";

const DEMAND_STATUSES: DemandStatus[] = [
  "Validação da minuta dentro do prazo de 2 dias",
  "Validação da minuta não realizada dentro do prazo de 2 dias, com escalonamento em 1 dia",
  "Validação da minuta não realizada em nenhum momento, com escalonamento para o setor responsável pelo parceiro",
  "Assinatura do contrato",
];

export default function Tratativas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agencies = useMemo(() => getAllAgencies(), []);
  const [state, setState] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [notaryOffice, setNotaryOffice] = useState("");
  const [propertyCode, setPropertyCode] = useState("");
  const [propertyRegistration, setPropertyRegistration] = useState("");
  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<DemandStatus | "">("");
  const [signatureType, setSignatureType] = useState<SignatureType | "">("");
  const [observations, setObservations] = useState("");
  
  const [minuteFile, setMinuteFile] = useState<AttachedFile | null>(null);
  const [contractFile, setContractFile] = useState<AttachedFile | null>(null);

  const isMinuteStatus = status && status !== "Assinatura do contrato";
  const isContractStatus = status === "Assinatura do contrato";

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setMinuteFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setMinuteFile({ name: f.name, type: f.type, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(f);
  };

  const onContractFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setContractFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setContractFile({ name: f.name, type: f.type, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(f);
  };

  const onStateChange = (uf: string) => {
    setState(uf);
    const list = resolveAgenciesByState(uf);
    // Só pré-seleciona quando há exatamente uma agência cobrindo o estado.
    if (list.length === 1) setAgencyId(list[0].id);
    else setAgencyId("");
  };

  const submit = async () => {
    const missing: string[] = [];
    if (!agencyId) missing.push("Agência responsável");
    if (!notaryOffice) missing.push("Cartório responsável");
    if (!propertyCode) missing.push("Código do imóvel");
    if (!propertyRegistration) missing.push("Matrícula do imóvel");
    if (!clientName) missing.push("Nome do cliente");
    if (!date) missing.push("Data de envio da minuta");
    if (!status) missing.push("Status da demanda");
    if (missing.length) {
      toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}`);
      return;
    }
    if (status === "Assinatura do contrato" && !signatureType) {
      toast.error("Selecione o tipo de assinatura para continuar.");
      return;
    }
    if (isMinuteStatus && !minuteFile) {
      toast.error("Anexe a minuta para continuar.");
      return;
    }
    if (isContractStatus && !contractFile) {
      toast.error("Anexe o contrato para continuar.");
      return;
    }
    const agency = agencies.find((a) => a.id === agencyId);
    if (!agency) return;
    let protocol: string;
    try { protocol = await nextProtocol("TRT"); }
    catch (e: any) { toast.error(`Erro ao gerar protocolo: ${e.message}`); return; }

    // Upload da minuta
    let minuteFilePath: string | null = null;
    let minuteFileName: string | null = null;
    if (isMinuteStatus && minuteFile && user?.id) {
      try {
        const res = await fetch(minuteFile.dataUrl);
        const blob = await res.blob();
        const safeName = minuteFile.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${protocol}-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("minutas")
          .upload(path, blob, { contentType: minuteFile.type, upsert: false });
        if (upErr) { toast.error(`Erro ao enviar minuta: ${upErr.message}`); return; }
        minuteFilePath = path;
        minuteFileName = minuteFile.name;
      } catch (e: any) { toast.error(`Erro ao processar minuta: ${e.message}`); return; }
    }

    // Upload do contrato
    let contractFilePath: string | null = null;
    let contractFileName: string | null = null;
    if (isContractStatus && contractFile && user?.id) {
      try {
        const res = await fetch(contractFile.dataUrl);
        const blob = await res.blob();
        const safeName = contractFile.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${protocol}-contrato-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("minutas")
          .upload(path, blob, { contentType: contractFile.type, upsert: false });
        if (upErr) { toast.error(`Erro ao enviar contrato: ${upErr.message}`); return; }
        contractFilePath = path;
        contractFileName = contractFile.name;
      } catch (e: any) { toast.error(`Erro ao processar contrato: ${e.message}`); return; }
    }

    const { data: inserted, error: dbError } = await supabase
      .from("property_treatments")
      .insert({
        protocol,
        uf: state || agency.id.slice(0, 2).toUpperCase(),
        property_code: propertyCode,
        property_registration: propertyRegistration,
        notary_office_name: notaryOffice,
        client_name: clientName,
        minute_sent_at: date,
        demand_status: status as string,
        agency_id: agency.id,
        agency_name: agency.name,
        owner_id: user?.id ?? null,
        observations,
        signature_type: status === "Assinatura do contrato" ? (signatureType as string) : null,
        e_notariado_link: null,
        minute_status: status === "Assinatura do contrato" ? "Validada" : "Pendente de validação",
        minute_file_path: minuteFilePath,
        minute_file_name: minuteFileName,
        contract_file_path: contractFilePath,
        contract_file_name: contractFileName,
      } as any)
      .select("id")
      .single();
    if (dbError) { toast.error(`Erro ao salvar no banco: ${dbError.message}`); return; }

    await logNotification({
      relatedType: "treatment",
      relatedId: inserted!.id,
      agencyId: agency.id,
      message: `${status === "Assinatura do contrato" ? "Assinatura do contrato" : "Atualização de contrato"}\nAgência: ${agency.name}\nCódigo: ${propertyCode}\nCliente: ${clientName}\nData envio/cobrança: ${date}\nStatus: ${status}\nObservações: ${observations || "—"}\nProtocolo: ${protocol}`,
    });

    // Dispara e-mail à gerente quando for validação de minuta
    if (isMinuteStatus) {
      try {
        const { data: emailRes, error: emailErr } = await supabase.functions.invoke(
          "enviar-minuta-validacao",
          {
            body: { protocol },
          }
        );
        if (emailErr || !emailRes?.success) {
          console.error("Falha no envio do email:", emailErr ?? emailRes);
          toast.warning("Contrato salvo, mas houve falha ao enviar o e-mail à gerente.");
        } else {
          toast.success("E-mail com a minuta enviado para validação.");
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Dispara e-mail à gerente quando for assinatura do contrato
    if (isContractStatus) {
      try {
        const { data: emailRes, error: emailErr } = await supabase.functions.invoke(
          "enviar-contrato-assinatura",
          {
            body: { protocol },
          }
        );
        if (emailErr || !emailRes?.success) {
          console.error("Falha no envio do email de contrato:", emailErr ?? emailRes);
          toast.warning("Contrato salvo, mas houve falha ao enviar o e-mail do contrato.");
        } else {
          toast.success("E-mail com o contrato enviado para a gerente.");
        }
      } catch (e) {
        console.error(e);
      }
    }

    toast.success("Contrato registrado com sucesso.");
    navigate("/painel");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><FileText className="w-7 h-7 text-primary" /> Contrato de imóvel</h1>
        <p className="text-muted-foreground mb-6">Registre validação de minuta, cobrança ao gerente ou assinatura de contrato.</p>

        <Card className="p-6 md:p-8 shadow-card space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Estado do imóvel (opcional)</Label>
              <Select value={state} onValueChange={onStateChange}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione (sugere agência)" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {BRAZIL_STATES.map((s) => <SelectItem key={s.uf} value={s.uf}>{s.uf} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agência responsável *</Label>
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione a agência" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cartório responsável pelo agendamento *</Label>
              <Input className="mt-1.5" value={notaryOffice} onChange={(e) => setNotaryOffice(e.target.value)} placeholder="Ex.: 1º Tabelionato de Notas" />
            </div>
            <div>
              <Label>Código do imóvel *</Label>
              <NumericInput className="mt-1.5" value={propertyCode} onChange={setPropertyCode} />
            </div>
            <div>
              <Label>Matrícula do imóvel *</Label>
              <NumericInput className="mt-1.5" value={propertyRegistration} onChange={setPropertyRegistration} />
            </div>
            <div>
              <Label>Nome do cliente *</Label>
              <Input className="mt-1.5" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <Label>Data envio da minuta / cobrança *</Label>
              <Input className="mt-1.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Status da demanda *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DemandStatus)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                <SelectContent>
                  {DEMAND_STATUSES.map((s) => <SelectItem key={s} value={s} className="whitespace-normal">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {status === "Assinatura do contrato" && (
              <div className="md:col-span-2">
                <Label>Tipo de assinatura *</Label>
                <Select value={signatureType} onValueChange={(v) => setSignatureType(v as SignatureType)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o tipo de assinatura" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ICP-Brasil">ICP-Brasil</SelectItem>
                    <SelectItem value="Gov">Gov</SelectItem>
                    <SelectItem value="E-notariado">E-notariado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isMinuteStatus && (
              <div className="md:col-span-2">
                <Label>Anexar minuta *</Label>
                <Input className="mt-1.5" type="file" onChange={onFileChange} />
                <p className="text-xs text-muted-foreground mt-1">Anexe o arquivo da minuta para que a gerente possa baixar e validar.</p>
                {minuteFile && <p className="text-xs text-success mt-1">Arquivo selecionado: {minuteFile.name}</p>}
              </div>
            )}
            {isContractStatus && (
              <div className="md:col-span-2">
                <Label>Anexar contrato *</Label>
                <Input className="mt-1.5" type="file" onChange={onContractFileChange} />
                <p className="text-xs text-muted-foreground mt-1">Anexe o contrato para que a gerente possa baixar e assinar.</p>
                {contractFile && <p className="text-xs text-success mt-1">Arquivo selecionado: {contractFile.name}</p>}
              </div>
            )}
          </div>
          <div>
            <Label>Observações adicionais</Label>
            <Textarea className="mt-1.5" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={submit} className="bg-gradient-hero shadow-glow">
              <Send className="w-4 h-4 mr-1.5" /> Registrar contrato
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
