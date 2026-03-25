import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInputWithToggle } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getMissingSupabaseEnvVars, isSupabaseConfigured } from "@/lib/supabaseClient";

const AdminLogin = () => {
  const { isAuthenticated, login, ready, needsPasswordChange } = useAdminAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return (
      <Navigate
        to={needsPasswordChange ? "/admin/cambiar-contrasena" : "/admin"}
        replace
      />
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        {t("admin.common.loading")}
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    const missing = getMissingSupabaseEnvVars();
    return (
      <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4 gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("admin.login.back_home")}
          </Link>
          <LanguageSwitcher variant="dark" />
        </div>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t("admin.login.env_title")}</CardTitle>
            <div className="space-y-3 text-sm text-muted-foreground pt-1">
              {import.meta.env.PROD ? (
                <>
                  <p>{t("admin.login.env_prod_intro")}</p>
                  <ol className="list-decimal pl-4 space-y-2">
                    <li>{t("admin.login.env_prod_step1")}</li>
                    <li>
                      {t("admin.login.env_prod_step2")}
                      <ul className="mt-2 list-disc pl-4 space-y-1">
                        <li>
                          <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_URL</code> —{" "}
                          {t("admin.login.env_prod_var_url")}
                        </li>
                        <li>
                          <code className="text-xs bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code> —{" "}
                          {t("admin.login.env_prod_var_key")}
                        </li>
                      </ul>
                    </li>
                    <li>
                      {t("admin.login.env_prod_step3")}{" "}
                      <a
                        href="https://supabase.com/dashboard/project/_/settings/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        {t("admin.login.env_prod_step3_link")}
                      </a>
                      .
                    </li>
                    <li>{t("admin.login.env_prod_step4")}</li>
                  </ol>
                </>
              ) : (
                <>
                  <p>
                    {t("admin.login.env_missing")}{" "}
                    <code className="text-xs bg-muted px-1 rounded">.env</code>{" "}
                    {t("admin.login.env_missing_vars")}{" "}
                    <strong className="text-foreground">
                      {missing.length ? missing.join(", ") : ".env"}
                    </strong>
                    .
                  </p>
                  <ol className="list-decimal pl-4 space-y-2">
                    <li>
                      {t("admin.login.env_step1")}{" "}
                      <a
                        href="https://supabase.com/dashboard/project/_/settings/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        {t("admin.login.env_step1_link")}
                      </a>
                      .
                    </li>
                    <li>
                      {t("admin.login.env_step2")} <strong>{t("admin.login.env_step2_bold")}</strong>{" "}
                      {t("admin.login.env_step2_suffix")}
                    </li>
                    <li>
                      {t("admin.login.env_step3")} <code className="text-xs">.env</code>{" "}
                      {t("admin.login.env_step3_mid")}
                      <code className="text-xs">=</code>):
                      <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto">
                        {`VITE_SUPABASE_ANON_KEY=pega_aqui_la_clave_anon_del_dashboard`}
                      </pre>
                    </li>
                    <li>
                      <strong>{t("admin.login.env_step4")}</strong> {t("admin.login.env_step4_restart")}{" "}
                      <strong>{t("admin.login.env_step4_restart_bold")}</strong>{" "}
                      {t("admin.login.env_step4_restart_suffix")}{" "}
                      <code className="text-xs">Ctrl+C</code> {t("admin.login.env_step4_restart_suffix2")}{" "}
                      <code className="text-xs">npm run dev</code>
                      {t("admin.login.env_step4_end")}
                    </li>
                  </ol>
                </>
              )}
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      navigate(
        result.needsPasswordChange ? "/admin/cambiar-contrasena" : from,
        { replace: true }
      );
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4 gap-4">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("admin.login.back_home")}
        </Link>
        <LanguageSwitcher variant="dark" />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("admin.login.title")}</CardTitle>
          <CardDescription>{t("admin.login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">{t("admin.login.email_label")}</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@inorme.com"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">{t("admin.login.password_label")}</Label>
              <PasswordInputWithToggle
                id="admin-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">{t("admin.login.password_hint")}</p>
            </div>
            {error && (
              <p className="text-sm text-destructive text-left whitespace-pre-wrap break-words" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                t("admin.login.submit_loading")
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  {t("admin.login.submit")}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
