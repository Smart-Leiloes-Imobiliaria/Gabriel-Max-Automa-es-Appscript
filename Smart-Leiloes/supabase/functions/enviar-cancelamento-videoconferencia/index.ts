// Envia email quando uma videoconferência é cancelada.
// - Se o gerente cancelar: envia ao parceiro (owner do agendamento).
// - Se o parceiro cancelar: envia ao email da agência.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const AGENCY_EMAILS: Record<string, string[]> = {
  ag_0081: ["ag0081mg01@caixa.gov.br"],
  ag_2922: ["ag2922mg06@caixa.gov.br"],
  ag_2255: ["ag2255@caixa.gov.br", "ag2255mg02@caixa.gov.br"],
};

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildBody(d: {
  notary: string; agency: string; uf: string;
  propertyCode: string; propertyRegistration: string;
  clientName: string; clientCpf: string;
  date: string; time: string; reason: string;
}) {
  return [
    "VIDEOCONFERÊNCIA CANCELADA",
    "",
    `Cartório responsável pelo cancelamento: ${d.notary}`,
    `Agência responsável: ${d.agency}`,
    `UF: ${d.uf}`,
    `Código do imóvel: ${d.propertyCode}`,
    `Matricula do imóvel: ${d.propertyRegistration}`,
    `Cliente: ${d.clientName}`,
    `CPF: ${d.clientCpf}`,
    `Data: ${d.date}`,
    `Horário: ${d.time}`,
    `Motivo do cancelamento: ${d.reason}`,
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- AUTH CHECK ----
  const _internalAuth = req.headers.get("x-internal-auth") ?? "";
  const _svcRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let _callerUserId: string | null = null;
  let _callerRole: string | null = null;
  if (!_svcRoleKey || _internalAuth !== _svcRoleKey) {
    const _authHeader = req.headers.get("Authorization") ?? "";
    if (!_authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: _authHeader } } }
    );
    const { data: _uRes, error: _uErr } = await _sbAuth.auth.getUser();
    if (_uErr || !_uRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    _callerUserId = _uRes.user.id;
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    if (!GMAIL_KEY) throw new Error("GOOGLE_MAIL_API_KEY ausente — conecte o Gmail");

    const { protocol, reason } = await req.json();
    if (!reason || !String(reason).trim()) throw new Error("reason é obrigatório");
    if (!protocol) throw new Error("protocol é obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: vc, error: vcErr } = await sb
      .from("video_conferences")
      .select("*")
      .eq("protocol", protocol)
      .maybeSingle();
    if (vcErr) throw new Error(`Erro ao buscar agendamento: ${vcErr.message}`);
    if (!vc) throw new Error(`Agendamento não encontrado para protocolo ${protocol}`);

    // Deriva o papel do solicitante SERVER-SIDE (não confia em body).
    let cancelled_by_role: "parceiro" | "gerente" | "admin" = "parceiro";
    if (_callerUserId) {
      const { data: roleRow } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", _callerUserId)
        .maybeSingle();
      _callerRole = (roleRow?.role as string) ?? null;
      if (_callerRole === "admin") cancelled_by_role = "admin";
      else if (_callerRole === "gerente") cancelled_by_role = "gerente";
      else cancelled_by_role = "parceiro";
    }

    let recipients: string[] = [];
    if (cancelled_by_role === "gerente" || cancelled_by_role === "admin") {
      const ownerId = vc.owner_id ?? vc.ownerId;
      if (ownerId) {
        const { data: u } = await sb.auth.admin.getUserById(ownerId);
        const email = u?.user?.email;
        if (email) recipients.push(email);
      }
    } else {
      const agencyId = vc.agency_id ?? vc.agencyId ?? "";
      const ag = AGENCY_EMAILS[agencyId] ?? [];
      recipients.push(...ag);
    }
    if (recipients.length === 0) throw new Error("Nenhum destinatário encontrado");


    const confDate = vc.conference_date ?? vc.conferenceDate;
    const dataFmt = confDate ? new Date(`${confDate}T00:00:00`).toLocaleDateString("pt-BR") : "—";
    const bodyText = buildBody({
      notary: vc.notary_office_name ?? vc.notaryOfficeName ?? "—",
      agency: vc.agency_name ?? vc.agencyName ?? "—",
      uf: vc.property_state ?? vc.state ?? "—",
      propertyCode: vc.property_code ?? vc.propertyCode ?? "—",
      propertyRegistration: vc.property_registration ?? vc.propertyRegistration ?? "—",
      clientName: vc.client_name ?? vc.clientName ?? "—",
      clientCpf: vc.client_cpf ?? vc.clientCpf ?? "—",
      date: dataFmt,
      time: vc.conference_time ?? vc.conferenceTime ?? "—",
      reason: String(reason),
    });


    const subject = `Videoconferência cancelada — ${vc.agency_name} — ${vc.client_name}`;
    const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    const rfc2822 = [
      `To: ${recipients.join(", ")}`,
      `Subject: ${subjectEncoded}`,
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
    if (!gmailRes.ok) throw new Error(`Gmail [${gmailRes.status}]: ${JSON.stringify(gmailJson)}`);

    // ---- Notificação ao CLIENTE (e-mail + WhatsApp template) ----
    // Só notifica o cliente se ele estiver marcado como presente na reunião.
    const clientResults: any = { email: null, whatsapp: null };
    const isClientPresent = vc.client_present === true;
    const clientEmail = isClientPresent ? (vc.client_email ?? null) : null;
    const clientPhone = isClientPresent ? (vc.client_phone ?? null) : null;
    const clientCancelText = bodyText + "\r\n\r\nEntre em contato com o cartório responsável para realizar um novo agendamento!";

    if (clientEmail) {
      try {
        const subjectCli = `Videoconferência cancelada — ${vc.client_name}`;
        const subjEnc = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subjectCli)))}?=`;
        const rfc = [
          `To: ${clientEmail}`,
          `Subject: ${subjEnc}`,
          "MIME-Version: 1.0",
          'Content-Type: text/plain; charset="UTF-8"',
          "Content-Transfer-Encoding: 8bit",
          "",
          clientCancelText,
        ].join("\r\n");
        const r = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GMAIL_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: b64url(rfc) }),
        });
        clientResults.email = { ok: r.ok, status: r.status };
      } catch (e: any) {
        clientResults.email = { ok: false, error: e?.message ?? String(e) };
      }
    }

    if (clientPhone) {
      try {
        const digits = String(clientPhone).replace(/\D/g, "");
        if (digits.length >= 12) {
          const chatId = `${digits}@c.us`;
          const chatappLicenseId =
            Deno.env.get("CHATAPP_CLIENT_LICENSE_ID") ?? Deno.env.get("CHATAPP_LICENSE_ID");
          // Template: notificacao_cliente_cancelemento (pt_BR) — 10 variáveis
          // {{1}} Cartório, {{2}} Agência, {{3}} UF, {{4}} Código, {{5}} Matrícula,
          // {{6}} Cliente, {{7}} CPF, {{8}} Data, {{9}} Horário, {{10}} Motivo
          const templateParams = [
            vc.notary_office_name ?? "—",
            vc.agency_name ?? "—",
            vc.property_state ?? "—",
            vc.property_code ?? "—",
            vc.property_registration ?? "—",
            vc.client_name ?? "—",
            vc.client_cpf ?? "—",
            dataFmt,
            vc.conference_time ?? "—",
            String(reason),
          ];
          const r = await fetch(`${SUPABASE_URL}/functions/v1/enviar-mensagem-chatapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
            body: JSON.stringify({
              type: "template",
              template: { id: "2257695344970354", language: "pt_BR", params: templateParams },
              chatId,
              ...(chatappLicenseId ? { licenseId: Number(chatappLicenseId) } : {}),
              messengerType: "caWhatsApp",
              related_type: "video_conference_cancel_client",
              related_id: vc.id,
              agency_id: vc.agency_id,
            }),
          });
          const j = await r.json().catch(() => ({}));
          clientResults.whatsapp = { ok: r.ok && j?.success, status: r.status, body: j };
        } else {
          clientResults.whatsapp = { ok: false, error: "Número inválido" };
        }
      } catch (e: any) {
        clientResults.whatsapp = { ok: false, error: e?.message ?? String(e) };
      }
    }

    // ---- Notificação ao PARCEIRO (owner) e GERENTE(s) da agência via WhatsApp ----
    const internalResults: any[] = [];
    try {
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
      const { data: profs } = ids.length
        ? await sb.from("profiles").select("id, phone").in("id", ids)
        : { data: [] as any[] };
      // Reusa o template HSM aprovado de cancelamento para garantir entrega
      // fora da janela de 24h do WhatsApp Cloud API.
      const internalTemplateParams = [
        vc.notary_office_name ?? "—",
        vc.agency_name ?? "—",
        vc.property_state ?? "—",
        vc.property_code ?? "—",
        vc.property_registration ?? "—",
        vc.client_name ?? "—",
        vc.client_cpf ?? "—",
        dataFmt,
        vc.conference_time ?? "—",
        String(reason),
      ];
      for (const p of (profs ?? [])) {
        const digits = String((p as any).phone ?? "").replace(/\D/g, "");
        if (digits.length < 12) {
          internalResults.push({ user: (p as any).id, ok: false, error: "phone inválido" });
          continue;
        }
        const r = await fetch(`${SUPABASE_URL}/functions/v1/enviar-mensagem-chatapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
          body: JSON.stringify({
            type: "template",
            template: { id: "1344741507551367", language: "pt_BR", params: internalTemplateParams },
            chatId: `${digits}@c.us`,
            related_type: "video_conference_cancel_internal",
            related_id: vc.id,
            agency_id: vc.agency_id,
          }),
        });
        const j = await r.json().catch(() => ({}));
        internalResults.push({ user: (p as any).id, ok: r.ok && j?.success, status: r.status, body: j });
      }
    } catch (e) {
      console.error("Falha ao notificar parceiro/gerente:", e);
    }

    return new Response(
      JSON.stringify({ success: true, recipients, client: clientResults, internal: internalResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("enviar-cancelamento-videoconferencia error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
