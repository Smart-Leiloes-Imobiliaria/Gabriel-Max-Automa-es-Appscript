// Rotina automática que verifica minutas pendentes de validação há 2+ dias
// e envia alerta por e-mail ao gerente responsável (uma única vez por processo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const AGENCY_EMAILS: Record<string, string[]> = {
  ag_0081: ["ag0081mg01@caixa.gov.br"],
  ag_2922: ["ag2922mg06@caixa.gov.br"],
  ag_2255: ["ag2255@caixa.gov.br", "ag2255mg02@caixa.gov.br"],
};

const ALERT_TAG = "[ALERTA_MINUTA_2D]";

function b64urlFromString(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildBody(d: {
  notary: string; agency: string; uf: string;
  propertyCode: string; propertyRegistration: string;
  data: string; horario: string; status: string;
}) {
  return [
    "MINUTA PENDENTE VALIDAÇÃO - 2 DIAS",
    "",
    `Cartório responsável pelo agendamento: ${d.notary}`,
    `Agência responsável: ${d.agency}`,
    `UF: ${d.uf}`,
    `Código do imóvel: ${d.propertyCode}`,
    `Matrícula do imóvel: ${d.propertyRegistration}`,
    `Data: ${d.data}`,
    `Horário: ${d.horario}`,
    `Status: ${d.status}`,
    "",
    "ATENÇÃO GERENTE",
    "A minuta deverá ser validada no prazo de até 24 horas para não ocorrer um novo escalonamento.",
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- AUTH CHECK ----
  const _internalAuth = req.headers.get("x-internal-auth") ?? "";
  const _svcRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
  }


  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary: any[] = [];

  try {
    try { await req.json(); } catch (_) {}


    // Limite: created_at <= agora - 2 dias
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendentes, error } = await sb
      .from("property_treatments")
      .select("*")
      .eq("minute_status", "Pendente de validação")
      .lte("created_at", cutoff);
    if (error) throw error;

    for (const tr of pendentes ?? []) {
      try {
        // Anti-duplicidade: já enviamos alerta para esse processo?
        const { data: prev } = await sb
          .from("notification_logs")
          .select("id")
          .eq("related_type", "treatment")
          .eq("related_id", tr.id)
          .ilike("message", `%${ALERT_TAG}%`)
          .limit(1);
        if (prev && prev.length > 0) {
          summary.push({ protocol: tr.protocol, skipped: "ja_enviado" });
          continue;
        }

        const recipients: string[] = (AGENCY_EMAILS[tr.agency_id ?? ""] ?? []).filter(Boolean);
        if (recipients.length === 0) {
          summary.push({ protocol: tr.protocol, skipped: "sem_destinatario" });
          continue;
        }

        const created = new Date(tr.created_at);
        const horario = created.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
        });
        const dataFmt = created.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

        const bodyText = buildBody({
          notary: tr.notary_office_name ?? "—",
          agency: tr.agency_name ?? "—",
          uf: tr.uf,
          propertyCode: tr.property_code,
          propertyRegistration: tr.property_registration ?? "—",
          data: dataFmt,
          horario,
          status: tr.minute_status,
        });

        const subject = `MINUTA PENDENTE VALIDAÇÃO - 2 DIAS — ${tr.agency_name ?? ""} — ${tr.property_code}`;
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

        let sendStatus = "sent";
        let sendError: string | null = null;

        if (!LOVABLE_API_KEY || !GMAIL_KEY) {
          sendStatus = "failed";
          sendError = "Credenciais Gmail ausentes";
        } else {
          const raw = b64urlFromString(rfc2822);
          const gmailRes = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GMAIL_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
          });
          if (!gmailRes.ok) {
            sendStatus = "failed";
            sendError = `Gmail [${gmailRes.status}]: ${await gmailRes.text()}`;
          }
        }

        await sb.from("notification_logs").insert({
          related_type: "treatment",
          related_id: tr.id,
          agency_id: tr.agency_id ?? "—",
          channel: "email",
          status: sendStatus,
          message: `${ALERT_TAG} Protocolo ${tr.protocol} • Destinatário: ${recipients.join(", ")} • Status: ${tr.minute_status}${sendError ? ` • Erro: ${sendError}` : ""}`,
        });

        // Notificação ao grupo de WhatsApp removida — somente envios individuais permanecem ativos.


        summary.push({ protocol: tr.protocol, sent: sendStatus === "sent", error: sendError });
      } catch (e: any) {
        summary.push({ protocol: tr.protocol, error: e?.message ?? String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: summary.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("alerta-minuta-pendente error:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
