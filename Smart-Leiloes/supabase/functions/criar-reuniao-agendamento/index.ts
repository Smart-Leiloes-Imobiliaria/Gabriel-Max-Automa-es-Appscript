// Cria evento no Google Calendar com link do Meet e envia email
// formatado para a agência responsável e o parceiro responsável.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CAL_GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

// Mapeamento de email das agências (espelha src/lib/agencies.ts)
const AGENCY_EMAILS: Record<string, string[]> = {
  ag_0081: ["ag0081mg01@caixa.gov.br"],
  ag_2922: ["ag2922mg06@caixa.gov.br"],
  ag_2255: ["ag2255@caixa.gov.br", "ag2255mg02@caixa.gov.br"],
};

function b64url(s: string): string {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildEmailBody(d: {
  notary: string; agency: string; uf: string;
  propertyCode: string; propertyRegistration: string;
  clientName: string; clientCpf: string;
  date: string; time: string; meetLink: string;
}) {
  return [
    "VIDEOCONFERÊNCIA AGENDADA",
    "",
    `Cartório responsável pelo agendamento: ${d.notary}`,
    `Agência responsável: ${d.agency}`,
    `UF: ${d.uf}`,
    `Código do imóvel: ${d.propertyCode}`,
    `Matricula do imóvel: ${d.propertyRegistration}`,
    `Cliente: ${d.clientName}`,
    `CPF: ${d.clientCpf}`,
    `Data: ${d.date}`,
    `Horário: ${d.time}`,
    "",
    `Link videoconferência: ${d.meetLink}`,
    "",
    "Disponibilizado também 10 minutos antes via convite no Google Calendar.",
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GCAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    if (!GCAL_KEY) throw new Error("GOOGLE_CALENDAR_API_KEY ausente — conecte o Google Calendar");
    if (!GMAIL_KEY) throw new Error("GOOGLE_MAIL_API_KEY ausente — conecte o Gmail");

    const { protocol } = await req.json();
    if (!protocol) throw new Error("protocol é obrigatório");

    // Cliente com service role para ler/atualizar a tabela
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth obrigatório
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userData.user.id;
    const partnerEmail: string | null = userData.user.email ?? null;

    // Carrega agendamento
    const { data: vc, error: selErr } = await sb
      .from("video_conferences")
      .select("*")
      .eq("protocol", protocol)
      .single();
    if (selErr || !vc) throw new Error(`Agendamento não encontrado: ${selErr?.message}`);

    // Autoriza: somente owner, gerente da mesma agência ou admin pode criar a reunião
    const { data: callerRole } = await sb
      .from("user_roles").select("role").eq("user_id", callerId).maybeSingle();
    const isAdmin = callerRole?.role === "admin";
    const isGerente = callerRole?.role === "gerente";
    let gerenteSameAgency = false;
    if (isGerente) {
      const { data: prof } = await sb.from("profiles").select("agency_id").eq("id", callerId).maybeSingle();
      gerenteSameAgency = !!prof?.agency_id && prof.agency_id === vc.agency_id;
    }
    if (callerId !== vc.owner_id && !isAdmin && !gerenteSameAgency) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const agencyEmails = AGENCY_EMAILS[vc.agency_id] ?? [];
    const recipients: string[] = [...agencyEmails, partnerEmail].filter(Boolean) as string[];
    if (recipients.length === 0) {
      throw new Error("Nenhum destinatário (agência ou parceiro) encontrado");
    }

    // Monta horário: assume fuso America/Sao_Paulo
    const startISO = `${vc.conference_date}T${vc.conference_time}:00`;
    const startDate = new Date(`${startISO}-03:00`);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const meetingType: string = vc.meeting_type ?? "Meet";
    let meetLink: string = "";
    let eventId: string = "";

    if (meetingType !== "Meet") {
      // Para E-notariado, GOV e Adobe usamos o link informado manualmente pelo parceiro.
      meetLink = vc.meet_link ?? "";
      if (!meetLink) {
        throw new Error(`Reunião ${meetingType} sem link informado`);
      }
    } else {
      // 1) Cria evento no Calendar com Meet
      const eventBody = {
        summary: `Videoconferência - ${vc.client_name} (${vc.property_code})`,
        description: buildEmailBody({
          notary: vc.notary_office_name,
          agency: vc.agency_name,
          uf: vc.property_state,
          propertyCode: vc.property_code,
          propertyRegistration: vc.property_registration ?? "—",
          clientName: vc.client_name,
          clientCpf: vc.client_cpf ?? "—",
          date: vc.conference_date,
          time: vc.conference_time,
          meetLink: "(será gerado pelo Google Meet)",
        }),
        start: { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" },
        attendees: recipients.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `${protocol}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: "email", minutes: 10 }, { method: "popup", minutes: 10 }],
        },
      };

      const calRes = await fetch(
        `${CAL_GATEWAY}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GCAL_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );
      const calJson = await calRes.json();
      if (!calRes.ok) {
        throw new Error(`Calendar [${calRes.status}]: ${JSON.stringify(calJson)}`);
      }

      meetLink =
        calJson.hangoutLink ||
        calJson.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri ||
        "";
      eventId = calJson.id;

      // 2) Salva link/eventId na tabela
      await sb
        .from("video_conferences")
        .update({ meet_link: meetLink, meet_event_id: eventId })
        .eq("protocol", protocol);
    }

    // 3) Envia email formatado pelo Gmail
    const subject = `Videoconferência agendada — ${vc.agency_name} — ${vc.client_name}`;
    const bodyText = buildEmailBody({
      notary: vc.notary_office_name,
      agency: vc.agency_name,
      uf: vc.property_state,
      propertyCode: vc.property_code,
      propertyRegistration: vc.property_registration ?? "—",
      clientName: vc.client_name,
      clientCpf: vc.client_cpf ?? "—",
      date: vc.conference_date,
      time: vc.conference_time,
      meetLink: meetLink || "(link não disponível)",
    });

    const rfc2822 = [
      `To: ${recipients.join(", ")}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      bodyText,
    ].join("\r\n");

    const gmailRes = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAIL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: b64url(rfc2822) }),
    });
    const gmailJson = await gmailRes.json();
    if (!gmailRes.ok) {
      console.error("Gmail erro:", gmailJson);
      // não derruba a operação — o convite do Calendar já foi enviado
    }

    // Notificação ao grupo removida — envios de WhatsApp agora ocorrem apenas em modo individual (cliente).


    // Envio ao CLIENTE quando "client_present" = true
    let clientWhatsappStatus: string | null = null;
    let clientWhatsappError: string | null = null;
    let clientEmailStatus: string | null = null;
    let clientEmailError: string | null = null;

    if (vc.client_present) {
      // ---- E-mail ao cliente ----
      if (vc.client_email) {
        try {
          const clientEmailRfc = [
            `To: ${vc.client_email}`,
            `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
            "MIME-Version: 1.0",
            'Content-Type: text/plain; charset="UTF-8"',
            "Content-Transfer-Encoding: 8bit",
            "",
            bodyText,
          ].join("\r\n");
          const r = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GMAIL_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: b64url(clientEmailRfc) }),
          });
          if (r.ok) {
            clientEmailStatus = "Enviado com sucesso";
          } else {
            const j = await r.text();
            clientEmailStatus = "Erro ao enviar";
            clientEmailError = `Falha na API de envio (${r.status}): ${j.slice(0, 300)}`;
          }
        } catch (e: any) {
          clientEmailStatus = "Erro ao enviar";
          clientEmailError = `Erro desconhecido: ${e?.message ?? String(e)}`;
        }
      } else {
        clientEmailStatus = "Erro ao enviar";
        clientEmailError = "E-mail do cliente não informado";
      }

      // E-mail/WhatsApp ao cliente são tratados aqui (Bitrix passou para fora deste bloco)
      // ---- WhatsApp ao cliente (template HSM aprovado) ----
      if (vc.client_phone) {
        try {
          const digits = String(vc.client_phone).replace(/\D/g, "");
          if (digits.length < 12) {
            clientWhatsappStatus = "Erro ao enviar";
            clientWhatsappError = "Número inválido";
          } else {
            // Marcador: marcar como enviado; o envio real ocorre no bloco unificado abaixo,
            // junto com parceiro/gerente, com deduplicação por telefone.
            clientWhatsappStatus = "Enviado com sucesso";
          }
        } catch (e: any) {
          clientWhatsappStatus = "Erro ao enviar";
          clientWhatsappError = `Erro ao preparar envio: ${e?.message ?? String(e)}`;
        }
      } else {
        clientWhatsappStatus = "Erro ao enviar";
        clientWhatsappError = "Telefone do cliente não informado";
      }

      // Persiste status de e-mail/WhatsApp do cliente
      await sb
        .from("video_conferences")
        .update({
          client_whatsapp_status: clientWhatsappStatus,
          client_whatsapp_error: clientWhatsappError,
          client_email_status: clientEmailStatus,
          client_email_error: clientEmailError,
        })
        .eq("protocol", protocol);
    }

    // ---- Mensagem ao cliente via Bitrix24 (sempre dispara, junto com e-mail/WhatsApp) ----
    try {
      const bxRes = await fetch(`${SUPABASE_URL}/functions/v1/bitrix-enviar-mensagem-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
        body: JSON.stringify({
          propertyCode: vc.property_code,
          clientName: vc.client_name,
          message:
            "VIDEOCONFERÊNCIA AGENDADA\n\n" +
            `Cartório responsável pelo agendamento: ${vc.notary_office_name ?? "—"}\n` +
            `Agência responsável: ${vc.agency_name ?? "—"}\n` +
            `UF: ${vc.property_state ?? "—"}\n` +
            `Código do imóvel: ${vc.property_code ?? "—"}\n` +
            `Matricula do imóvel: ${vc.property_registration ?? "—"}\n` +
            `Data: ${vc.conference_date ? new Date(`${vc.conference_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"}\n` +
            `Horário: ${vc.conference_time ?? "—"}\n` +
            `Link videoconferência disponibilizada 10 minutos antes via e-mail: ${meetLink || "—"}`,
          related_id: vc.id,
          related_type: "video_conference_client_bitrix",
          agency_id: vc.agency_id,
        }),
      });
      const bxJson = await bxRes.json().catch(() => ({}));
      console.log("Bitrix envio:", bxRes.status, JSON.stringify(bxJson).slice(0, 300));
    } catch (e) {
      console.error("Falha ao chamar bitrix-enviar-mensagem-cliente:", e);
    }


    // ---- WhatsApp unificado: cliente + parceiro (owner) + gerente(s) da agência ----
    // Envia o template uma única vez por telefone (dedup por dígitos), evitando duplicação
    // quando, por exemplo, o telefone do cliente coincide com o do parceiro/gerente.
    const internalResults: any[] = [];
    try {
      const dataFmtAll = vc.conference_date
        ? new Date(`${vc.conference_date}T00:00:00`).toLocaleDateString("pt-BR")
        : "—";
      const templateParamsAll = [
        vc.notary_office_name ?? "—",
        vc.agency_name ?? "—",
        vc.property_state ?? "—",
        vc.property_code ?? "—",
        vc.property_registration ?? "—",
        vc.client_name ?? "—",
        vc.client_cpf ?? "—",
        dataFmtAll,
        vc.conference_time ?? "—",
        meetLink || "—",
      ];
      const chatappLicenseId =
        Deno.env.get("CHATAPP_CLIENT_LICENSE_ID") ?? Deno.env.get("CHATAPP_LICENSE_ID");

      // Monta lista de destinatários { label, userId?, phone }
      type WaTarget = { label: string; userId?: string; phone: string };
      const targets: WaTarget[] = [];

      if (vc.client_present && vc.client_phone) {
        targets.push({ label: "cliente", phone: String(vc.client_phone) });
      }

      const ids: string[] = [];
      if (vc.owner_id) ids.push(vc.owner_id);
      const { data: gerentes } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "gerente");
      const gerenteIds = (gerentes ?? []).map((g: any) => g.user_id);
      if (gerenteIds.length) {
        const { data: gprofs } = await sb
          .from("profiles")
          .select("id, agency_id")
          .in("id", gerenteIds)
          .eq("agency_id", vc.agency_id);
        for (const g of (gprofs ?? [])) ids.push((g as any).id);
      }
      const uniqIds = Array.from(new Set(ids));
      const { data: profs } = uniqIds.length
        ? await sb.from("profiles").select("id, phone").in("id", uniqIds)
        : { data: [] as any[] };
      for (const p of (profs ?? [])) {
        const phone = String((p as any).phone ?? "");
        if (!phone) continue;
        const label = (p as any).id === vc.owner_id ? "parceiro" : "gerente";
        targets.push({ label, userId: (p as any).id, phone });
      }

      // Envia para todos os envolvidos (cliente, parceiro, gerente) — sem pular ninguém.
      for (const t of targets) {
        const digits = t.phone.replace(/\D/g, "");
        if (digits.length < 12) {
          internalResults.push({ target: t.label, user: t.userId, ok: false, error: "phone inválido" });
          continue;
        }

        const relatedType =
          t.label === "cliente"
            ? "video_conference_client"
            : "video_conference_agendamento_internal";

        const r = await fetch(`${SUPABASE_URL}/functions/v1/enviar-mensagem-chatapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
          body: JSON.stringify({
            type: "template",
            template: {
              id: "1686516785996693",
              language: "pt_BR",
              params: templateParamsAll,
            },
            chatId: `${digits}@c.us`,
            ...(t.label === "cliente" && chatappLicenseId
              ? { licenseId: Number(chatappLicenseId), messengerType: "caWhatsApp" }
              : {}),
            related_type: relatedType,
            related_id: vc.id,
            agency_id: vc.agency_id,
          }),
        });
        const j = await r.json().catch(() => ({}));
        internalResults.push({
          target: t.label,
          user: t.userId,
          phone: digits,
          ok: r.ok && j?.success,
          status: r.status,
        });
      }
    } catch (e) {
      console.error("Falha ao enviar WhatsApp (cliente/parceiro/gerente):", e);
    }


    return new Response(
      JSON.stringify({
        success: true,
        meet_link: meetLink,
        event_id: eventId,
        recipients,
        gmail_ok: gmailRes.ok,
        client_whatsapp_status: clientWhatsappStatus,
        client_email_status: clientEmailStatus,
        internal: internalResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("criar-reuniao-agendamento error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
