export type AgencyConfig = {
  id: string;
  code: string; // Código oficial da agência (ex: AG-0081, 2922)
  name: string;
  
  responsibles: string[];
  workingDays: number[]; // 0=Sun..6=Sat
  startTime: string; // HH:mm
  endTime: string;
  slotIntervalMinutes: number;
  dailyLimit?: number; // limite de agendamentos por dia (opcional)
  managerName?: string;
  managerEmail?: string;
  ufs: string[]; // estados que essa agência atende
};

export const BRAZIL_STATES = [
  { uf: "AC", name: "Acre" }, { uf: "AL", name: "Alagoas" }, { uf: "AM", name: "Amazonas" },
  { uf: "AP", name: "Amapá" }, { uf: "BA", name: "Bahia" }, { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" }, { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" }, { uf: "MG", name: "Minas Gerais" }, { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MT", name: "Mato Grosso" }, { uf: "PA", name: "Pará" }, { uf: "PB", name: "Paraíba" },
  { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" }, { uf: "PR", name: "Paraná" },
  { uf: "RJ", name: "Rio de Janeiro" }, { uf: "RN", name: "Rio Grande do Norte" }, { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" }, { uf: "RS", name: "Rio Grande do Sul" }, { uf: "SC", name: "Santa Catarina" },
  { uf: "SE", name: "Sergipe" }, { uf: "SP", name: "São Paulo" }, { uf: "TO", name: "Tocantins" },
];

export const AGENCIES: AgencyConfig[] = [
  {
    id: "ag_0081",
    code: "AG-0081",
    name: "AG-0081",
    managerName: "Thais",
    managerEmail: "ag0081mg01@caixa.gov.br",
    responsibles: ["Gerente Thais (AG-0081)", "Equipe CCA AG-0081"],
    workingDays: [1, 4], // segunda e quinta
    startTime: "15:00",
    endTime: "17:00",
    slotIntervalMinutes: 10,
    // sem limite diário
    ufs: [
      "AL", "BA", "CE", "MA", "PB", "RJ", "AC", "ES", "AM", "PE", "GO", "PI",
      "RN", "SE", "AP", "RR", "TO", "PA", "RO", "MT", "MS", "DF", "MG", "SP",
      "PR", "RS", "SC",
    ],
  },
  {
    id: "ag_2922",
    code: "2922",
    name: "Agência 2922",
    managerName: "Andreia",
    managerEmail: "ag2922mg06@caixa.gov.br",
    responsibles: ["Gerente Andreia (2922)", "Equipe CCA 2922"],
    workingDays: [2, 4], // terça e quinta
    startTime: "16:15",
    endTime: "17:30",
    slotIntervalMinutes: 10,
    dailyLimit: 5,
    ufs: [
      "AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE",
      "AC", "AP", "AM", "PA", "RO", "RR", "TO", "GO", "RJ",
    ],
  },
  {
    id: "ag_2255",
    code: "2255",
    name: "Agência 2255",
    managerName: "Thaise",
    managerEmail: "ag2255@caixa.gov.br",
    responsibles: ["Gerente Thaise (2255)", "Equipe CCA 2255"],
    workingDays: [1, 2, 3, 4, 5], // seg a sex
    startTime: "16:00",
    endTime: "17:00",
    slotIntervalMinutes: 10,
    dailyLimit: 2,
    ufs: [
      "DF", "MT", "MS", "ES", "SP", "MG", "PR", "RS", "SC",
    ],
  },
  {
    id: "ag_teste",
    code: "TESTE",
    name: "Agência TESTE",
    managerName: "Gerente Teste",
    managerEmail: "teste@teste",
    responsibles: ["Gerente Teste (TESTE)", "Equipe CCA TESTE"],
    workingDays: [1, 2, 3, 4, 5],
    startTime: "08:00",
    endTime: "18:00",
    slotIntervalMinutes: 10,
    ufs: BRAZIL_STATES.map((s) => s.uf),
  },
];

/**
 * Overrides temporários de dias de atendimento por agência.
 * Use para exceções pontuais (ex.: força-tarefa em período limitado).
 * Datas em formato YYYY-MM-DD, inclusivas em ambas as pontas.
 */
const WORKING_DAYS_OVERRIDES: Array<{
  agencyId: string;
  fromISO: string;
  toISO: string;
  workingDays: number[];
}> = [
  // Andreia (AG 2922): de 30/06/2026 a 03/07/2026 atende ter, qua, qui e sex
  { agencyId: "ag_2922", fromISO: "2026-06-30", toISO: "2026-07-03", workingDays: [2, 3, 4, 5] },
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Retorna os dias úteis efetivos da agência considerando overrides temporários para a data informada. */
export function getWorkingDaysForDate(agency: AgencyConfig, date: Date): number[] {
  const iso = toISODate(date);
  const ov = WORKING_DAYS_OVERRIDES.find(
    (o) => o.agencyId === agency.id && iso >= o.fromISO && iso <= o.toISO
  );
  return ov ? ov.workingDays : agency.workingDays;
}

/** True se a agência atende no dia informado (considerando overrides). */
export function isAgencyWorkingDay(agency: AgencyConfig, date: Date): boolean {
  return getWorkingDaysForDate(agency, date).includes(date.getDay());
}

export function resolveAgenciesByState(uf: string): AgencyConfig[] {
  return AGENCIES.filter((a) => a.ufs.includes(uf));
}

/** Retorna a primeira agência que cobre o estado (compatibilidade). */
export function resolveAgencyByState(uf: string): AgencyConfig | null {
  return resolveAgenciesByState(uf)[0] ?? null;
}

export function getAgencyById(id: string): AgencyConfig | null {
  return AGENCIES.find((a) => a.id === id) ?? null;
}

export function getAllAgencies(): AgencyConfig[] {
  return AGENCIES;
}

// Mantido para compatibilidade — primeiro match por estado
export const STATE_TO_AGENCY: Record<string, AgencyConfig> = (() => {
  const map: Record<string, AgencyConfig> = {};
  BRAZIL_STATES.forEach((s) => {
    const a = resolveAgencyByState(s.uf);
    if (a) map[s.uf] = a;
  });
  return map;
})();
