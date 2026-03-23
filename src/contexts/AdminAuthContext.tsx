import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { resolveProfileForSession } from "@/api/backofficeUsersApi";
import { fetchCompanyWorkers } from "@/api/companyWorkersApi";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { BackofficeSession, UserRole } from "@/types/backoffice";
import { getResolvedDisplayName } from "@/types/backoffice";
import { useLanguage } from "@/contexts/LanguageContext";

export type AdminLoginResult =
  | { ok: true }
  | { ok: false; message: string };

type AdminAuthContextValue = {
  user: BackofficeSession | null;
  isAuthenticated: boolean;
  /** Sesión Supabase + perfil resueltos (false mientras carga). */
  ready: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isWorker: boolean;
  login: (email: string, password: string) => Promise<AdminLoginResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<BackofficeSession | null>(null);
  const [ready, setReady] = useState(false);

  const loadSessionFromAuth = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setUser(null);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setUser(null);
      return;
    }
    let profile;
    try {
      profile = await resolveProfileForSession(session.user.id, session.user.email ?? "");
    } catch {
      await supabase.auth.signOut();
      setUser(null);
      return;
    }
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setUser(null);
      return;
    }
    const workers = await fetchCompanyWorkers();
    setUser({
      userId: profile.id,
      email: profile.email,
      name: getResolvedDisplayName(profile, workers),
      role: profile.role,
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

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadSessionFromAuth();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadSessionFromAuth]);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
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
      setUser({
        userId: profile.id,
        email: profile.email,
        name: getResolvedDisplayName(profile, workers),
        role: profile.role,
      });
      return { ok: true };
    },
    [t]
  );

  const refreshSession = useCallback(async () => {
    await loadSessionFromAuth();
  }, [loadSessionFromAuth]);

  const value = useMemo<AdminAuthContextValue>(() => {
    const role = user?.role ?? null;
    return {
      user,
      isAuthenticated: user !== null,
      ready,
      role,
      isAdmin: role === "ADMIN",
      isWorker: role === "WORKER",
      login,
      logout,
      refreshSession,
    };
  }, [user, ready, login, logout, refreshSession]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
