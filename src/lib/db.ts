import { supabase } from "@/integrations/supabase/client";
import { getAgencyById, resolveAgencyByState, isAgencyWorkingDay } from "./agencies";

export type ScheduleStatus =
  | "Videoconferência agendada"
  | "Reagendamento solicitado"
  | "Cancelada"
  | "Realizada"
  | "Não compareceu"
  | "Aguardando confirmação"
  | "Concluída";

export type DemandStatus =
  | "Validação da minuta dentro do prazo de 2 dias"
  | "Validação da minuta não realizada dentro do prazo de 2 dias, com escalonamento em 1 dia"
  | "Validação da minuta não realizada em nenhum momento, com escalonamento para o setor responsável pelo parceiro"
  | "Assinatura do contrato";

export type SignatureType = "ICP-Brasil" | "Gov" | "E-notariado";
export type MinuteStatus = "Pendente de validação" | "Validada" | "Não validada";

export type VideoConferenceSchedule = {
  id: string;
  protocol: string;
  state: string;
  agencyId: string;
  agencyName: string;
  notaryOfficeName: string;
  partnerResponsibleName: string;
  conferenceDate: string;
  conferenceTime: string;
  clientName: string;
  clientCpf?: string | null;
  propertyCode: string;
  propertyRegistration?: string | null;
  status: ScheduleStatus;
  ownerId?: string | null;
  createdAt: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  meetLink?: string | null;
  meetingType?: "Meet" | "E-notariado" | "GOV" | "Adobe" | null;
  clientPresent?: boolean | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientWhatsappStatus?: string | null;
  clientWhatsappError?: string | null;
  clientEmailStatus?: string | null;
  clientEmailError?: string | null;
  partnerConfirmedAt?: string | null;
  partnerConfirmedBy?: string | null;
  managerConfirmedAt?: string | null;
  managerConfirmedBy?: string | null;
  completedAt?: string | null;
};


export type PropertyTreatment = {
  id: string;
  protocol: string;
  uf: string;
  propertyCode: string;
  propertyRegistration?: string | null;
  notaryOfficeName?: string | null;
  clientName: string;
  agencyId: string;
  agencyName: string;
  minuteSentOrChargedAt: string;
  demandStatus: DemandStatus;
  observations?: string | null;
  signatureType?: SignatureType | null;
  eNotariadoLink?: string | null;
  minuteStatus: MinuteStatus;
  managerValidated?: boolean | null;
  managerValidationReason?: string | null;
  managerValidatedAt?: string | null;
  minuteFilePath?: string | null;
  minuteFileName?: string | null;
  managerMinuteFilePath?: string | null;
  managerMinuteFileName?: string | null;
  contractFilePath?: string | null;
  contractFileName?: string | null;
  managerContractFilePath?: string | null;
  managerContractFileName?: string | null;
  managerContractUploadedAt?: string | null;
  ownerId?: string | null;
  createdAt: string;
};

// ---- Mappers (snake_case <-> camelCase) ----
export function mapSchedule(r: any): VideoConferenceSchedule {
  return {
    id: r.id,
    protocol: r.protocol,
    state: r.property_state,
    agencyId: r.agency_id,
    agencyName: r.agency_name,
    notaryOfficeName: r.notary_office_name,
    partnerResponsibleName: r.partner_responsible_name,
    conferenceDate: r.conference_date,
    conferenceTime: r.conference_time,
    clientName: r.client_name,
    clientCpf: r.client_cpf,
    propertyCode: r.property_code,
    propertyRegistration: r.property_registration,
    status: r.status,
    ownerId: r.owner_id,
    createdAt: r.created_at,
    cancelReason: r.cancel_reason,
    cancelledAt: r.cancelled_at,
    cancelledBy: r.cancelled_by,
    meetLink: r.meet_link,
    meetingType: r.meeting_type ?? "Meet",
    clientPresent: r.client_present,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    clientWhatsappStatus: r.client_whatsapp_status,
    clientWhatsappError: r.client_whatsapp_error,
    clientEmailStatus: r.client_email_status,
    clientEmailError: r.client_email_error,
    partnerConfirmedAt: r.partner_confirmed_at,
    partnerConfirmedBy: r.partner_confirmed_by,
    managerConfirmedAt: r.manager_confirmed_at,
    managerConfirmedBy: r.manager_confirmed_by,
    completedAt: r.completed_at,
  };
}


export function mapTreatment(r: any): PropertyTreatment {
  return {
    id: r.id,
    protocol: r.protocol,
    uf: r.uf,
    propertyCode: r.property_code,
    propertyRegistration: r.property_registration,
    notaryOfficeName: r.notary_office_name,
    clientName: r.client_name,
    agencyId: r.agency_id,
    agencyName: r.agency_name,
    minuteSentOrChargedAt: r.minute_sent_at,
    demandStatus: r.demand_status,
    observations: r.observations,
    signatureType: r.signature_type,
    eNotariadoLink: r.e_notariado_link,
    minuteStatus: r.minute_status ?? "Pendente de validação",
    managerValidated: r.manager_validated,
    managerValidationReason: r.manager_validation_reason,
    managerValidatedAt: r.manager_validated_at,
    minuteFilePath: r.minute_file_path,
    minuteFileName: r.minute_file_name,
    managerMinuteFilePath: r.manager_minute_file_path,
    managerMinuteFileName: r.manager_minute_file_name,
    contractFilePath: r.contract_file_path,
    contractFileName: r.contract_file_name,
    managerContractFilePath: r.manager_contract_file_path,
    managerContractFileName: r.manager_contract_file_name,
    managerContractUploadedAt: r.manager_contract_uploaded_at,
    ownerId: r.owner_id,
    createdAt: r.created_at,
  };
}

// ---- Protocol generator ----
export async function nextProtocol(prefix: "AGD" | "TRT"): Promise<string> {
  const { data, error } = await supabase.rpc("next_protocol", { prefix });
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar protocolo");
  return data as string;
}

// ---- Schedules ----
export async function listSchedules(): Promise<VideoConferenceSchedule[]> {
  const { data, error } = await supabase
    .from("video_conferences")
    .select("*")
    .order("conference_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSchedule);
}

export async function getScheduleByProtocol(protocol: string) {
  const { data, error } = await supabase.rpc("get_schedule_by_protocol", { _protocol: protocol });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapSchedule(row) : null;
}


export async function updateSchedule(id: string, patch: Record<string, any>) {
  const { error } = await supabase.from("video_conferences").update(patch as any).eq("id", id);
  if (error) throw error;
}

// ---- Treatments ----
export async function listTreatments(): Promise<PropertyTreatment[]> {
  const { data, error } = await supabase
    .from("property_treatments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTreatment);
}

export async function updateTreatment(id: string, patch: Record<string, any>) {
  const { error } = await supabase.from("property_treatments").update(patch as any).eq("id", id);
  if (error) throw error;
}

// ---- Notification log ----
export async function logNotification(args: {
  relatedType: "schedule" | "treatment";
  relatedId: string;
  agencyId: string;
  message: string;
}) {
  await supabase.from("notification_logs").insert({
    related_type: args.relatedType,
    related_id: args.relatedId,
    agency_id: args.agencyId,
    message: args.message,
  });
}

// ---- Slot availability (DB-backed) ----
function timeToMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToTime(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

export async function getDayBookings(agencyId: string, dateISO: string) {
  const { data } = await supabase.rpc("get_day_bookings", { _agency_id: agencyId, _date: dateISO });
  return (data ?? []).map((r: any) => r.conference_time as string);
}


export async function getDailyCapacity(agencyId: string, dateISO: string) {
  const agency = getAgencyById(agencyId);
  if (!agency) return { total: 0, used: 0, remaining: 0, limited: false, isWorkingDay: false };
  const d = new Date(dateISO + "T12:00:00");
  const isWorkingDay = isAgencyWorkingDay(agency, d);
  if (!isWorkingDay) return { total: 0, used: 0, remaining: 0, limited: !!agency.dailyLimit, isWorkingDay };
  const start = timeToMin(agency.startTime);
  const end = timeToMin(agency.endTime);
  const step = agency.slotIntervalMinutes;
  const totalByInterval = Math.floor((end - start) / step) + 1;
  const total = agency.dailyLimit ? Math.min(agency.dailyLimit, totalByInterval) : totalByInterval;
  const bookings = await getDayBookings(agencyId, dateISO);
  const used = bookings.length;
  return { total, used, remaining: Math.max(0, total - used), limited: !!agency.dailyLimit, isWorkingDay };
}

export async function getAvailableSlots(agencyId: string, dateISO: string): Promise<string[]> {
  const agency = getAgencyById(agencyId);
  if (!agency) return [];
  const d = new Date(dateISO + "T12:00:00");
  if (!isAgencyWorkingDay(agency, d)) return [];
  const start = timeToMin(agency.startTime);
  const end = timeToMin(agency.endTime);
  const step = agency.slotIntervalMinutes;
  const allSlots: string[] = [];
  for (let m = start; m <= end; m += step) allSlots.push(minToTime(m));
  const bookings = await getDayBookings(agencyId, dateISO);
  if (agency.dailyLimit && bookings.length >= agency.dailyLimit) return [];
  const taken = bookings.map((b) => timeToMin(b));
  return allSlots.filter((s) => {
    const sm = timeToMin(s);
    return !taken.some((t) => Math.abs(t - sm) < step);
  });
}

export async function isSlotTaken(agencyId: string, dateISO: string, time: string): Promise<boolean> {
  const bookings = await getDayBookings(agencyId, dateISO);
  return bookings.includes(time);
}

// ---- Deadlines ----
export type DeadlineStatus =
  | "Dentro do prazo"
  | "Escalonado"
  | "Atrasado Escalonado";

export function computeDeadline(t: PropertyTreatment): DeadlineStatus {
  if (t.demandStatus === "Assinatura do contrato") return "Dentro do prazo";
  if (t.managerValidated) return "Dentro do prazo";
  const sent = new Date(t.minuteSentOrChargedAt + "T12:00:00");
  const diffDays = (Date.now() - sent.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 2) return "Dentro do prazo";
  if (diffDays < 3) return "Escalonado";
  return "Atrasado Escalonado";
}

// ---- Storage helpers ----
export async function downloadFromStorage(path: string, fileName: string) {
  const { data, error } = await supabase.storage.from("minutas").download(path);
  if (error || !data) throw error ?? new Error("Falha ao baixar arquivo");
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export { resolveAgencyByState };
