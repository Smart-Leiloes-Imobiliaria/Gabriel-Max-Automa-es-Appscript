// Envia email para a gerente da agência com a minuta anexada
// quando o parceiro registra uma tratativa de validação de minuta.
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

function b64urlFromString(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function b64urlFromBytes(bytes: Uint8Array): string {
  return b64FromBytes(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function diasEntre(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000));
}

function statusLinha(demand: string, dataEnvio: string): string {
  if (demand?.toLowerCase().includes("assinatura")) return "minuta validada";
  if (demand?.toLowerCase().includes("escalonamento")) return "minuta com pendência";
  const dias = diasEntre(dataEnvio);
  if (dias <= 1) return "enviado a 1 dia";
  if (dias === 2) return "enviado a 2 dias";
  return `enviado a ${dias} dias`;
}

function buildBody(d: {
  notary: string; agency: string; uf: string;
  propertyCode: string; propertyRegistration: string;
  data: string; horario: string; status: string;
}) {
  return [
    "MINUTA ENVIADA PARA VALIDAÇÃO",
    "",
    `Cartório responsável pelo agendamento: ${d.notary}`,
    `Agência responsável: ${d.agency}`,
    `UF: ${d.uf}`,
    `Código do imóvel: ${d.propertyCode}`,
    `Matricula do imóvel: ${d.propertyRegistration}`,
    `Data: ${d.data}    Horário: ${d.horario}`,
    `Status: ${d.status}`,
    "",
    "ATENÇÃO: Caso o gerente não valide a minuta, o motivo da não validação deverá ser registrado no site. O cartório parceiro deverá acompanhar essa justificativa diretamente pelo site.",
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


  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    if (!GMAIL_KEY) throw new Error("GOOGLE_MAIL_API_KEY ausente — conecte o Gmail");

    const { protocol } = await req.json();
    if (!protocol) throw new Error("protocol é obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: tr, error: selErr } = await sb
      .from("property_treatments")
      .select("*")
      .eq("protocol", protocol)
      .single();
    if (selErr || !tr) throw new Error(`Tratativa não encontrada: ${selErr?.message}`);

    const recipients: string[] = (AGENCY_EMAILS[tr.agency_id ?? ""] ?? []).filter(Boolean);
    if (recipients.length === 0) throw new Error("Nenhum destinatário encontrado");

    // Horário do registro (created_at) em America/Sao_Paulo
    const created = new Date(tr.created_at);
    const horario = created.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit", minute: "2-digit",
    });
    const dataFmt = new Date(`${tr.minute_sent_at}T00:00:00`).toLocaleDateString("pt-BR");

    const status = tr.demand_status ?? statusLinha(tr.demand_status, tr.minute_sent_at);

    const bodyText = buildBody({
      notary: tr.notary_office_name ?? "—",
      agency: tr.agency_name ?? "—",
      uf: tr.uf,
      propertyCode: tr.property_code,
      propertyRegistration: tr.property_registration ?? "—",
      data: dataFmt,
      horario,
      status,
    });

    // Baixa minuta do Storage (se houver)
    let attachment: { name: string; mime: string; b64: string } | null = null;
    if (tr.minute_file_path) {
      const { data: file, error: dlErr } = await sb.storage
        .from("minutas")
        .download(tr.minute_file_path);
      if (dlErr) console.error("Erro ao baixar minuta:", dlErr);
      else if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        attachment = {
          name: tr.minute_file_name ?? "minuta.pdf",
          mime: file.type || "application/octet-stream",
          b64: b64FromBytes(buf),
        };
      }
    }

    const subject = `Minuta para validação — ${tr.agency_name} — ${tr.property_code}`;
    const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    let rfc2822: string;
    if (attachment) {
      const boundary = `bnd_${crypto.randomUUID()}`;
      // Quebra base64 do anexo em linhas de 76 chars (RFC 2045)
      const attB64 = attachment.b64.match(/.{1,76}/g)?.join("\r\n") ?? attachment.b64;
      rfc2822 = [
        `To: ${recipients.join(", ")}`,
        `Subject: ${subjectEncoded}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        bodyText,
        "",
        `--${boundary}`,
        `Content-Type: ${attachment.mime}; name="${attachment.name}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${attachment.name}"`,
        "",
        attB64,
        "",
        `--${boundary}--`,
      ].join("\r\n");
    } else {
      rfc2822 = [
        `To: ${recipients.join(", ")}`,
        `Subject: ${subjectEncoded}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        bodyText,
      ].join("\r\n");
    }

    const raw = attachment
      ? b64urlFromBytes(new TextEncoder().encode(rfc2822))
      : b64urlFromString(rfc2822);

    const gmailRes = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAIL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const gmailJson = await gmailRes.json();
    if (!gmailRes.ok) throw new Error(`Gmail [${gmailRes.status}]: ${JSON.stringify(gmailJson)}`);

    // ---- WhatsApp ao(s) gerente(s) da agência ----
    let whatsappResults: any[] = [];
    try {
      const { data: gerentes } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "gerente");
      const userIds = (gerentes ?? []).map((g: any) => g.user_id);
      const { data: profs } = userIds.length
        ? await sb.from("profiles").select("id, phone, agency_id").in("id", userIds).eq("agency_id", tr.agency_id ?? "")
        : { data: [] as any[] };
      const phones = (profs ?? [])
        .map((p: any) => String(p.phone ?? "").replace(/\D/g, ""))
        .filter((p: string) => p.length >= 12);

      // E-mail real da agência (ignora override de teste para casar com o que aparece no template)
      const agencyEmail = (AGENCY_EMAILS[tr.agency_id ?? ""] ?? [])[0] ?? "—";

      // Template HSM aprovado: notificacao_minuta_para_validacao (9 vars)
      // Ordem real das variáveis {{1}}..{{9}} no corpo do template (validada em produção):
      const templateParams = [
        tr.uf ?? "—",                       // {{1}} UF
        tr.property_code ?? "—",            // {{2}} Código do imóvel
        tr.property_registration ?? "—",    // {{3}} Matrícula
        dataFmt,                            // {{4}} Data
        horario,                            // {{5}} Horário
        status ?? "Pendente de validação",  // {{6}} Status
        tr.notary_office_name ?? "—",       // {{7}} Cartório
        tr.agency_name ?? "—",              // {{8}} Agência
        agencyEmail,                        // {{9}} E-mail da agência destinatária
      ];
      const chatappLicenseId = Deno.env.get("CHATAPP_CLIENT_LICENSE_ID") ?? Deno.env.get("CHATAPP_LICENSE_ID");
      for (const digits of phones) {
        const chatId = `${digits}@c.us`;
        const r = await fetch(`${SUPABASE_URL}/functions/v1/enviar-mensagem-chatapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
          body: JSON.stringify({
            type: "template",
            template: { id: "1915885342238011", language: "pt_BR", params: templateParams },
            chatId,
            messengerType: "caWhatsApp",
            ...(chatappLicenseId ? { licenseId: Number(chatappLicenseId) } : {}),
            related_type: "minuta_validacao_gerente",
            related_id: tr.id,
            agency_id: tr.agency_id,
          }),
        });
        const j = await r.json().catch(() => ({}));
        whatsappResults.push({ chatId, ok: r.ok && j?.success, status: r.status, body: j });
      }
    } catch (e) {
      console.error("Falha ao notificar gerente via WhatsApp:", e);
    }

    return new Response(
      JSON.stringify({ success: true, recipients, attached: !!attachment, whatsapp: whatsappResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("enviar-minuta-validacao error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
