// Edge function: ações administrativas sobre usuários.
// Apenas administradores autenticados podem chamar.
// Ações: list, create, update, set_active, delete
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "parceiro" | "gerente" | "admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Não autenticado." }, 401);
    const caller = userRes.user;

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Apenas administradores podem executar esta ação." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === "list") {
      // Lista todos os usuários combinando auth.users + profiles + user_roles
      const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (lErr) return json({ error: lErr.message }, 400);

      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("id, full_name, agency_id, notary_office_name, uf, is_active, created_at, phone").in("id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const rMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));

      const users = list.users.map((u) => {
        const p: any = pMap.get(u.id) ?? {};
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: (u as any).last_sign_in_at ?? null,
          email_confirmed_at: (u as any).email_confirmed_at ?? null,
          phone: p.phone ?? (u as any).phone ?? null,
          full_name: p.full_name ?? "",
          role: rMap.get(u.id) ?? null,
          agency_id: p.agency_id ?? null,
          notary_office_name: p.notary_office_name ?? null,
          uf: p.uf ?? null,
          is_active: p.is_active ?? true,
        };
      });
      return json({ users });
    }

    if (action === "create") {
      const { email, password, full_name, role, agency_id, notary_office_name, uf, phone } = body ?? {};
      if (!email || !password || !full_name || !role) return json({ error: "Campos obrigatórios faltando." }, 400);
      if (String(password).length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres." }, 400);
      if (role === "gerente" && !agency_id) return json({ error: "Agência obrigatória para gerente." }, 400);
      if (phone && !/^55\d{10,11}$/.test(String(phone))) return json({ error: "Telefone inválido. Use 55 + DDD + número (somente dígitos)." }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: {
          full_name, role,
          phone: phone ?? "",
          agency_id: role === "gerente" ? agency_id : "",
          notary_office_name: role === "parceiro" ? (notary_office_name ?? "") : "",
          uf: role === "parceiro" ? (uf ?? "") : "",
        },
      });
      if (cErr || !created.user) return json({ error: cErr?.message ?? "Falha ao criar." }, 400);

      // Garante a role correta (caso o trigger tenha definido outra)
      await admin.from("user_roles").delete().eq("user_id", created.user.id);
      await admin.from("user_roles").insert({ user_id: created.user.id, role });

      await admin.from("admin_audit_logs").insert({
        actor_id: caller.id, actor_email: caller.email,
        action: "create_user", target_type: "user", target_id: created.user.id,
        details: { email, role },
      });
      return json({ ok: true, user_id: created.user.id });
    }

    if (action === "update") {
      const { user_id, full_name, email, password, role, agency_id, notary_office_name, uf, phone } = body ?? {};
      if (!user_id) return json({ error: "user_id obrigatório." }, 400);
      if (phone !== undefined && phone !== null && phone !== "" && !/^55\d{10,11}$/.test(String(phone))) {
        return json({ error: "Telefone inválido. Use 55 + DDD + número (somente dígitos)." }, 400);
      }

      // Atualiza auth (email/senha)
      const authPatch: any = {};
      if (email) authPatch.email = email;
      if (password) {
        if (String(password).length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres." }, 400);
        authPatch.password = password;
      }
      if (Object.keys(authPatch).length) {
        const { error: aErr } = await admin.auth.admin.updateUserById(user_id, authPatch);
        if (aErr) return json({ error: aErr.message }, 400);
      }

      // Atualiza profile
      const profPatch: any = {};
      if (full_name !== undefined) profPatch.full_name = full_name;
      if (agency_id !== undefined) profPatch.agency_id = agency_id || null;
      if (notary_office_name !== undefined) profPatch.notary_office_name = notary_office_name || null;
      if (uf !== undefined) profPatch.uf = uf || null;
      if (phone !== undefined) profPatch.phone = phone || null;
      if (Object.keys(profPatch).length) {
        const { error: pErr } = await admin.from("profiles").update(profPatch).eq("id", user_id);
        if (pErr) return json({ error: pErr.message }, 400);
      }

      // Atualiza role
      if (role) {
        await admin.from("user_roles").delete().eq("user_id", user_id);
        const { error: rErr } = await admin.from("user_roles").insert({ user_id, role });
        if (rErr) return json({ error: rErr.message }, 400);
      }

      await admin.from("admin_audit_logs").insert({
        actor_id: caller.id, actor_email: caller.email,
        action: "update_user", target_type: "user", target_id: user_id,
        details: { fields: Object.keys({ ...authPatch, ...profPatch, ...(role ? { role } : {}) }) },
      });
      return json({ ok: true });
    }

    if (action === "set_active") {
      const { user_id, is_active } = body ?? {};
      if (!user_id || typeof is_active !== "boolean") return json({ error: "Parâmetros inválidos." }, 400);
      if (user_id === caller.id && !is_active) return json({ error: "Você não pode desativar o próprio usuário." }, 400);

      const { error: pErr } = await admin.from("profiles").update({ is_active }).eq("id", user_id);
      if (pErr) return json({ error: pErr.message }, 400);

      // Banir/desbanir no auth para forçar logoff e impedir login
      const { error: bErr } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: is_active ? "none" : "876000h", // ~100 anos
      } as any);
      if (bErr) return json({ error: bErr.message }, 400);

      await admin.from("admin_audit_logs").insert({
        actor_id: caller.id, actor_email: caller.email,
        action: is_active ? "activate_user" : "deactivate_user",
        target_type: "user", target_id: user_id,
      });
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = body ?? {};
      if (!user_id) return json({ error: "user_id obrigatório." }, 400);
      if (user_id === caller.id) return json({ error: "Você não pode excluir o próprio usuário." }, 400);

      const { error: dErr } = await admin.auth.admin.deleteUser(user_id);
      if (dErr) return json({ error: dErr.message }, 400);
      await admin.from("profiles").delete().eq("id", user_id);
      await admin.from("user_roles").delete().eq("user_id", user_id);

      await admin.from("admin_audit_logs").insert({
        actor_id: caller.id, actor_email: caller.email,
        action: "delete_user", target_type: "user", target_id: user_id,
      });
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
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
