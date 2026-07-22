// Edge function: cria um novo usuário com perfil admin.
// Pode ser chamada APENAS por um usuário autenticado que já seja admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    // Cliente para descobrir o usuário chamador
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Não autenticado." }, 401);
    const caller = userRes.user;

    // Service role para checar role e criar usuário
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Apenas administradores podem criar novos administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    const { email, password, full_name } = body ?? {};
    if (!email || !password || !full_name) return json({ error: "E-mail, senha e nome são obrigatórios." }, 400);
    if (String(password).length < 6) return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: "parceiro" }, // trigger cria role parceiro; ajustamos a seguir
    });
    if (cErr || !created.user) return json({ error: cErr?.message ?? "Falha ao criar usuário." }, 400);

    // Atualiza/insere role admin (substitui a role criada pelo trigger)
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    if (rErr) return json({ error: rErr.message }, 400);

    // Auditoria
    await admin.from("admin_audit_logs").insert({
      actor_id: caller.id,
      actor_email: caller.email,
      action: "create_admin",
      target_type: "user",
      target_id: created.user.id,
      details: { email, full_name },
    });

    return json({ ok: true, user_id: created.user.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
