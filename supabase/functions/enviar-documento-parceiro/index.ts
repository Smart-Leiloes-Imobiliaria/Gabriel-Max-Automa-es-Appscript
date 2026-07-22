// Envia email ao parceiro responsável quando o gerente anexa e envia
// a minuta validada ou o contrato assinado, com o arquivo em anexo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

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

function buildBody(kind: "minuta" | "contrato", d: {
  notary: string; agency: string; uf: string;
  propertyCode: string; propertyRegistration: string;
}) {
  if (kind === "minuta") {
    return [
      "MINUTA VALIDADA",
      `Cartório responsável pelo agendamento: ${d.notary}`,
      `Agência responsável: ${d.agency}`,
      `UF: ${d.uf}`,
      `Código do imóvel: ${d.propertyCode}`,
      `Matrícula do imóvel: ${d.propertyRegistration}`,
      "Status: Minuta validada",
      "",
      "🔻Acesse a plataforma para ter acesso a minuta!🔻",
    ].join("\r\n");
  }
  return [
    "CONTRATO ASSINADO",
    `Cartório responsável pelo agendamento: ${d.notary}`,
    `Agência responsável: ${d.agency}`,
    `UF: ${d.uf}`,
    `Código do imóvel: ${d.propertyCode}`,
    `Matrícula do imóvel: ${d.propertyRegistration}`,
    "Status: Contrato assinado",
    "",
    "🔻Acesse a plataforma para ter acesso ao contrato!🔻",
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

    const { treatment_id, doc_type, manager_id } = await req.json();
    if (!treatment_id) throw new Error("treatment_id é obrigatório");
    if (doc_type !== "minuta" && doc_type !== "contrato")
      throw new Error("doc_type inválido (esperado 'minuta' ou 'contrato')");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: tr, error: selErr } = await sb
      .from("property_treatments")
      .select("*")
      .eq("id", treatment_id)
      .single();
    if (selErr || !tr) throw new Error(`Tratativa não encontrada: ${selErr?.message}`);

    if (!tr.owner_id) {
      await sb.from("notification_logs").insert({
        related_type: "treatment", related_id: treatment_id,
        agency_id: tr.agency_id ?? "—", status: "error",
        message: `Falha envio ${doc_type}: parceiro não vinculado à tratativa ${tr.protocol}`,
      });
      throw new Error("Parceiro não encontrado para esta tratativa.");
    }

    // Resolve email do parceiro via auth.users
    const { data: userRes, error: userErr } = await sb.auth.admin.getUserById(tr.owner_id);
    if (userErr) throw new Error(`Erro ao buscar parceiro: ${userErr.message}`);
    const partnerEmail = userRes?.user?.email ?? null;
    if (!partnerEmail) {
      await sb.from("notification_logs").insert({
        related_type: "treatment", related_id: treatment_id,
        agency_id: tr.agency_id ?? "—", status: "error",
        message: `Falha envio ${doc_type}: e-mail do parceiro não cadastrado (protocolo ${tr.protocol})`,
      });
      throw new Error("E-mail do parceiro está ausente. Envio bloqueado.");
    }

    const recipients: string[] = [partnerEmail];

    const filePath = doc_type === "minuta" ? tr.manager_minute_file_path : tr.manager_contract_file_path;
    const fileName = doc_type === "minuta" ? tr.manager_minute_file_name : tr.manager_contract_file_name;
    if (!filePath) throw new Error(`Nenhum arquivo de ${doc_type} anexado pelo gerente.`);

    const { data: file, error: dlErr } = await sb.storage.from("minutas").download(filePath);
    if (dlErr || !file) throw new Error(`Falha ao baixar arquivo: ${dlErr?.message}`);
    const buf = new Uint8Array(await file.arrayBuffer());
    const attachment = {
      name: fileName ?? (doc_type === "minuta" ? "minuta.pdf" : "contrato.pdf"),
      mime: file.type || "application/octet-stream",
      b64: b64FromBytes(buf),
    };

    const bodyText = buildBody(doc_type, {
      notary: tr.notary_office_name ?? "—",
      agency: tr.agency_name ?? "—",
      uf: tr.uf,
      propertyCode: tr.property_code,
      propertyRegistration: tr.property_registration ?? "—",
    });

    const subject = doc_type === "minuta"
      ? `Minuta validada — ${tr.agency_name} — ${tr.property_code}`
      : `Contrato assinado — ${tr.agency_name} — ${tr.property_code}`;
    const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    const boundary = `bnd_${crypto.randomUUID()}`;
    const attB64 = attachment.b64.match(/.{1,76}/g)?.join("\r\n") ?? attachment.b64;
    const rfc2822 = [
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
    const ok = gmailRes.ok;

    // Log no histórico
    await sb.from("notification_logs").insert({
      related_type: "treatment", related_id: treatment_id,
      agency_id: tr.agency_id ?? "—",
      status: ok ? "sent" : "error",
      channel: "email",
      message: [
        ok ? "Documento enviado ao parceiro" : "Falha ao enviar documento ao parceiro",
        `Tipo: ${doc_type === "minuta" ? "Minuta validada" : "Contrato assinado"}`,
        `Parceiro: ${partnerEmail}`,
        `Destinatário(s): ${recipients.join(", ")}`,
        `Gerente: ${manager_id ?? "—"}`,
        `Protocolo: ${tr.protocol}`,
        `Arquivo: ${attachment.name}`,
        `Quando: ${new Date().toISOString()}`,
        ok ? "" : `Erro: ${JSON.stringify(gmailJson)}`,
      ].filter(Boolean).join("\n"),
    });

    if (!ok) throw new Error(`Gmail [${gmailRes.status}]: ${JSON.stringify(gmailJson)}`);

    return new Response(
      JSON.stringify({ success: true, recipients, partner_email: partnerEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("enviar-documento-parceiro error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
