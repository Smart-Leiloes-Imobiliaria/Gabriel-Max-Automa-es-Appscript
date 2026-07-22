// Envia mensagens individuais via ChatApp - WhatsApp Cloud API (caWhatsApp).
// Suporta texto livre, arquivos e templates HSM aprovados pela Meta.
//
// Body aceito:
// {
//   type?: "text" | "file" | "files" | "template"   // default: "text"
//   text?: string                        // para type=text ou caption para arquivos
//   files?: [{ name: string, mime?: string, base64: string }]
//   template?: { id: string, language?: string, params: string[] }  // para type=template
//   chatId: string                       // OBRIGATÓRIO - ex.: "5531999999999@c.us"
//   licenseId?: number                   // default: env CHATAPP_CLIENT_LICENSE_ID
//   messengerType?: string               // default: env CHATAPP_MESSENGER_ID ou "caWhatsApp"
//   related_type?: string, related_id?: string, agency_id?: string
// }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHATAPP_API = "https://api.chatapp.online/v1";

// Credenciais do cabinet (vindas de secrets — NUNCA hardcoded)
const EMAIL = Deno.env.get("CHATAPP_API_EMAIL") ?? "";
const PASSWORD = Deno.env.get("CHATAPP_API_PASSWORD") ?? "";
const APP_ID = Deno.env.get("CHATAPP_APP_ID") ?? "";

async function login(): Promise<string> {
  if (!EMAIL || !PASSWORD || !APP_ID) {
    throw new Error("ChatApp credenciais ausentes (CHATAPP_API_EMAIL/PASSWORD/APP_ID).");
  }
  const r = await fetch(`${CHATAPP_API}/tokens`, {
    method: "POST",
    headers: { "Lang": "en", "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, appId: APP_ID }),
  });
  const j = await r.json();
  if (!r.ok || !j?.success) throw new Error(`ChatApp login failed: ${JSON.stringify(j)}`);
  return j.data.accessToken as string;
}

async function sendText(token: string, licenseId: number, messengerType: string, chatId: string, text: string) {
  const url = `${CHATAPP_API}/licenses/${licenseId}/messengers/${messengerType}/chats/${encodeURIComponent(chatId)}/messages/text`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Lang": "en", "Authorization": token, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const txt = await r.text();
  let body: any; try { body = JSON.parse(txt); } catch { body = txt; }
  return { ok: r.ok, status: r.status, body, url };
}

async function sendTemplate(
  token: string, licenseId: number, messengerType: string, chatId: string,
  template: { id: string; language?: string; params: string[] }
) {
  const url = `${CHATAPP_API}/licenses/${licenseId}/messengers/${messengerType}/chats/${encodeURIComponent(chatId)}/messages/template`;
  const body = {
    template: {
      id: template.id,
      language: template.language ?? "pt_BR",
      params: template.params,
    },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Lang": "en", "Authorization": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let resp: any; try { resp = JSON.parse(txt); } catch { resp = txt; }
  return { ok: r.ok, status: r.status, body: resp, url };
}

async function sendFile(
  token: string, licenseId: number, messengerType: string, chatId: string,
  file: { name: string; mime?: string; base64: string }, caption?: string
) {
  const url = `${CHATAPP_API}/licenses/${licenseId}/messengers/${messengerType}/chats/${encodeURIComponent(chatId)}/messages/file`;
  const bin = atob(file.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: file.mime || "application/octet-stream" });
  const fd = new FormData();
  fd.append("file", blob, file.name);
  if (caption) fd.append("text", caption);
  const r = await fetch(url, {
    method: "POST",
    headers: { "Lang": "en", "Authorization": token },
    body: fd,
  });
  const txt = await r.text();
  let body: any; try { body = JSON.parse(txt); } catch { body = txt; }
  return { ok: r.ok, status: r.status, body, url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- AUTH CHECK (user JWT ou chamada interna entre edge functions) ----
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
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const type: "text" | "file" | "files" | "template" = body.type ?? "text";
    const text: string | undefined = body.text;
    const files: Array<{ name: string; mime?: string; base64: string }> = body.files ?? [];
    const template: { id: string; language?: string; params: string[] } | undefined = body.template;

    const envLicense = Deno.env.get("CHATAPP_CLIENT_LICENSE_ID") ?? Deno.env.get("CHATAPP_LICENSE_ID");
    const licenseId: number = body.licenseId ?? (envLicense ? Number(envLicense) : NaN);
    const messengerType: string = body.messengerType ?? "caWhatsApp";
    const chatId: string | undefined = body.chatId;

    if (!chatId || !chatId.includes("@c.us")) {
      throw new Error("chatId é obrigatório (formato individual: 55XXXXXXXXXXX@c.us).");
    }
    if (!Number.isFinite(licenseId)) {
      throw new Error("licenseId não configurado (defina CHATAPP_CLIENT_LICENSE_ID).");
    }
    if (type === "text" && (!text || !text.trim())) {
      throw new Error("text é obrigatório para type=text");
    }
    if ((type === "file" || type === "files") && files.length === 0) {
      throw new Error("files é obrigatório para type=file/files");
    }
    if (type === "template" && (!template?.id || !Array.isArray(template.params))) {
      throw new Error("template.id e template.params são obrigatórios para type=template");
    }

    const token = await login();
    const results: any[] = [];

    if (type === "text") {
      results.push(await sendText(token, licenseId, messengerType, chatId, text!));
    } else if (type === "template") {
      results.push(await sendTemplate(token, licenseId, messengerType, chatId, template!));
    } else {
      if (text && text.trim()) {
        results.push(await sendText(token, licenseId, messengerType, chatId, text));
      }
      for (const f of files) {
        results.push(await sendFile(token, licenseId, messengerType, chatId, f));
      }
    }

    const allOk = results.every((r) => r.ok);
    const errors = results.filter((r) => !r.ok).map((r) => r.body);

    try {
      await sb.from("notification_logs").insert({
        related_type: body.related_type ?? "chatapp",
        related_id: body.related_id ?? null,
        agency_id: body.agency_id ?? null,
        channel: "whatsapp",
        status: allOk ? "sent" : "failed",
        message: `[CHATAPP] chat=${chatId} type=${type}${text ? ` • "${text.slice(0, 120)}"` : ""}${template ? ` • tpl=${template.id}` : ""}${errors.length ? ` • Erro: ${JSON.stringify(errors).slice(0, 500)}` : ""}`,
      });
    } catch (e) {
      console.error("notification_logs insert error:", e);
    }

    return new Response(
      JSON.stringify({ success: allOk, chatId, licenseId, messengerType, results }),
      { status: allOk ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("enviar-mensagem-chatapp error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
