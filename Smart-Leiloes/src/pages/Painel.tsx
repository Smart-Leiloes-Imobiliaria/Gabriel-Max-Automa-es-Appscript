import { Fragment, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  computeDeadline, downloadFromStorage, listSchedules, listTreatments,
  logNotification, updateSchedule, updateTreatment,
  type PropertyTreatment, type VideoConferenceSchedule,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { getAllAgencies } from "@/lib/agencies";
import { DeadlineBadge, ScheduleStatusBadge } from "@/components/StatusBadge";
import { CheckCircle2, XCircle, Search, Inbox, Video, FileText, Clock3, Download, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function Painel() {
  const agencies = useMemo(() => getAllAgencies(), []);
  const { user, role, profile } = useAuth();
  const isManager = role === "gerente";
  const isAdmin = role === "admin";
  const isOwner = role === "proprietario";
  const managerAgencyId = profile?.agency_id ?? null;

  const [agencyId, setAgencyId] = useState<string>(isManager && managerAgencyId ? managerAgencyId : "all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [treatmentStatusFilter, setTreatmentStatusFilter] = useState<string>("all");
  const [refresh, setRefresh] = useState(0);
  const force = () => setRefresh((x) => x + 1);

  const [allSchedules, setAllSchedules] = useState<VideoConferenceSchedule[]>([]);
  const [allTreatments, setAllTreatments] = useState<PropertyTreatment[]>([]);

  useEffect(() => {
    if (isManager && managerAgencyId) setAgencyId(managerAgencyId);
  }, [isManager, managerAgencyId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSchedules(), listTreatments()])
      .then(([s, t]) => { if (!cancelled) { setAllSchedules(s); setAllTreatments(t); } })
      .catch((e) => console.error(e));
    return () => { cancelled = true; };
  }, [refresh]);

  // Recalcula status baseado em tempo a cada 60s e escuta mudanças no banco
  useEffect(() => {
    const interval = setInterval(() => force(), 60_000);
    const channel = supabase
      .channel("painel-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "property_treatments" }, () => force())
      .on("postgres_changes", { event: "*", schema: "public", table: "video_conferences" }, () => force())
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const schedules = useMemo<VideoConferenceSchedule[]>(() => {
    return allSchedules
      .filter((s) => {
        if (isAdmin) return true;
        if (isManager && managerAgencyId) return s.agencyId === managerAgencyId;
        if (!isManager) return s.ownerId === user?.id;
        return true;
      })
      .filter((s) => agencyId === "all" || s.agencyId === agencyId)
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .filter((s) => !search || [s.protocol, s.propertyCode, s.clientName, s.notaryOfficeName, s.partnerResponsibleName, s.state, s.conferenceDate, s.conferenceTime].some((v) => (v ?? "").toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => (a.conferenceDate + a.conferenceTime).localeCompare(b.conferenceDate + b.conferenceTime));
  }, [allSchedules, agencyId, search, statusFilter, isManager, isAdmin, managerAgencyId, user?.id]);

  const treatments = useMemo<PropertyTreatment[]>(() => {
    return allTreatments
      .filter((t) => {
        if (isAdmin) return true;
        if (isManager && managerAgencyId) return t.agencyId === managerAgencyId;
        if (!isManager) return t.ownerId === user?.id;
        return true;
      })
      .filter((t) => agencyId === "all" || t.agencyId === agencyId)
      .filter((t) => treatmentStatusFilter === "all" || t.demandStatus === treatmentStatusFilter)
      .filter((t) => !search || [t.protocol, t.propertyCode, t.clientName].some((v) => v.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allTreatments, agencyId, search, treatmentStatusFilter, isManager, isAdmin, managerAgencyId, user?.id]);

  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [validateMode, setValidateMode] = useState(false);
  const [contractMode, setContractMode] = useState(false);
  const [managerFile, setManagerFile] = useState<File | null>(null);
  const [managerContractFile, setManagerContractFile] = useState<File | null>(null);

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const onManagerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManagerFile(e.target.files?.[0] ?? null);
  };
  const onManagerContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManagerContractFile(e.target.files?.[0] ?? null);
  };

  const notifyPartner = async (treatmentId: string, docType: "minuta" | "contrato") => {
    const { data, error } = await supabase.functions.invoke("enviar-documento-parceiro", {
      body: { treatment_id: treatmentId, doc_type: docType, manager_id: user?.id ?? null },
    });
    if (error || !data?.success) {
      const msg = data?.error || error?.message || "Falha ao enviar e-mail ao parceiro.";
      toast.error(msg);
      return false;
    }
    toast.success(`E-mail enviado ao parceiro (${data.partner_email}).`);
    return true;
  };

  const sendSignedContract = async (t: PropertyTreatment) => {
    if (!managerContractFile || !user?.id) { toast.error("Anexe o contrato assinado para continuar."); return; }
    try {
      const safeName = managerContractFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${t.protocol}-assinado-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("minutas")
        .upload(path, managerContractFile, { contentType: managerContractFile.type, upsert: false });
      if (upErr) { toast.error(`Erro ao enviar contrato assinado: ${upErr.message}`); return; }
      await updateTreatment(t.id, {
        manager_contract_file_path: path,
        manager_contract_file_name: managerContractFile.name,
        manager_contract_uploaded_at: new Date().toISOString(),
      });
      await notifyPartner(t.id, "contrato");
      supabase.functions.invoke("bitrix-enviar-documento-cliente", {
        body: {
          propertyCode: t.propertyCode,
          clientName: t.clientName,
          documentType: "contrato",
          filePath: path,
          fileName: managerContractFile.name,
          related_id: t.id,
          related_type: "treatment_bitrix_doc",
          agency_id: t.agencyId ?? "",
        },
      }).then(({ data, error }) => {
        if (error || !data?.success) {
          const msg = data?.reason || data?.error || error?.message || "Falha ao enviar contrato ao chat do cliente no Bitrix.";
          toast.warning(`Bitrix (contrato): ${msg}`);
        } else {
          toast.success("Contrato enviado ao chat do cliente no Bitrix.");
        }
      });
      supabase.functions.invoke("pipedrive-criar-atividade", {
        body: { propertyCode: t.propertyCode, clientName: t.clientName, trigger: "contrato_assinado" },
      }).then(({ data, error }) => {
        if (error) console.error("Pipedrive (contrato):", error);
        else console.log("Pipedrive (contrato):", data);
      });
      setSelectedId(null); setContractMode(false); setManagerContractFile(null);
      force();
    } catch (e: any) {
      toast.error(`Erro ao enviar contrato assinado: ${e.message}`);
    }
  };

  const removeTreatment = async (t: PropertyTreatment) => {
    if (!confirm(`Remover a tratativa ${t.protocol}? Esta ação não pode ser desfeita.`)) return;
    try {
      // Apaga arquivos do Storage (best-effort)
      const paths = [t.minuteFilePath, t.managerMinuteFilePath, t.contractFilePath, t.managerContractFilePath].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from("minutas").remove(paths);
      await supabase.from("notification_logs").delete().eq("related_type", "treatment").eq("related_id", t.id);
      const { error } = await supabase.from("property_treatments").delete().eq("id", t.id);
      if (error) throw error;
      toast.success("Tratativa removida.");
      force();
    } catch (e: any) {
      toast.error(`Erro ao remover: ${e.message}`);
    }
  };

  const validate = async (t: PropertyTreatment) => {
    if (!managerFile || !user?.id) { toast.error("Anexe a minuta validada para continuar."); return; }
    try {
      const safeName = managerFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${t.protocol}-validada-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("minutas")
        .upload(path, managerFile, { contentType: managerFile.type, upsert: false });
      if (upErr) { toast.error(`Erro ao enviar minuta validada: ${upErr.message}`); return; }
      await updateTreatment(t.id, {
        manager_validated: true,
        manager_validated_at: new Date().toISOString(),
        minute_status: "Validada",
        manager_validation_reason: null,
        manager_minute_file_path: path,
        manager_minute_file_name: managerFile.name,
      });
      await logNotification({
        relatedType: "treatment", relatedId: t.id, agencyId: t.agencyId,
        message: `Minuta validada\nAgência: ${t.agencyName}\nCódigo: ${t.propertyCode}\nCliente: ${t.clientName}\nProtocolo: ${t.protocol}`,
      });
      toast.success("Minuta marcada como Validada.");
      await notifyPartner(t.id, "minuta");
      supabase.functions.invoke("bitrix-enviar-documento-cliente", {
        body: {
          propertyCode: t.propertyCode,
          clientName: t.clientName,
          documentType: "minuta",
          filePath: path,
          fileName: managerFile.name,
          related_id: t.id,
          related_type: "treatment_bitrix_doc",
          agency_id: t.agencyId ?? "",
        },
      }).then(({ data, error }) => {
        if (error || !data?.success) {
          const msg = data?.reason || data?.error || error?.message || "Falha ao enviar minuta ao chat do cliente no Bitrix.";
          toast.warning(`Bitrix (minuta): ${msg}`);
        } else {
          toast.success("Minuta enviada ao chat do cliente no Bitrix.");
        }
      });
      supabase.functions.invoke("pipedrive-criar-atividade", {
        body: { propertyCode: t.propertyCode, clientName: t.clientName, trigger: "minuta_validada" },
      }).then(({ data, error }) => {
        if (error) console.error("Pipedrive (minuta):", error);
        else console.log("Pipedrive (minuta):", data);
      });
      setSelectedId(null); setValidateMode(false); setManagerFile(null);
      force();
    } catch (e: any) {
      toast.error(`Erro ao validar minuta: ${e.message}`);
    }
  };

  const rejectInline = async (t: PropertyTreatment) => {
    if (!reason.trim()) { toast.error("Informe o motivo da não validação."); return; }
    try {
      await updateTreatment(t.id, {
        manager_validated: false,
        manager_validation_reason: reason,
        manager_validated_at: new Date().toISOString(),
        minute_status: "Não validada",
      });
      await logNotification({
        relatedType: "treatment", relatedId: t.id, agencyId: t.agencyId,
        message: `Minuta não validada\nAgência: ${t.agencyName}\nCódigo: ${t.propertyCode}\nCliente: ${t.clientName}\nMotivo: ${reason}\nProtocolo: ${t.protocol}`,
      });
      setSelectedId(null); setRejectMode(false); setReason("");
      toast.success("Minuta marcada como Não validada.");
      force();
    } catch (e: any) {
      toast.error(`Erro ao registrar: ${e.message}`);
    }
  };

  const cancelSchedule = async (s: VideoConferenceSchedule) => {
    if (!cancelReason.trim()) { toast.error("Informe o motivo do cancelamento para continuar."); return; }
    try {
      await updateSchedule(s.id, {
        status: "Cancelada",
        cancel_reason: cancelReason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id ?? null,
      });
      await logNotification({
        relatedType: "schedule", relatedId: s.id, agencyId: s.agencyId,
        message: `Agendamento cancelado\nAgência: ${s.agencyName}\nCliente: ${s.clientName}\nData/Hora: ${s.conferenceDate} ${s.conferenceTime}\nMotivo: ${cancelReason}\nProtocolo: ${s.protocol}`,
      });
      if (user) {
        await supabase.from("admin_audit_logs").insert({
          actor_id: user.id, actor_email: user.email ?? null,
          action: "cancel_schedule", target_type: "schedule", target_id: s.id,
          details: { protocol: s.protocol, reason: cancelReason, by_role: role },
        });
      }
      const { data: emailRes, error: emailErr } = await supabase.functions.invoke(
        "enviar-cancelamento-videoconferencia",
        { body: { protocol: s.protocol, reason: cancelReason, cancelled_by_role: role } }
      );
      if (emailErr || !emailRes?.success) {
        console.error("Falha ao enviar email de cancelamento:", emailErr || emailRes);
        toast.warning("Cancelado, mas o email de aviso falhou.");
      }
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e.message}`);
      return;
    }

    setSelectedScheduleId(null); setCancelReason("");
    toast.success("Agendamento cancelado.");
    force();
  };
  const confirmSchedule = async (s: VideoConferenceSchedule, side: "partner" | "manager") => {
    if (!user?.id) return;
    try {
      const patch: Record<string, any> = side === "partner"
        ? { partner_confirmed_at: new Date().toISOString(), partner_confirmed_by: user.id }
        : { manager_confirmed_at: new Date().toISOString(), manager_confirmed_by: user.id };
      await updateSchedule(s.id, patch);
      toast.success(side === "partner" ? "Confirmação do parceiro registrada." : "Confirmação do gerente registrada.");
      force();
    } catch (e: any) {
      toast.error(`Erro ao confirmar: ${e.message}`);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{isAdmin ? "Painel administrativo" : isManager ? "Painel da Agência" : isOwner ? "Meus contratos" : "Meus agendamentos e contratos"}</h1>
            <p className="text-muted-foreground">
              {isAdmin ? "Visão global de todos os agendamentos e contratos." : isManager ? "Visualize tudo da sua agência e valide as minutas." : isOwner ? "Acompanhe seus contratos cadastrados." : "Apenas seus próprios cadastros são exibidos."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar protocolo, cliente, código..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {!isManager && !isOwner && (
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as agências</SelectItem>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {isAdmin && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Videoconferência agendada">Agendada</SelectItem>
                  <SelectItem value="Aguardando confirmação">Aguardando confirmação</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                  <SelectItem value="Reagendamento solicitado">Reagendamento solicitado</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                  <SelectItem value="Realizada">Realizada</SelectItem>
                  <SelectItem value="Não compareceu">Não compareceu</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <Tabs defaultValue={isOwner ? "treatments" : "schedules"}>
          <TabsList>
            {!isOwner && <TabsTrigger value="schedules"><Video className="w-4 h-4 mr-1.5" />Videoconferências ({schedules.length})</TabsTrigger>}
            <TabsTrigger value="treatments"><FileText className="w-4 h-4 mr-1.5" />Contratos ({treatments.length})</TabsTrigger>
          </TabsList>

          {!isOwner && <TabsContent value="schedules" className="mt-4">
            <Card className="overflow-visible">
              {schedules.length === 0 ? (
                <Empty title="Nenhuma videoconferência" text="Os agendamentos aparecerão aqui assim que forem criados." />
              ) : (
                <div className="w-full">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground sticky top-16 z-20 shadow-sm">
                      <tr><Th>Protocolo</Th><Th>Data/Hora</Th><Th>Agência</Th><Th>Cartório</Th><Th>Parceiro</Th><Th>Cliente</Th><Th>Imóvel</Th><Th>Tipo de reunião</Th><Th>Link</Th><Th>Status</Th><Th>Confirmação</Th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {schedules.map((s) => {
                        const expandedS = selectedScheduleId === s.id;
                        const canCancel = s.status !== "Cancelada" && s.status !== "Realizada" && s.status !== "Concluída";
                        return (
                          <Fragment key={s.id}>
                            <tr
                              className={cn("align-top", canCancel && "cursor-pointer hover:bg-muted/30", expandedS && "bg-muted/40")}
                              onClick={() => { if (canCancel) { setSelectedScheduleId(expandedS ? null : s.id); setCancelReason(""); } }}
                            >
                              <Td className="font-mono text-xs">{s.protocol}</Td>
                              <Td>{s.conferenceDate} <span className="text-muted-foreground">{s.conferenceTime}</span></Td>
                              <Td>{s.agencyName}</Td>
                              <Td>{s.notaryOfficeName}</Td>
                              <Td>{s.partnerResponsibleName}</Td>
                              <Td>{s.clientName}</Td>
                              <Td className="font-mono text-xs">{s.propertyCode}</Td>
                              <Td>
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                  s.meetingType && s.meetingType !== "Meet"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-foreground"
                                )}>
                                  {s.meetingType ?? "Meet"}
                                </span>
                              </Td>
                              <Td onClick={(e) => e.stopPropagation()}>
                                {s.meetLink ? (
                                  <a
                                    href={s.meetLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline text-xs break-all"
                                  >
                                    {`Abrir ${s.meetingType ?? "Meet"}`}
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </Td>
                              <Td>
                                <ScheduleStatusBadge status={s.status} />
                                {s.status === "Cancelada" && s.cancelReason && (
                                  <div className="text-xs text-destructive font-medium mt-1">Motivo: {s.cancelReason}</div>
                                )}
                                {s.clientPresent ? (
                                  <div className="mt-1.5 text-xs space-y-0.5">
                                    <div>
                                      <span className="text-muted-foreground">WhatsApp: </span>
                                      <span className={s.clientWhatsappStatus === "Erro ao enviar" ? "text-destructive font-medium" : s.clientWhatsappStatus === "Enviado com sucesso" ? "text-success font-medium" : ""}>
                                        {s.clientWhatsappStatus ?? "Aguardando envio"}
                                      </span>
                                      {s.clientWhatsappError && <div className="text-destructive">{s.clientWhatsappError}</div>}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">E-mail: </span>
                                      <span className={s.clientEmailStatus === "Erro ao enviar" ? "text-destructive font-medium" : s.clientEmailStatus === "Enviado com sucesso" ? "text-success font-medium" : ""}>
                                        {s.clientEmailStatus ?? "Aguardando envio"}
                                      </span>
                                      {s.clientEmailError && <div className="text-destructive">{s.clientEmailError}</div>}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-1.5 text-xs text-muted-foreground">Sem cliente presente</div>
                                )}
                              </Td>
                              <Td>
                                {s.status === "Cancelada" ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="space-y-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn("w-2 h-2 rounded-full", s.partnerConfirmedAt ? "bg-success" : "bg-muted-foreground/40")} />
                                      <span className="text-muted-foreground">Parceiro:</span>
                                      <span className={s.partnerConfirmedAt ? "text-success font-medium" : "text-muted-foreground"}>
                                        {s.partnerConfirmedAt ? "Confirmado" : "Pendente"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn("w-2 h-2 rounded-full", s.managerConfirmedAt ? "bg-success" : "bg-muted-foreground/40")} />
                                      <span className="text-muted-foreground">Gerente:</span>
                                      <span className={s.managerConfirmedAt ? "text-success font-medium" : "text-muted-foreground"}>
                                        {s.managerConfirmedAt ? "Confirmado" : "Pendente"}
                                      </span>
                                    </div>
                                    {!isManager && !isAdmin && s.ownerId === user?.id && !s.partnerConfirmedAt && (
                                      <Button size="sm" variant="outline" className="h-7 mt-1 text-success border-success/30 hover:bg-success/10"
                                        onClick={() => confirmSchedule(s, "partner")}>
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Confirmar realização
                                      </Button>
                                    )}
                                    {isManager && managerAgencyId === s.agencyId && !s.managerConfirmedAt && (
                                      <Button size="sm" variant="outline" className="h-7 mt-1 text-success border-success/30 hover:bg-success/10"
                                        onClick={() => confirmSchedule(s, "manager")}>
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Confirmar realização
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </Td>
                            </tr>
                            {expandedS && canCancel && (
                              <tr className="bg-muted/20">
                                <td colSpan={11} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Motivo do cancelamento *</Label>
                                    <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Informe o motivo do cancelamento..." />
                                    <div className="flex gap-2 justify-end">
                                      <Button size="sm" variant="ghost" onClick={() => { setSelectedScheduleId(null); setCancelReason(""); }}>Voltar</Button>
                                      <Button size="sm" disabled={!cancelReason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => cancelSchedule(s)}>
                                        <XCircle className="w-3.5 h-3.5 mr-1" />Cancelar agendamento
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>}

          <TabsContent value="treatments" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 justify-end">
              <Select value={treatmentStatusFilter} onValueChange={setTreatmentStatusFilter}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Status do contrato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Validação da minuta dentro do prazo de 2 dias">Minuta no prazo</SelectItem>
                  <SelectItem value="Validação da minuta não realizada dentro do prazo de 2 dias, com escalonamento em 1 dia">Minuta escalonada (1 dia)</SelectItem>
                  <SelectItem value="Validação da minuta não realizada em nenhum momento, com escalonamento para o setor responsável pelo parceiro">Minuta escalonada ao setor</SelectItem>
                  <SelectItem value="Assinatura do contrato">Assinatura do contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="overflow-visible">
              {treatments.length === 0 ? (
                <Empty title="Nenhum contrato" text="Registre contratos para acompanhar minutas e assinaturas." />
              ) : (
                <div className="w-full">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground sticky top-16 z-20 shadow-sm">
                      <tr>
                        <Th>Protocolo</Th><Th>Imóvel</Th><Th>Cliente</Th><Th>Agência</Th><Th>Envio</Th><Th>Prazo</Th><Th>Minuta</Th><Th>Assinatura</Th><Th>Detalhes</Th>
                        <Th className="text-right">Ações</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {treatments.map((t) => {
                        const dl = computeDeadline(t);
                        const expanded = isManager && selectedId === t.id;
                        const isContract = t.demandStatus === "Assinatura do contrato";
                         const canAct = isContract
                           ? !t.managerContractFilePath
                           : (t.minuteStatus !== "Validada" && t.minuteStatus !== "Não validada" && !t.managerMinuteFilePath);
                        return (
                          <Fragment key={t.id}>
                            <tr
                              className={cn("align-top", isManager && canAct && "cursor-pointer hover:bg-muted/30", expanded && "bg-muted/40")}
                              onClick={() => { if (isManager && canAct) { setSelectedId(expanded ? null : t.id); setRejectMode(false); setValidateMode(false); setContractMode(false); setReason(""); setManagerFile(null); setManagerContractFile(null); } }}
                            >
                              <Td className="font-mono text-xs">{t.protocol}</Td>
                              <Td className="font-mono text-xs">{t.propertyCode}</Td>
                              <Td>{t.clientName}</Td>
                              <Td>{t.agencyName}</Td>
                              <Td>{t.minuteSentOrChargedAt}</Td>
                              <Td><DeadlineBadge status={dl} /></Td>
                              <Td><MinuteBadge status={t.minuteStatus ?? "Pendente de validação"} /></Td>
                              <Td><span className="text-xs">{t.signatureType ?? "—"}</span></Td>
                              <Td className="max-w-[280px]">
                                <div className="text-xs text-muted-foreground line-clamp-2">{t.demandStatus}</div>
                                {t.managerValidated === false && t.managerValidationReason && (
                                  <div className="text-xs text-destructive font-medium mt-1">Motivo: {t.managerValidationReason}</div>
                                )}
                                {t.minuteFilePath && (
                                  <button type="button"
                                    onClick={(e) => { e.stopPropagation(); downloadFromStorage(t.minuteFilePath!, t.minuteFileName ?? "minuta"); }}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                                    <Paperclip className="w-3 h-3" />Minuta do parceiro <Download className="w-3 h-3" />
                                  </button>
                                )}
                                {t.managerMinuteFilePath && (
                                  <button type="button"
                                    onClick={(e) => { e.stopPropagation(); downloadFromStorage(t.managerMinuteFilePath!, t.managerMinuteFileName ?? "minuta-validada"); }}
                                    className="inline-flex items-center gap-1 text-xs text-success hover:underline mt-1 ml-2">
                                    <Paperclip className="w-3 h-3" />Minuta validada <Download className="w-3 h-3" />
                                  </button>
                                )}
                                {t.contractFilePath && (
                                  <button type="button"
                                    onClick={(e) => { e.stopPropagation(); downloadFromStorage(t.contractFilePath!, t.contractFileName ?? "contrato"); }}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1 ml-2">
                                    <Paperclip className="w-3 h-3" />Contrato <Download className="w-3 h-3" />
                                  </button>
                                )}
                                {t.managerContractFilePath && (
                                  <button type="button"
                                    onClick={(e) => { e.stopPropagation(); downloadFromStorage(t.managerContractFilePath!, t.managerContractFileName ?? "contrato-assinado"); }}
                                    className="inline-flex items-center gap-1 text-xs text-success hover:underline mt-1 ml-2">
                                    <Paperclip className="w-3 h-3" />Contrato assinado <Download className="w-3 h-3" />
                                  </button>
                                )}
                              </Td>
                              <Td className="text-right text-xs">
                                <div className="flex items-center justify-end gap-2">
                                  {isManager && (
                                    canAct ? (
                                      <span className="text-primary font-medium">{expanded ? "▲ Fechar" : (isContract ? "Anexar contrato assinado" : "Clique para validar")}</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )
                                  )}
                                  {(isAdmin || (!isManager && t.ownerId === user?.id)) && (
                                    <button
                                      type="button"
                                      title="Remover tratativa"
                                      onClick={(e) => { e.stopPropagation(); removeTreatment(t); }}
                                      className="inline-flex items-center gap-1 text-destructive hover:underline"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Remover
                                    </button>
                                  )}
                                </div>
                              </Td>
                            </tr>
                            {expanded && canAct && (
                              <tr className="bg-muted/20">
                               <td colSpan={10} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  {isContract ? (
                                    <div className="space-y-2">
                                      <Label className="text-xs">Anexar contrato assinado *</Label>
                                      <Input type="file" onChange={onManagerContractFileChange} />
                                      <p className="text-xs text-muted-foreground">Ao enviar, o parceiro responsável receberá o contrato por e-mail.</p>
                                      {managerContractFile && <p className="text-xs text-success">Arquivo selecionado: {managerContractFile.name}</p>}
                                      <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedId(null); setManagerContractFile(null); }}>Cancelar</Button>
                                        <Button size="sm" disabled={!managerContractFile} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => sendSignedContract(t)}>
                                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Enviar contrato assinado
                                        </Button>
                                      </div>
                                    </div>
                                  ) : !rejectMode && !validateMode ? (
                                    <div className="flex gap-2 justify-end">
                                      <Button size="sm" variant="outline" className="h-8 text-success border-success/30 hover:bg-success/10" onClick={() => setValidateMode(true)}>
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Validar minuta
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setRejectMode(true)}>
                                        <XCircle className="w-3.5 h-3.5 mr-1" />Não validar
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedId(null)}>Cancelar</Button>
                                    </div>
                                  ) : validateMode ? (
                                    <div className="space-y-2">
                                      <Label className="text-xs">Anexar minuta validada *</Label>
                                      <Input type="file" onChange={onManagerFileChange} />
                                      <p className="text-xs text-muted-foreground">Ao concluir, o parceiro receberá a minuta validada por e-mail.</p>
                                      {managerFile && <p className="text-xs text-success">Arquivo selecionado: {managerFile.name}</p>}
                                      <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => { setValidateMode(false); setManagerFile(null); }}>Voltar</Button>
                                        <Button size="sm" disabled={!managerFile} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => validate(t)}>
                                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Concluir validação
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label className="text-xs">Motivo da não validação *</Label>
                                      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." />
                                      <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => { setRejectMode(false); setReason(""); }}>Voltar</Button>
                                        <Button size="sm" disabled={!reason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { rejectInline(t); }}>
                                          Registrar resposta
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const Th = ({ children, className = "" }: any) => <th className={`text-left font-semibold px-4 py-3 ${className}`}>{children}</th>;
const Td = ({ children, className = "" }: any) => <td className={`px-4 py-3 ${className}`}>{children}</td>;

function MinuteBadge({ status }: { status: string }) {
  const tone =
    status === "Validada" ? "bg-success/10 text-success border-success/20"
    : status === "Não validada" ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-warning/10 text-warning border-warning/30";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", tone)}>
      <Clock3 className="w-3 h-3" />{status}
    </span>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
        <Inbox className="w-7 h-7 text-muted-foreground" />
      </div>
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{text}</div>
    </div>
  );
}
