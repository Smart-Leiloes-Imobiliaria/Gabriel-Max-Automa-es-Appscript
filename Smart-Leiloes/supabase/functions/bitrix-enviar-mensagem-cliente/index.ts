// Envia mensagem ao chat (Open Channel) do cliente no Bitrix24.
//
// Fluxo (inspirado no Apps Script de referência):
//   1. Recebe { propertyCode, clientName, message, related_id?, agency_id? }
//   2. Busca o negócio no Pipedrive pelo código do imóvel
//   3. Lê o campo customizado "Link do Chat no Bitrix"
//      (key: 28e30197984d8556b1e6b2a25d9df8c548926ec2)
//   4. Extrai CHAT_ID / DIALOG_ID
//   5. Verifica se há sessão Open Lines aberta (imopenlines.dialog.get)
//   6. Se não houver, abre uma sessão temporária (imopenlines.session.start)
//   7. Envia via imopenlines.crm.message.add (fallback: im.message.add)
//   8. Se a sessão foi aberta agora, encerra (imopenlines.operator.finish)
//   9. Registra resultado em notification_logs

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_DOMAIN = "smartleiloes.pipedrive.com";
const BITRIX_CHAT_FIELD_KEY = "28e30197984d8556b1e6b2a25d9df8c548926ec2";

function firstName(name: string) {
  return (name ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}
function norm(s: string) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function extractDialogId(link: string): string | null {
  if (!link) return null;
  let text = String(link);
  try { text = decodeURIComponent(text); } catch (_) { /* noop */ }
  const m = text.match(/chat\d+/i);
  return m ? m[0].toLowerCase() : null;
}

function extractChatId(link: string, dialogId: string | null): number {
  if (dialogId) {
    const m = dialogId.match(/^chat(\d+)$/i);
    if (m) return Number(m[1]) || 0;
  }
  let text = String(link || "");
  try { text = decodeURIComponent(text); } catch (_) { /* noop */ }
  const m = text.match(/[?&#](?:CHAT_ID|chat_id)=(\d+)/i);
  if (m) return Number(m[1]) || 0;
  return 0;
}

function parseSessionId(entityData1: any): number {
  const parts = String(entityData1 ?? "").split("|").map((p) => p.trim());
  if (parts.length > 5) {
    const direct = parseInt(parts[5], 10);
    if (Number.isFinite(direct)) return direct;
  }
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

function webhookUserIdFromBase(base: string): number {
  const m = String(base || "").match(/\/rest\/(\d+)\//i);
  return m && m[1] ? Number(m[1]) || 0 : 0;
}

async function bitrixCall(webhookBase: string, method: string, payload: Record<string, unknown>) {
  const base = webhookBase.endsWith("/") ? webhookBase : `${webhookBase}/`;
  const url = `${base}${method.replace(/^\/+/, "")}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {
    throw new Error(`Bitrix ${method} JSON inválido (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok || json?.error) {
    const err = json?.error_description || json?.error || text;
    const e: any = new Error(`Bitrix ${method} [${res.status}]: ${String(err).slice(0, 400)}`);
    e.bitrix = json;
    e.status = res.status;
    throw e;
  }
  return Object.prototype.hasOwnProperty.call(json, "result") ? json.result : json;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { console.warn("safe() ignored:", (e as any)?.message ?? e); return null; }
}

async function logNotification(
  sb: any,
  fields: { status: string; message: string; related_id: string; related_type: string; agency_id: string },
) {
  try {
    await sb.from("notification_logs").insert({ channel: "bitrix_chat", ...fields });
  } catch (e) {
    console.error("notification_logs insert error:", e);
  }
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
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  let payload: any = {};
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const propertyCode: string = payload?.propertyCode ?? "";
  const clientName: string = payload?.clientName ?? "";
  const message: string = payload?.message ?? "";
  const related_id: string = payload?.related_id ?? "";
  const related_type: string = payload?.related_type ?? "video_conference_bitrix";
  const agency_id: string = payload?.agency_id ?? "";

  const logBase = { related_id, related_type, agency_id };

  try {
    if (!propertyCode || !clientName || !message) {
      throw new Error("propertyCode, clientName e message são obrigatórios");
    }

    const TOKEN = Deno.env.get("PIPEDRIVE_TOKEN");
    const WEBHOOK = Deno.env.get("BITRIX_WEBHOOK_URL");
    if (!TOKEN) throw new Error("PIPEDRIVE_TOKEN ausente");
    if (!WEBHOOK) throw new Error("BITRIX_WEBHOOK_URL ausente");

    const base = `https://${PIPEDRIVE_DOMAIN}/api/v1`;

    // 1. Buscar negócio
    const sRes = await fetch(
      `${base}/deals/search?term=${encodeURIComponent(propertyCode)}&fields=title&exact_match=false&api_token=${TOKEN}`,
    );
    const sJson = await sRes.json();
    if (!sRes.ok || !sJson?.success) {
      throw new Error(`Pipedrive search [${sRes.status}]: ${JSON.stringify(sJson).slice(0, 300)}`);
    }
    const items = sJson?.data?.items ?? [];
    if (items.length === 0) {
      const errMsg = `Negócio não encontrado no Pipedrive para o código ${propertyCode}`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({ success: false, stage: "pipedrive_search", reason: errMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Validar título
    const targetCode = norm(propertyCode);
    const targetFirst = firstName(clientName);
    let match: any = null;
    for (const it of items) {
      const title: string = it?.item?.title ?? "";
      const parts = title.split(",").map((p: string) => p.trim());
      if (parts.length < 4) continue;
      if (norm(parts[2]) === targetCode && firstName(parts[3]) === targetFirst) {
        match = it.item;
        break;
      }
    }
    if (!match) {
      const errMsg = `Negócio encontrado, mas código + cliente não bateram (${propertyCode} / ${clientName})`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({
        success: false, stage: "pipedrive_match", reason: errMsg,
        tried: items.map((i: any) => i?.item?.title),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Detalhes do deal
    const dealId = match.id;
    const dRes = await fetch(`${base}/deals/${dealId}?api_token=${TOKEN}`);
    const dJson = await dRes.json();
    if (!dRes.ok || !dJson?.success) {
      throw new Error(`Pipedrive deal [${dRes.status}]: ${JSON.stringify(dJson).slice(0, 300)}`);
    }
    const chatLink: string = String(dJson?.data?.[BITRIX_CHAT_FIELD_KEY] ?? "").trim();
    const ownerHint = Number(dJson?.data?.user_id?.id ?? dJson?.data?.user_id ?? 0) || 0;

    if (!chatLink) {
      const errMsg = `Negócio ${dealId} encontrado, mas o campo "Link do Chat no Bitrix" está vazio`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({ success: false, stage: "bitrix_link_missing", deal_id: dealId, reason: errMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dialogIdFromLink = extractDialogId(chatLink);
    let chatId = extractChatId(chatLink, dialogIdFromLink);
    if (!dialogIdFromLink && !chatId) {
      const errMsg = `Link do Bitrix em formato inválido: "${chatLink}"`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({
        success: false, stage: "bitrix_link_invalid", deal_id: dealId, link: chatLink, reason: errMsg,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Estado do diálogo
    const dialogParams: Record<string, unknown> = chatId
      ? { CHAT_ID: chatId }
      : { DIALOG_ID: dialogIdFromLink };

    const beforeDialog: any = await safe(() => bitrixCall(WEBHOOK, "imopenlines.dialog.get", dialogParams));
    if (beforeDialog?.id) chatId = Number(beforeDialog.id) || chatId;
    const dialogId = String(beforeDialog?.dialog_id || dialogIdFromLink || (chatId ? `chat${chatId}` : "")).trim();

    if (!chatId) {
      const errMsg = `Bitrix não retornou CHAT_ID para o diálogo informado (link "${chatLink}")`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({ success: false, stage: "bitrix_dialog_get", deal_id: dealId, reason: errMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sessionId = parseSessionId(beforeDialog?.entity_data_1);
    const wasOpen = sessionId > 0;
    const ownerBefore = Number(beforeDialog?.owner ?? 0) || 0;

    // 5. Abrir sessão se necessário
    let openedNow = false;
    if (!wasOpen) {
      await bitrixCall(WEBHOOK, "imopenlines.session.start", { CHAT_ID: chatId });
      openedNow = true;
      // operator.answer ajuda o crm.message.add a ter operador associado
      await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.answer", { CHAT_ID: chatId }));
    }

    // 6. Enviar — tenta crm.message.add com operadores candidatos, depois fallback im.message.add
    const webhookUid = webhookUserIdFromBase(WEBHOOK);
    const senderCandidates: number[] = [];
    for (const uid of [ownerBefore, webhookUid]) {
      if (uid > 0 && !senderCandidates.includes(uid)) senderCandidates.push(uid);
    }

    let sendMethod = "";
    let messageId = 0;
    let senderUsed = 0;
    let crmError = "";

    for (const uid of senderCandidates) {
      try {
        const r = await bitrixCall(WEBHOOK, "imopenlines.crm.message.add", {
          CRM_ENTITY_TYPE: "deal",
          CRM_ENTITY: dealId,
          USER_ID: uid,
          CHAT_ID: chatId,
          MESSAGE: message,
        });
        messageId = Number(r) || 0;
        sendMethod = "imopenlines.crm.message.add";
        senderUsed = uid;
        break;
      } catch (e: any) {
        crmError = e?.message ?? String(e);
      }
    }

    if (!sendMethod) {
      try {
        const r = await bitrixCall(WEBHOOK, "im.message.add", {
          DIALOG_ID: dialogId,
          MESSAGE: message,
          URL_PREVIEW: "N",
        });
        messageId = Number(r) || 0;
        sendMethod = "im.message.add";
        senderUsed = webhookUid;
      } catch (e: any) {
        // Encerra sessão temporária para não deixar lixo
        if (openedNow) await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.finish", { CHAT_ID: chatId }));
        const errMsg = `Falha ao enviar no Bitrix. crm.message.add=${crmError || "n/a"} | im.message.add=${e?.message ?? e}`;
        await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
        return new Response(JSON.stringify({
          success: false, stage: "bitrix_send", deal_id: dealId, chat_id: chatId, dialog_id: dialogId,
          crm_error: crmError, direct_error: e?.message ?? String(e),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 7. Se a sessão foi aberta agora, encerra
    let finished = false;
    if (openedNow) {
      finished = !!(await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.finish", { CHAT_ID: chatId })));
    }

    await logNotification(sb, {
      ...logBase,
      status: "sent",
      message: `Bitrix chat ${dialogId} (deal ${dealId}) via ${sendMethod} uid=${senderUsed} msgId=${messageId}: ${message.slice(0, 180)}`,
    });

    return new Response(JSON.stringify({
      success: true,
      deal_id: dealId,
      chat_id: chatId,
      dialog_id: dialogId,
      bitrix_message_id: messageId,
      send_method: sendMethod,
      sender_user_id: senderUsed,
      was_open: wasOpen,
      opened_now: openedNow,
      finished_after_send: finished,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const errMsg = `Erro inesperado: ${e?.message ?? String(e)}`;
    console.error("bitrix-enviar-mensagem-cliente:", errMsg);
    await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
