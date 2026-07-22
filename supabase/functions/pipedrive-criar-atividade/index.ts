// Cria atividade no Pipedrive quando o gerente anexa minuta validada
// ou contrato assinado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPEDRIVE_DOMAIN = "smartleiloes.pipedrive.com";
const ACTIVITY_TYPE_KEY = "escritura";
const ACTIVITY_SUBJECT = "Acompanhar assinatura do contrato";
const ACTIVITY_NOTE =
  "Verificar se o cliente já assinou o contrato e atualizar o andamento no pipe.";

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
    const TOKEN = Deno.env.get("PIPEDRIVE_TOKEN");
    if (!TOKEN) throw new Error("PIPEDRIVE_TOKEN ausente");

    const { propertyCode, clientName, trigger } = await req.json();
    if (!propertyCode || !clientName) {
      throw new Error("propertyCode e clientName são obrigatórios");
    }

    const base = `https://${PIPEDRIVE_DOMAIN}/api/v1`;

    // 1. Buscar deals que contenham o código do imóvel no título
    const searchUrl =
      `${base}/deals/search?term=${encodeURIComponent(propertyCode)}` +
      `&fields=title&exact_match=false&api_token=${TOKEN}`;
    const sRes = await fetch(searchUrl);
    const sJson = await sRes.json();
    if (!sRes.ok || !sJson?.success) {
      throw new Error(`Pipedrive search [${sRes.status}]: ${JSON.stringify(sJson)}`);
    }
    const items = sJson?.data?.items ?? [];
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, reason: "nenhum negócio encontrado", propertyCode }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Validar título: ignora estado e cidade (campos 0 e 1),
    //    valida código (campo 2) e primeiro nome do cliente (campo 3).
    const targetCode = norm(propertyCode);
    const targetFirst = firstName(clientName);

    let match: any = null;
    for (const it of items) {
      const title: string = it?.item?.title ?? "";
      const parts = title.split(",").map((p: string) => p.trim());
      if (parts.length < 4) continue;
      const codePart = norm(parts[2]);
      const clientFirst = firstName(parts[3]);
      if (codePart === targetCode && clientFirst === targetFirst) {
        match = it.item;
        break;
      }
    }

    if (!match) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "código e cliente não bateram com nenhum título encontrado",
          tried: items.map((i: any) => i?.item?.title),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Buscar detalhes do deal para pegar o user_id (proprietário)
    const dealId = match.id;
    const dRes = await fetch(`${base}/deals/${dealId}?api_token=${TOKEN}`);
    const dJson = await dRes.json();
    if (!dRes.ok || !dJson?.success) {
      throw new Error(`Pipedrive deal [${dRes.status}]: ${JSON.stringify(dJson)}`);
    }
    const ownerId =
      dJson?.data?.user_id?.id ??
      dJson?.data?.user_id ??
      match?.owner?.id ??
      null;

    // 4. Criar atividade
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const activityBody: Record<string, unknown> = {
      subject: ACTIVITY_SUBJECT,
      type: ACTIVITY_TYPE_KEY,
      due_date: today,
      deal_id: dealId,
      priority: 27, // High (id da conta smartleiloes)
      note: ACTIVITY_NOTE,
      done: 0,
    };
    if (ownerId) activityBody.user_id = ownerId;

    const aRes = await fetch(`${base}/activities?api_token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activityBody),
    });
    const aJson = await aRes.json();
    if (!aRes.ok || !aJson?.success) {
      throw new Error(`Pipedrive activity [${aRes.status}]: ${JSON.stringify(aJson)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dealId,
        ownerId,
        activityId: aJson?.data?.id,
        title: match?.title,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("pipedrive-criar-atividade error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
