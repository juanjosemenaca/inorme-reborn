import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authenticate,
  ensureBackofficeUsersSeeded,
  getUserById,
  getResolvedDisplayName,
} from "@/lib/backofficeUserStore";
import type { BackofficeSession, UserRole } from "@/types/backoffice";

const SESSION_KEY = "inorme_backoffice_session";

type AdminAuthContextValue = {
  user: BackofficeSession | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isWorker: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** Sincroniza nombre/email/rol tras editar el usuario actual desde Usuarios */
  refreshSession: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readSessionFromStorage(): BackofficeSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackofficeSession;
    if (
      parsed &&
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.name === "string" &&
      (parsed.role === "ADMIN" || parsed.role === "WORKER")
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function getInitialSession(): BackofficeSession | null {
  ensureBackofficeUsersSeeded();
  const s = readSessionFromStorage();
  if (!s) return null;
  if (!getUserById(s.userId)) {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    return null;
  }
  return s;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackofficeSession | null>(getInitialSession);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const found = authenticate(email, password);
    if (!found) return false;

    const session: BackofficeSession = {
      userId: found.id,
      email: found.email,
      name: getResolvedDisplayName(found),
      role: found.role,
    };

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    setUser(session);
    return true;
  }, []);

  const refreshSession = useCallback(() => {
    const current = readSessionFromStorage();
    if (!current) return;
    const u = getUserById(current.userId);
    if (!u || !u.active) {
      logout();
      return;
    }
    const next: BackofficeSession = {
      userId: u.id,
      email: u.email,
      name: getResolvedDisplayName(u),
      role: u.role,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setUser(next);
  }, [logout]);

  const value = useMemo<AdminAuthContextValue>(() => {
    const role = user?.role ?? null;
    return {
      user,
      isAuthenticated: user !== null,
      role,
      isAdmin: role === "ADMIN",
      isWorker: role === "WORKER",
      login,
      logout,
      refreshSession,
    };
  }, [user, login, logout, refreshSession]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
