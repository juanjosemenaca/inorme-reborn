import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { resolveProfileForSession } from "@/api/backofficeUsersApi";
import { fetchCompanyWorkers } from "@/api/companyWorkersApi";
import { profileRequiresPasswordChange } from "@/lib/passwordPolicy";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { BackofficeSession, UserRole } from "@/types/backoffice";
import { getResolvedDisplayName } from "@/types/backoffice";
import { useLanguage } from "@/contexts/LanguageContext";

export type AdminLoginResult =
  | { ok: true; needsPasswordChange: boolean }
  | { ok: false; message: string };

type AdminAuthContextValue = {
  user: BackofficeSession | null;
  isAuthenticated: boolean;
  /** Sesión Supabase + perfil resueltos (false mientras carga). */
  ready: boolean;
  /** Debe ir a /admin/cambiar-contrasena antes del resto del backoffice. */
  needsPasswordChange: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isWorker: boolean;
  login: (email: string, password: string) => Promise<AdminLoginResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function normalizeUserRole(value: unknown): UserRole | null {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "ADMIN") return "ADMIN";
  if (raw === "WORKER") return "WORKER";
  return null;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<BackofficeSession | null>(null);
  const [ready, setReady] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  const loadSessionFromAuth = useCallback(async (sessionOverride?: Session | null) => {
    if (!isSupabaseConfigured() || !supabase) {
      setUser(null);
      setNeedsPasswordChange(false);
      return;
    }
    const session =
      sessionOverride !== undefined
        ? sessionOverride
        : (await supabase.auth.getSession()).data.session;
    if (!session?.user) {
      setUser(null);
      setNeedsPasswordChange(false);
      return;
    }
    let profile;
    try {
      profile = await resolveProfileForSession(session.user.id, session.user.email ?? "");
    } catch {
      await supabase.auth.signOut();
      setUser(null);
      setNeedsPasswordChange(false);
      return;
    }
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setUser(null);
      setNeedsPasswordChange(false);
      return;
    }
    const workers = await fetchCompanyWorkers();
    setNeedsPasswordChange(
      profileRequiresPasswordChange(profile.mustChangePassword, profile.passwordChangedAt)
    );
    setUser({
      userId: profile.id,
      email: profile.email,
      name: getResolvedDisplayName(profile, workers),
      role: profile.role,
      companyWorkerId: profile.companyWorkerId,
      enabledModules: profile.enabledModules,
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setReady(true);
      return;
    }
    let mounted = true;
    loadSessionFromAuth().finally(() => {
      if (mounted) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadSessionFromAuth(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadSessionFromAuth]);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setNeedsPasswordChange(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AdminLoginResult> => {
      const mapSignInError = (error: { message: string; code?: string; status?: number }): string => {
        const { message, code } = error;
        if (
          code === "email_not_confirmed" ||
          /email not confirmed/i.test(message) ||
          /not confirmed/i.test(message)
        ) {
          return t("admin.auth.email_not_confirmed");
        }
        if (code === "user_banned" || /banned/i.test(message)) {
          return t("admin.auth.user_banned");
        }
        if (
          code === "invalid_credentials" ||
          message === "Invalid login credentials" ||
          /invalid login credentials/i.test(message)
        ) {
          return t("admin.auth.invalid_credentials");
        }
        if (code === "too_many_requests" || error.status === 429) {
          return t("admin.auth.too_many_requests");
        }
        return message;
      };

      if (!supabase) {
        return { ok: false, message: t("admin.auth.supabase_not_configured") };
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        return {
          ok: false,
          message: mapSignInError(signInError as { message: string; code?: string; status?: number }),
        };
      }
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        await supabase.auth.signOut();
        return { ok: false, message: t("admin.auth.no_user_after_login") };
      }

      let profile;
      try {
        profile = await resolveProfileForSession(authUser.id, authUser.email ?? email);
      } catch (e) {
        await supabase.auth.signOut();
        return {
          ok: false,
          message:
            e instanceof Error
              ? `${t("admin.auth.profile_load_error_prefix")} ${e.message}`
              : t("admin.auth.profile_load_error"),
        };
      }

      if (!profile) {
        await supabase.auth.signOut();
        return {
          ok: false,
          message: t("admin.auth.no_profile"),
        };
      }
      if (!profile.active) {
        await supabase.auth.signOut();
        return { ok: false, message: t("admin.auth.account_disabled") };
      }

      const workers = await fetchCompanyWorkers();
      const needsPwd = profileRequiresPasswordChange(
        profile.mustChangePassword,
        profile.passwordChangedAt
      );
      setNeedsPasswordChange(needsPwd);
      setUser({
        userId: profile.id,
        email: profile.email,
        name: getResolvedDisplayName(profile, workers),
        role: profile.role,
        companyWorkerId: profile.companyWorkerId,
        enabledModules: profile.enabledModules,
      });
      return { ok: true, needsPasswordChange: needsPwd };
    },
    [t]
  );

  const refreshSession = useCallback(async () => {
    await loadSessionFromAuth();
  }, [loadSessionFromAuth]);

  const value = useMemo<AdminAuthContextValue>(() => {
    const role = normalizeUserRole(user?.role);
    return {
      user,
      isAuthenticated: user !== null,
      ready,
      needsPasswordChange,
      role,
      isAdmin: role === "ADMIN",
      isWorker: role === "WORKER",
      login,
      logout,
      refreshSession,
    };
  }, [user, ready, needsPasswordChange, login, logout, refreshSession]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
