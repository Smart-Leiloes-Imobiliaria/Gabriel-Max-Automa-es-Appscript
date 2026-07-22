import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Role } from "@/lib/auth";
import { getAllAgencies, BRAZIL_STATES } from "@/lib/agencies";
import { toast } from "sonner";
import { Briefcase, ShieldCheck, Crown, Home } from "lucide-react";
import logoAsset from "@/assets/smart-leiloes-logo.png.asset.json";
import styles from "./Auth.module.css";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const agencies = getAllAgencies();

  const [active, setActive] = useState(false); // false = login, true = register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("parceiro");
  const [agencyId, setAgencyId] = useState("");
  const [notaryOfficeName, setNotaryOfficeName] = useState("");
  const [uf, setUf] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState(false);

  const PHONE_REGEX = /^55\d{10,11}$/;

  useEffect(() => {
    supabase.rpc("admin_exists").then(({ data }) => setAdminExists(Boolean(data)));
  }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const uid = data.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", uid)
        .maybeSingle();
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        setBusy(false);
        return toast.error("Usuário inativo. Contate um administrador.");
      }
    }
    setBusy(false);
    toast.success("Login realizado.");
    navigate("/");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== "proprietario" && !PHONE_REGEX.test(phone)) {
      return toast.error("Telefone inválido. Use apenas números, iniciando com 55 (ex: 5532933445566).");
    }
    if (role === "gerente" && !agencyId) return toast.error("Selecione a agência do gerente.");
    if (role === "parceiro" && (!notaryOfficeName || !uf)) return toast.error("Informe cartório e UF.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          role,
          phone: role === "proprietario" ? "" : phone,
          agency_id: role === "gerente" ? agencyId : "",
          notary_office_name: role === "parceiro" ? notaryOfficeName : "",
          uf: role === "parceiro" ? uf : "",
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro criado. Você já pode acessar.");
    navigate("/");
  };

  const roleColsClass = adminExists ? "" : styles.cols4;

  return (
    <div className={styles.page}>
      <div className={`${styles.container} ${active ? styles.active : ""}`}>
        {/* ============ LOGIN ============ */}
        <div className={styles.formBox}>
          <form onSubmit={handleLogin} className={styles.formScroll}>
            <h1>Entrar</h1>
            <p>Acesse sua conta Smart Leilões</p>

            <div className={styles.inputBox}>
              <label className={styles.inputLabel}>E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className={styles.inputBox}>
              <label className={styles.inputLabel}>Senha</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "-8px 0 14px", fontSize: 13, cursor: "pointer", color: "#333" }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ width: 16, height: 16, margin: 0, padding: 0, accentColor: "#1e3a8a" }}
              />
              Exibir senha
            </label>

            <button type="submit" className={styles.btn} disabled={busy}>
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* ============ REGISTER ============ */}
        <div className={`${styles.formBox} ${styles.register}`}>
          <form onSubmit={handleSignup} className={styles.formScroll}>
            <h1>Criar conta</h1>
            <p>Cadastre-se para começar</p>

            <div className={styles.inputBox}>
              <label className={styles.inputLabel}>Tipo de usuário</label>
              <div className={`${styles.roleGrid} ${roleColsClass}`}>
                <RoleCard
                  active={role === "parceiro"}
                  onClick={() => setRole("parceiro")}
                  icon={<Briefcase size={14} />}
                  title="Parceiro"
                  desc="Agenda contratos"
                />
                <RoleCard
                  active={role === "gerente"}
                  onClick={() => setRole("gerente")}
                  icon={<ShieldCheck size={14} />}
                  title="Gerente"
                  desc="Valida minutas"
                />
                <RoleCard
                  active={role === "proprietario"}
                  onClick={() => setRole("proprietario")}
                  icon={<Home size={14} />}
                  title="Proprietário"
                  desc="Acompanha"
                />
                {!adminExists && (
                  <RoleCard
                    active={role === "admin"}
                    onClick={() => setRole("admin")}
                    icon={<Crown size={14} />}
                    title="Admin"
                    desc="Primeiro admin"
                  />
                )}
              </div>
            </div>

            <div className={styles.inputBox}>
              <label className={styles.inputLabel}>Nome completo</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className={styles.inputBox}>
              <label className={styles.inputLabel}>E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            {role !== "proprietario" && (
              <div className={styles.inputBox}>
                <label className={styles.inputLabel}>Telefone (WhatsApp) *</label>
                <input
                  required
                  inputMode="numeric"
                  placeholder="5532933445566"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
                <p className={styles.helpText}>
                  Apenas números, com 55 + DDD + número. Ex.: 5532933445566
                </p>
              </div>
            )}

            <div className={styles.inputBox}>
              <label className={styles.inputLabel}>Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {role === "gerente" && (
              <div className={styles.inputBox}>
                <label className={styles.inputLabel}>Agência *</label>
                <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} required>
                  <option value="">Selecione a agência</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.managerName ? ` — ${a.managerName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === "parceiro" && (
              <>
                <div className={styles.inputBox}>
                  <label className={styles.inputLabel}>Nome do cartório</label>
                  <input
                    required
                    value={notaryOfficeName}
                    onChange={(e) => setNotaryOfficeName(e.target.value)}
                    placeholder="Cartório do ..."
                  />
                </div>
                <div className={styles.inputBox}>
                  <label className={styles.inputLabel}>UF de atuação *</label>
                  <select value={uf} onChange={(e) => setUf(e.target.value)} required>
                    <option value="">Selecione o estado</option>
                    {BRAZIL_STATES.map((s) => (
                      <option key={s.uf} value={s.uf}>
                        {s.uf} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <button type="submit" className={styles.btn} disabled={busy}>
              {busy ? "Criando..." : "Criar conta"}
            </button>
          </form>
        </div>

        {/* ============ TOGGLE PANELS ============ */}
        <div className={styles.toggleBox}>
          <div className={`${styles.togglePanel} ${styles.toggleLeft}`}>
            <img src={logoAsset.url} alt="Smart Leilões" className={styles.brandLogo} />
            <h1>Bem-vindo!</h1>
            <p>Já tem uma conta? Faça login para continuar.</p>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setActive(true)}
            >
              Criar conta
            </button>
          </div>

          <div className={`${styles.togglePanel} ${styles.toggleRight}`}>
            <img src={logoAsset.url} alt="Smart Leilões" className={styles.brandLogo} />
            <h1>Olá, parceiro!</h1>
            <p>Cadastre-se para acessar o sistema de agendamentos.</p>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setActive(false)}
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const RoleCard = ({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`${styles.roleCard} ${active ? styles.active : ""}`}
  >
    <div className={styles.roleCardTitle}>
      {icon}
      {title}
    </div>
    <div className={styles.roleCardDesc}>{desc}</div>
  </button>
);
