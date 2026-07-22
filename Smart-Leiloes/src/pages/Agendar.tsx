import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { BRAZIL_STATES, getAgencyById, resolveAgenciesByState, isAgencyWorkingDay } from "@/lib/agencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/NumericInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { CheckCircle2, ChevronLeft, ChevronRight, Building2, MapPin, Calendar, Clock, User, FileDigit } from "lucide-react";
import { nextProtocol, getAvailableSlots, getDailyCapacity, isSlotTaken, logNotification } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth";

type Form = {
  state: string;
  agencyId: string;
  notaryOfficeName: string;
  partnerResponsibleName: string;
  conferenceDate: string;
  conferenceTime: string;
  clientName: string;
  clientCpf: string;
  propertyCode: string;
  propertyRegistration: string;
  clientPresent: "" | "sim" | "nao";
  clientPhone: string;
  clientEmail: string;
  meetingType: "Meet" | "E-notariado" | "GOV" | "Adobe" | "";
  eNotariadoLink: string;
};

const STEPS = ["Estado", "Agência", "Dados", "Data e horário", "Revisão"];

const PHONE_RE = /^55\s?\d{2}\s?9?\d{4}-?\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ERR = "Informe um número válido com código do país 55, DDD e telefone completo. Exemplo: 55 11 99999-9999.";
const EMAIL_ERR = "Informe um e-mail válido para o cliente.";


export default function Agendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    state: "", agencyId: "", notaryOfficeName: "", partnerResponsibleName: "",
    conferenceDate: "", conferenceTime: "", clientName: "", clientCpf: "",
    propertyCode: "", propertyRegistration: "",
    clientPresent: "", clientPhone: "", clientEmail: "",
    meetingType: "", eNotariadoLink: "",
  });


  const availableAgencies = useMemo(
    () => (form.state ? resolveAgenciesByState(form.state) : []),
    [form.state]
  );
  const agency = useMemo(
    () => (form.agencyId ? getAgencyById(form.agencyId) : null),
    [form.agencyId]
  );
  const [baseSlots, setBaseSlots] = useState<string[]>([]);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [capacity, setCapacity] = useState<{ total: number; used: number; remaining: number; limited: boolean; isWorkingDay: boolean } | null>(null);

  useEffect(() => {
    if (!agency || !form.conferenceDate) {
      setBaseSlots([]); setBookedTimes([]); setCapacity(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [slots, booked, cap] = await Promise.all([
        getAvailableSlots(agency.id, form.conferenceDate),
        supabase
          .from("video_conferences")
          .select("conference_time")
          .eq("agency_id", agency.id)
          .eq("conference_date", form.conferenceDate)
          .neq("status", "Cancelada")
          .then((r) => (r.data ?? []).map((x: any) => x.conference_time as string)),
        getDailyCapacity(agency.id, form.conferenceDate),
      ]);
      if (cancelled) return;
      setBaseSlots(slots);
      setBookedTimes(booked);
      setCapacity(cap);
    })();
    return () => { cancelled = true; };
  }, [agency, form.conferenceDate]);

  const availableSlots = useMemo(
    () => baseSlots.filter((s) => !bookedTimes.includes(s)),
    [baseSlots, bookedTimes]
  );

  const dayNames = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const workingDaysLabel = (a: typeof agency) => a ? a.workingDays.map(d => dayNames[d]).join(" e ") : "";

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(12,0,0,0); return d;
  });

  type DayCap = { iso: string; date: Date; capacity: { total: number; used: number; remaining: number; limited: boolean; isWorkingDay: boolean } };
  const [availableDates, setAvailableDates] = useState<DayCap[]>([]);

  useEffect(() => {
    if (!agency) { setAvailableDates([]); return; }
    let cancelled = false;
    (async () => {
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();
      const last = new Date(year, month + 1, 0).getDate();
      const today = new Date(); today.setHours(0,0,0,0);
      const candidates: { iso: string; date: Date }[] = [];
      for (let day = 1; day <= last; day++) {
        const d = new Date(year, month, day, 12, 0, 0);
        if (d < today) continue;
        if (!isAgencyWorkingDay(agency, d)) continue;
        const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        candidates.push({ iso, date: d });
      }
      const caps = await Promise.all(candidates.map((c) => getDailyCapacity(agency.id, c.iso)));
      if (cancelled) return;
      setAvailableDates(candidates.map((c, i) => ({ ...c, capacity: caps[i] })));
    })();
    return () => { cancelled = true; };
  }, [agency, monthCursor]);

  const todayISO = new Date().toISOString().slice(0, 10);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onStateChange = (uf: string) => {
    const list = resolveAgenciesByState(uf);
    setForm((f) => ({
      ...f,
      state: uf,
      // Se só há uma agência possível, seleciona automaticamente.
      agencyId: list.length === 1 ? list[0].id : "",
    }));
  };

  const canNext = () => {
    if (step === 0) return !!form.state && availableAgencies.length > 0;
    if (step === 1) return !!form.agencyId;
    if (step === 2) {
      const base = !!form.notaryOfficeName && !!form.partnerResponsibleName && !!form.clientName && !!form.clientCpf && !!form.propertyCode && !!form.propertyRegistration && !!form.clientPresent && !!form.meetingType;
      if (!base) return false;
      if (form.meetingType !== "Meet" && !form.eNotariadoLink.trim()) return false;
      if (form.clientPresent === "sim") {
        return PHONE_RE.test(form.clientPhone.trim()) && EMAIL_RE.test(form.clientEmail.trim());
      }
      return true;
    }
    if (step === 3) return !!form.conferenceDate && !!form.conferenceTime;
    return true;
  };


  const handleConfirm = async () => {
    if (!agency) return;
    const missing: string[] = [];
    if (!form.state) missing.push("Estado do imóvel");
    if (!form.notaryOfficeName) missing.push("Cartório");
    if (!form.partnerResponsibleName) missing.push("Parceiro responsável");
    if (!form.conferenceDate) missing.push("Data");
    if (!form.conferenceTime) missing.push("Horário");
    if (!form.clientName) missing.push("Nome do cliente");
    if (!form.clientCpf) missing.push("CPF do cliente");
    if (!form.propertyCode) missing.push("Código do imóvel");
    if (!form.propertyRegistration) missing.push("Matrícula do imóvel");
    if (!form.clientPresent) missing.push("Cliente presente na reunião");
    if (!form.meetingType) missing.push("Tipo de reunião");
    if (form.meetingType && form.meetingType !== "Meet" && !form.eNotariadoLink.trim()) missing.push(`Link da reunião ${form.meetingType}`);
    if (missing.length) {
      toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}`);
      return;
    }
    if (form.clientPresent === "sim") {
      if (!PHONE_RE.test(form.clientPhone.trim())) { toast.error(PHONE_ERR); return; }
      if (!EMAIL_RE.test(form.clientEmail.trim())) { toast.error(EMAIL_ERR); return; }
    }
    if (await isSlotTaken(agency.id, form.conferenceDate, form.conferenceTime)) {
      toast.error("Este horário já foi reservado. Selecione outro horário.");
      setStep(3);
      return;
    }
    let protocol: string;
    try {
      protocol = await nextProtocol("AGD");
    } catch (e: any) {
      toast.error(`Erro ao gerar protocolo: ${e.message}`);
      return;
    }

    const clientPresent = form.clientPresent === "sim";

    // Persiste no banco de dados (Lovable Cloud) — evita duplicidade via índice único
    const { data: inserted, error: dbError } = await supabase
      .from("video_conferences")
      .insert({
        protocol,
        property_state: form.state,
        agency_id: agency.id,
        agency_name: agency.name,
        notary_office_name: form.notaryOfficeName,
        partner_responsible_name: form.partnerResponsibleName,
        conference_date: form.conferenceDate,
        conference_time: form.conferenceTime,
        client_name: form.clientName,
        client_cpf: form.clientCpf,
        property_code: form.propertyCode,
        property_registration: form.propertyRegistration,
        status: "Videoconferência agendada",
        owner_id: user?.id ?? null,
        client_present: clientPresent,
        client_phone: clientPresent ? form.clientPhone.trim() : null,
        client_email: clientPresent ? form.clientEmail.trim() : null,
        client_whatsapp_status: clientPresent ? "Aguardando envio" : null,
        client_email_status: clientPresent ? "Aguardando envio" : null,
        meeting_type: form.meetingType,
        meet_link: form.meetingType !== "Meet" ? form.eNotariadoLink.trim() : null,
      })
      .select("id")
      .single();

    if (dbError) {
      if (dbError.code === "23505") {
        toast.error("Este horário já foi reservado. Selecione outro horário.");
        setStep(3);
      } else {
        toast.error(`Erro ao salvar no banco: ${dbError.message}`);
      }
      return;
    }

    await logNotification({
      relatedType: "schedule",
      relatedId: inserted!.id,
      agencyId: agency.id,
      message: `Nova videoconferência agendada\nAgência: ${agency.name}\nUF: ${form.state}\nCódigo: ${form.propertyCode}\nMatrícula: ${form.propertyRegistration}\nCliente: ${form.clientName}\nCPF: ${form.clientCpf}\nCartório: ${form.notaryOfficeName}\nParceiro: ${form.partnerResponsibleName}\nData: ${form.conferenceDate} ${form.conferenceTime}\nProtocolo: ${protocol}`,
    });

    // Cria reunião no Google Meet e envia email para a agência e o parceiro.
    try {
      const { data: meetData, error: meetErr } = await supabase.functions.invoke(
        "criar-reuniao-agendamento",
        { body: { protocol } }
      );
      if (meetErr) {
        console.error("Erro ao criar reunião:", meetErr);
        toast.warning("Agendamento salvo, mas houve erro ao criar a reunião do Meet. Verifique os logs.");
      } else if (meetData?.meet_link) {
        toast.success("Agendamento confirmado e reunião do Meet criada.");
      } else {
        toast.success("Agendamento confirmado.");
      }
    } catch (e: any) {
      console.error(e);
      toast.warning("Agendamento salvo, mas falhou ao criar a reunião automática.");
    }

    navigate(`/confirmacao/${protocol}`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Agendar videoconferência</h1>
        <p className="text-muted-foreground mb-6">Preencha as informações em etapas. O sistema impede duplicidade de horários.</p>

        <Stepper step={step} />

        <Card className="p-6 md:p-8 mt-6 shadow-card">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Estado do imóvel</h2>
              <div>
                <Label>UF *</Label>
                <Select value={form.state} onValueChange={onStateChange}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {BRAZIL_STATES.map((s) => (
                      <SelectItem key={s.uf} value={s.uf}>{s.uf} — {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.state && availableAgencies.length > 0 && (
                <div className="p-4 rounded-xl bg-accent border border-primary/20 flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {availableAgencies.length === 1
                        ? "Agência responsável pela videoconferência:"
                        : `${availableAgencies.length} agências atendem este estado — você escolherá na próxima etapa:`}
                    </div>
                    <div className="font-semibold text-foreground">
                      {availableAgencies.map((a) => a.name).join(" • ")}
                    </div>
                  </div>
                </div>
              )}
              {form.state && availableAgencies.length === 0 && (
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
                  Não foi encontrada agência responsável para o estado selecionado.
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Agência responsável</h2>
              {availableAgencies.length === 1 ? (
                <div className="p-4 rounded-xl bg-accent border border-primary/20">
                  <div className="text-sm text-muted-foreground">Apenas uma agência atende {form.state}:</div>
                  <div className="font-semibold text-foreground mt-0.5">{availableAgencies[0].name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Código: {availableAgencies[0].code}{availableAgencies[0].managerName ? ` • Gerente: ${availableAgencies[0].managerName}` : ""}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Atendimento: {workingDaysLabel(availableAgencies[0])} • {availableAgencies[0].startTime} às {availableAgencies[0].endTime}
                    {availableAgencies[0].dailyLimit ? ` • Limite: ${availableAgencies[0].dailyLimit}/dia` : " • Sem limite diário"}
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {availableAgencies.map((a) => (
                    <button
                      key={a.id} type="button" onClick={() => set("agencyId", a.id)}
                      className={cn(
                        "text-left p-4 rounded-xl border transition-all",
                        form.agencyId === a.id
                          ? "border-primary bg-accent shadow-glow"
                          : "border-border bg-card hover:border-primary"
                      )}
                    >
                      <div className="font-semibold text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">Código oficial: {a.code}{a.managerName ? ` • Gerente: ${a.managerName}` : ""}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {workingDaysLabel(a)} • {a.startTime}–{a.endTime}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.dailyLimit ? `Limite: ${a.dailyLimit} agendamentos/dia` : "Sem limite diário"} • Intervalo: {a.slotIntervalMinutes} min
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Dados do cartório, parceiro e imóvel</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Nome do cartório *"><Input value={form.notaryOfficeName} onChange={(e) => set("notaryOfficeName", e.target.value)} /></Field>
                <Field label="Parceiro responsável *"><Input value={form.partnerResponsibleName} onChange={(e) => set("partnerResponsibleName", e.target.value)} /></Field>
                <Field label="Nome do cliente *"><Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} /></Field>
                <Field label="CPF do cliente *"><NumericInput value={form.clientCpf} onChange={(v) => set("clientCpf", v)} placeholder="00000000000" maxLength={11} /></Field>
                <Field label="Código do imóvel *"><NumericInput value={form.propertyCode} onChange={(v) => set("propertyCode", v)} /></Field>
                <Field label="Matrícula do imóvel *"><NumericInput value={form.propertyRegistration} onChange={(v) => set("propertyRegistration", v)} /></Field>
                <Field label="A reunião terá o cliente presente? *">
                  <Select value={form.clientPresent} onValueChange={(v) => set("clientPresent", v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {form.clientPresent === "sim" && (
                <div className="grid md:grid-cols-2 gap-4 p-4 rounded-lg border border-primary/20 bg-accent/30">
                  <Field label="Telefone do cliente *">
                    <Input
                      value={form.clientPhone}
                      onChange={(e) => set("clientPhone", e.target.value)}
                      placeholder="55 11 99999-9999"
                      aria-invalid={!!form.clientPhone && !PHONE_RE.test(form.clientPhone.trim())}
                    />
                    {!!form.clientPhone && !PHONE_RE.test(form.clientPhone.trim()) && (
                      <p className="text-xs text-destructive mt-1">{PHONE_ERR}</p>
                    )}
                  </Field>
                  <Field label="E-mail do cliente *">
                    <Input
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) => set("clientEmail", e.target.value)}
                      placeholder="cliente@email.com"
                      aria-invalid={!!form.clientEmail && !EMAIL_RE.test(form.clientEmail.trim())}
                    />
                    {!!form.clientEmail && !EMAIL_RE.test(form.clientEmail.trim()) && (
                      <p className="text-xs text-destructive mt-1">{EMAIL_ERR}</p>
                    )}
                  </Field>
                </div>
              )}

              <div className="pt-2 border-t border-border space-y-4">
                <Field label="Tipo de reunião *">
                  <Select value={form.meetingType} onValueChange={(v) => set("meetingType", v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo de reunião" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meet">Meet</SelectItem>
                      <SelectItem value="E-notariado">E-notariado</SelectItem>
                      <SelectItem value="GOV">GOV</SelectItem>
                      <SelectItem value="Adobe">Adobe</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.meetingType && form.meetingType !== "Meet" && (
                  <Field label={`Link da reunião ${form.meetingType} *`}>
                    <Input
                      value={form.eNotariadoLink}
                      onChange={(e) => set("eNotariadoLink", e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Este link será enviado nas mensagens de WhatsApp e e-mail no lugar do link do Meet.
                    </p>
                  </Field>
                )}
              </div>
            </div>
          )}


          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Data e horário</h2>
              <div>
                <Label className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Data da videoconferência *</Label>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const d = new Date(monthCursor); d.setMonth(d.getMonth() - 1);
                    const today = new Date(); today.setDate(1); today.setHours(0,0,0,0);
                    if (d >= today) setMonthCursor(d);
                  }}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-sm font-semibold capitalize">
                    {format(monthCursor, "MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const d = new Date(monthCursor); d.setMonth(d.getMonth() + 1); setMonthCursor(d);
                  }}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                {availableDates.length === 0 ? (
                  <div className="mt-3 p-4 rounded-lg bg-muted text-sm text-muted-foreground">
                    Nenhuma data de atendimento disponível neste mês para {agency?.name}.
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {availableDates.map(({ iso, date, capacity: cap }) => {
                      const full = cap.remaining === 0;
                      const selected = form.conferenceDate === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={full}
                          onClick={() => { set("conferenceDate", iso); set("conferenceTime", ""); }}
                          className={cn(
                            "text-left p-3 rounded-lg border transition-all",
                            selected
                              ? "border-primary bg-primary/10 shadow-glow"
                              : full
                                ? "border-border bg-muted opacity-60 cursor-not-allowed"
                                : "border-border bg-card hover:border-primary"
                          )}
                        >
                          <div className="text-xs uppercase text-muted-foreground">{dayNames[date.getDay()]}</div>
                          <div className="text-lg font-bold leading-tight">{format(date, "dd/MM")}</div>
                          <div className={cn("text-xs mt-1", full ? "text-destructive" : "text-muted-foreground")}>
                            {full ? "Esgotado" : `${cap.remaining} vaga${cap.remaining === 1 ? "" : "s"}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {form.conferenceDate && capacity && capacity.isWorkingDay && (
                <div className={cn(
                  "p-3 rounded-lg border text-sm",
                  capacity.remaining === 0
                    ? "bg-warning/10 border-warning/20 text-foreground"
                    : "bg-accent border-primary/20 text-foreground"
                )}>
                  <strong>{capacity.remaining}</strong> de <strong>{capacity.total}</strong> agendamentos disponíveis em {format(new Date(form.conferenceDate + "T12:00:00"), "PPP", { locale: ptBR })}
                  {capacity.limited ? " (limite diário aplicado)" : ""} • {capacity.used} já reservado(s)
                </div>
              )}
              {form.conferenceDate && (
                <div>
                  <Label className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Horários disponíveis *</Label>
                  {availableSlots.length === 0 ? (
                    <div className="mt-3 p-4 rounded-lg bg-muted text-sm text-muted-foreground">
                      Nenhum horário disponível para esta data.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {availableSlots.map((s) => (
                        <button
                          key={s} type="button" onClick={() => set("conferenceTime", s)}
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                            form.conferenceTime === s
                              ? "bg-primary text-primary-foreground border-primary shadow-glow"
                              : "bg-card border-border hover:border-primary hover:text-primary"
                          )}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 4 && agency && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-success" /> Revisão</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <Row label="Estado do imóvel" value={form.state} />
                <Row label="Agência responsável" value={`${agency.name} (${agency.code})`} highlight />
                <Row label="Cartório" value={form.notaryOfficeName} />
                <Row label="Parceiro responsável" value={form.partnerResponsibleName} />
                <Row label="Data" value={format(new Date(form.conferenceDate + "T12:00:00"), "PPP", { locale: ptBR })} />
                <Row label="Horário" value={form.conferenceTime} />
                <Row label="Cliente" value={form.clientName} />
                <Row label="Código do imóvel" value={form.propertyCode} icon={FileDigit} />
                <Row label="Cliente presente na reunião" value={form.clientPresent === "sim" ? "Sim" : form.clientPresent === "nao" ? "Não" : "—"} />
                <Row label="Tipo de reunião" value={form.meetingType || "—"} />
                {form.meetingType && form.meetingType !== "Meet" && (
                  <Row label="Link da reunião" value={form.eNotariadoLink || "—"} />
                )}
                {form.clientPresent === "sim" && (
                  <>
                    <Row label="Telefone do cliente" value={form.clientPhone} />
                    <Row label="E-mail do cliente" value={form.clientEmail} />
                  </>
                )}

              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button variant="ghost" onClick={() => (step === 0 ? navigate("/") : setStep(step - 1))}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => { if (!canNext()) { toast.error("Preencha todos os campos obrigatórios antes de continuar."); return; } setStep(step + 1); }}
                disabled={!canNext()}
              >
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleConfirm} className="bg-gradient-hero shadow-glow">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar agendamento
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex-1 flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap",
            i < step ? "bg-success/10 text-success" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <span className="w-5 h-5 rounded-full bg-background/30 flex items-center justify-center text-[10px]">{i + 1}</span>
            {label}
          </div>
          {i < STEPS.length - 1 && <div className={cn("flex-1 h-0.5 rounded", i < step ? "bg-success" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-1.5">{children}</div></div>;
}

function Row({ label, value, highlight, icon: Icon }: { label: string; value: string; highlight?: boolean; icon?: any }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3 border-b border-border last:border-0", highlight && "bg-accent")}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground flex items-center gap-1.5">{Icon && <Icon className="w-4 h-4" />}{value}</span>
    </div>
  );
}
