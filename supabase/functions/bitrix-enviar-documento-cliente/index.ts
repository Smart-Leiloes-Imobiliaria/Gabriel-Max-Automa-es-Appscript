// Envia um documento (minuta validada ou contrato assinado) ao chat do cliente no Bitrix24.
//
// Fluxo:
//   1. Recebe { propertyCode, clientName, documentType, filePath, fileName, related_id?, agency_id? }
//   2. Baixa o arquivo do bucket "minutas" via service role
//   3. Busca o negócio no Pipedrive pelo código do imóvel (mesmo match de código + cliente)
//   4. Lê o campo "Link do Chat no Bitrix" (28e30197984d8556b1e6b2a25d9df8c548926ec2)
//      e o nome do cliente em person_id.name
//   5. Extrai CHAT_ID / DIALOG_ID
//   6. Sobe o arquivo no Disco do Bitrix (disk.folder.uploadfile) e envia mensagem com anexo
//   7. Registra resultado em notification_logs (canal: bitrix_chat_doc)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_DOMAIN = "smartleiloes.pipedrive.com";
const BITRIX_CHAT_FIELD_KEY = "28e30197984d8556b1e6b2a25d9df8c548926ec2";

function firstName(name: string) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
function firstNameLower(name: string) {
  return firstName(name).toLowerCase();
}
function norm(s: string) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Saudação dinâmica em horário de Brasília (UTC-3)
function dynamicGreeting(): string {
  const nowUtc = new Date();
  const brtHour = (nowUtc.getUTCHours() - 3 + 24) % 24;
  if (brtHour >= 5 && brtHour < 12) return "Bom dia";
  if (brtHour >= 12 && brtHour < 18) return "Boa tarde";
  return "Boa noite";
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
    await sb.from("notification_logs").insert({ channel: "bitrix_chat_doc", ...fields });
  } catch (e) {
    console.error("notification_logs insert error:", e);
  }
}

// Converte ArrayBuffer -> base64 (sem estourar pilha para arquivos grandes)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
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
  const documentType: string = payload?.documentType ?? ""; // "minuta" | "contrato"
  const filePath: string = payload?.filePath ?? "";
  const fileName: string = payload?.fileName ?? "";
  const bucket: string = payload?.bucket ?? "minutas";
  const related_id: string = payload?.related_id ?? "";
  const related_type: string = payload?.related_type ?? "treatment_bitrix_doc";
  const agency_id: string = payload?.agency_id ?? "";

  const logBase = { related_id, related_type, agency_id };

  try {
    if (!propertyCode || !clientName || !documentType || !filePath) {
      throw new Error("propertyCode, clientName, documentType e filePath são obrigatórios");
    }
    if (documentType !== "minuta" && documentType !== "contrato") {
      throw new Error(`documentType inválido: "${documentType}" (esperado "minuta" ou "contrato")`);
    }

    const TOKEN = Deno.env.get("PIPEDRIVE_TOKEN");
    const WEBHOOK = Deno.env.get("BITRIX_WEBHOOK_URL");
    if (!TOKEN) throw new Error("PIPEDRIVE_TOKEN ausente");
    if (!WEBHOOK) throw new Error("BITRIX_WEBHOOK_URL ausente");

    // 0. Baixar arquivo do bucket
    const { data: fileBlob, error: dlErr } = await sb.storage.from(bucket).download(filePath);
    if (dlErr || !fileBlob) {
      const errMsg = `Documento anexado não pôde ser localizado para envio (bucket=${bucket} path=${filePath}): ${dlErr?.message ?? "arquivo ausente"}`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({ success: false, stage: "file_download", reason: errMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const fileBuf = await fileBlob.arrayBuffer();
    const fileB64 = arrayBufferToBase64(fileBuf);
    const resolvedFileName = (fileName && fileName.trim()) || filePath.split("/").pop() || `documento-${Date.now()}.pdf`;

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

    // 2. Validar título (código do imóvel + primeiro nome do cliente)
    const targetCode = norm(propertyCode);
    const targetFirst = firstNameLower(clientName);
    let match: any = null;
    for (const it of items) {
      const title: string = it?.item?.title ?? "";
      const parts = title.split(",").map((p: string) => p.trim());
      if (parts.length < 4) continue;
      if (norm(parts[2]) === targetCode && firstNameLower(parts[3]) === targetFirst) {
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

    // 3. Detalhes do deal: link do chat e nome do cliente
    const dealId = match.id;
    const dRes = await fetch(`${base}/deals/${dealId}?api_token=${TOKEN}`);
    const dJson = await dRes.json();
    if (!dRes.ok || !dJson?.success) {
      throw new Error(`Pipedrive deal [${dRes.status}]: ${JSON.stringify(dJson).slice(0, 300)}`);
    }
    const chatLink: string = String(dJson?.data?.[BITRIX_CHAT_FIELD_KEY] ?? "").trim();
    const pipedriveClientName: string = String(dJson?.data?.person_id?.name ?? "").trim();

    if (!chatLink) {
      const errMsg = `Negócio ${dealId} encontrado, mas o campo "Link do Chat no Bitrix" está vazio`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({ success: false, stage: "bitrix_link_missing", deal_id: dealId, reason: errMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dialogIdFromLink = extractDialogId(chatLink);
    let chatId = extractChatId(chatLink, dialogIdFromLink);
    if (!dialogIdFromLink && !chatId) {
      const errMsg = `Não foi possível extrair o ID do chat. Link do Bitrix em formato inválido: "${chatLink}"`;
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

    // 5. Abrir sessão se necessário
    let openedNow = false;
    if (!wasOpen) {
      await bitrixCall(WEBHOOK, "imopenlines.session.start", { CHAT_ID: chatId });
      openedNow = true;
      await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.answer", { CHAT_ID: chatId }));
    }

    // 6. Montar saudação e mensagem
    const greeting = dynamicGreeting();
    const greetingName = firstName(pipedriveClientName || clientName);
    const docLabel = documentType === "minuta"
      ? "a minuta validada"
      : "o contrato assinado";
    const message = `${greeting}, ${greetingName}! Segue ${docLabel} referente ao imóvel ${propertyCode}.`;

    // 7. Subir arquivo no Disco do Bitrix (pasta do app) e enviar como anexo
    //    disk.folder.uploadfile aceita fileContent como [filename, base64].
    const APP_FOLDER_ID = Number(Deno.env.get("BITRIX_DISK_FOLDER_ID") || 0);
    let uploadedFile: any = null;
    let uploadError = "";

    if (APP_FOLDER_ID > 0) {
      try {
        uploadedFile = await bitrixCall(WEBHOOK, "disk.folder.uploadfile", {
          id: APP_FOLDER_ID,
          data: { NAME: resolvedFileName },
          fileContent: [resolvedFileName, fileB64],
          generateUniqueName: true,
        });
      } catch (e: any) {
        uploadError = e?.message ?? String(e);
      }
    }

    // Fallback: pasta do app padrão (disk.storage.getlist -> app storage). Se não der, segue só com link.
    if (!uploadedFile) {
      try {
        const storages: any = await bitrixCall(WEBHOOK, "disk.storage.getlist", {
          filter: { ENTITY_TYPE: "user" },
        });
        const myStorage = Array.isArray(storages) && storages.length ? storages[0] : null;
        const rootFolderId = Number(myStorage?.ROOT_OBJECT_ID || 0);
        if (rootFolderId > 0) {
          uploadedFile = await bitrixCall(WEBHOOK, "disk.folder.uploadfile", {
            id: rootFolderId,
            data: { NAME: resolvedFileName },
            fileContent: [resolvedFileName, fileB64],
            generateUniqueName: true,
          });
        }
      } catch (e: any) {
        uploadError = uploadError || (e?.message ?? String(e));
      }
    }

    if (!uploadedFile?.ID) {
      if (openedNow) await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.finish", { CHAT_ID: chatId }));
      const errMsg = `Falha ao subir arquivo no Disco do Bitrix: ${uploadError || "sem detalhes"}`;
      await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
      return new Response(JSON.stringify({
        success: false, stage: "bitrix_disk_upload", deal_id: dealId, chat_id: chatId, reason: errMsg,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const diskFileId = Number(uploadedFile.ID);

    // 8. Enviar a mensagem + anexo via im.disk.file.commit (Open Channel friendly)
    let sendMethod = "";
    let messageId = 0;
    let sendError = "";

    try {
      const r = await bitrixCall(WEBHOOK, "im.disk.file.commit", {
        chat_id: chatId,
        upload_id: diskFileId,
        message: message,
      });
      messageId = Number(r) || 0;
      sendMethod = "im.disk.file.commit";
    } catch (e: any) {
      sendError = e?.message ?? String(e);
    }

    // Fallback: im.message.add com ATTACH apontando para arquivo do Disco
    if (!sendMethod) {
      try {
        const fileLink = uploadedFile.DOWNLOAD_URL || uploadedFile.DETAIL_URL || "";
        const attach = [{
          USER: { NAME: "Documento", AVATAR: "", LINK: "" },
          FILE: {
            NAME: resolvedFileName,
            LINK: fileLink,
            SIZE: Number(uploadedFile.SIZE || fileBuf.byteLength),
          },
        }];
        const r = await bitrixCall(WEBHOOK, "im.message.add", {
          DIALOG_ID: dialogId,
          MESSAGE: message,
          ATTACH: attach,
          URL_PREVIEW: "N",
        });
        messageId = Number(r) || 0;
        sendMethod = "im.message.add+ATTACH";
      } catch (e: any) {
        if (openedNow) await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.finish", { CHAT_ID: chatId }));
        const errMsg = `Falha ao enviar documento no Bitrix. im.disk.file.commit=${sendError || "n/a"} | im.message.add=${e?.message ?? e}`;
        await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
        return new Response(JSON.stringify({
          success: false, stage: "bitrix_send", deal_id: dealId, chat_id: chatId, dialog_id: dialogId,
          disk_file_id: diskFileId, commit_error: sendError, direct_error: e?.message ?? String(e),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 9. Se a sessão foi aberta agora, encerra
    let finished = false;
    if (openedNow) {
      finished = !!(await safe(() => bitrixCall(WEBHOOK, "imopenlines.operator.finish", { CHAT_ID: chatId })));
    }

    await logNotification(sb, {
      ...logBase,
      status: "sent",
      message: `Bitrix doc (${documentType}) chat ${dialogId} (deal ${dealId}) via ${sendMethod} msgId=${messageId} file=${resolvedFileName}`,
    });

    return new Response(JSON.stringify({
      success: true,
      deal_id: dealId,
      chat_id: chatId,
      dialog_id: dialogId,
      disk_file_id: diskFileId,
      bitrix_message_id: messageId,
      send_method: sendMethod,
      was_open: wasOpen,
      opened_now: openedNow,
      finished_after_send: finished,
      greeting_used: `${greeting}, ${greetingName}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const errMsg = `Erro inesperado: ${e?.message ?? String(e)}`;
    console.error("bitrix-enviar-documento-cliente:", errMsg);
    await logNotification(sb, { ...logBase, status: "erro", message: errMsg });
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
