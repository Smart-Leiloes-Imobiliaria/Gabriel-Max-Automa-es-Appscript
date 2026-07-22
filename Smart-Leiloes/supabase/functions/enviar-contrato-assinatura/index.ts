// Envia email para a gerente quando uma tratativa de "Assinatura do contrato"
// é finalizada, com o contrato anexado.
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
function b64urlFromString(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s));
}

function buildBody(d: {
  notary: string; agency: string; uf: string;
  propertyCode: string; propertyRegistration: string;
  data: string; horario: string;
}) {
  return [
    "CONTRATO PENDENTE ASSINATURA",
    "",
    `Cartório responsável pelo agendamento: ${d.notary}`,
    `Agência responsável: ${d.agency}`,
    `UF: ${d.uf}    Código do imóvel: ${d.propertyCode}`,
    `Matricula do imóvel: ${d.propertyRegistration}`,
    `Data: ${d.data}    Horário: ${d.horario}`,
    "",
    "ATENÇÃO GERENTE: O contrato deverá ser assinado no prazo de até 24 horas para não ocorrer um novo escalonamento.",
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

    const created = new Date(tr.created_at);
    const horario = created.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
    });
    const dataFmt = new Date(`${tr.minute_sent_at}T00:00:00`).toLocaleDateString("pt-BR");

    const bodyText = buildBody({
      notary: tr.notary_office_name ?? "—",
      agency: tr.agency_name ?? "—",
      uf: tr.uf,
      propertyCode: tr.property_code,
      propertyRegistration: tr.property_registration ?? "—",
      data: dataFmt,
      horario,
    });

    let attachment: { name: string; mime: string; b64: string } | null = null;
    if (tr.contract_file_path) {
      const { data: file, error: dlErr } = await sb.storage
        .from("minutas")
        .download(tr.contract_file_path);
      if (dlErr) console.error("Erro ao baixar contrato:", dlErr);
      else if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        attachment = {
          name: tr.contract_file_name ?? "contrato.pdf",
          mime: file.type || "application/octet-stream",
          b64: b64FromBytes(buf),
        };
      }
    }

    const subject = `Contrato pendente assinatura — ${tr.agency_name} — ${tr.property_code}`;
    const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    let rfc2822: string;
    if (attachment) {
      const boundary = `bnd_${crypto.randomUUID()}`;
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
    const gmailJson = await gmailRes.json();
    if (!gmailRes.ok) throw new Error(`Gmail [${gmailRes.status}]: ${JSON.stringify(gmailJson)}`);

    // ---- WhatsApp ao(s) gerente(s) da agência (template HSM) ----
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

      const templateParams = [
        tr.notary_office_name ?? "—",
        tr.agency_name ?? "—",
        tr.uf ?? "—",
        tr.property_code ?? "—",
        tr.property_registration ?? "—",
        dataFmt,
        horario,
        "Pendente de validação"
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
            related_type: "contrato_validacao_gerente",
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
    console.error("enviar-contrato-assinatura error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
