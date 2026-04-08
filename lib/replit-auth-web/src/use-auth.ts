import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  verify: (token: string) => Promise<VerifyResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface RegisterResult {
  success: boolean;
  error?: string;
  verificationToken?: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
  needsVerification?: boolean;
  verificationToken?: string;
}

interface VerifyResult {
  success: boolean;
  error?: string;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchUser().then(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.status === 403 && data.needsVerification) {
        return {
          success: false,
          needsVerification: true,
          verificationToken: data.verificationToken,
          error: data.error,
        };
      }

      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<RegisterResult> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        return { success: false, error: result.error || "Registration failed" };
      }

      return { success: true, verificationToken: result.verificationToken };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const verify = useCallback(async (token: string): Promise<VerifyResult> => {
    try {
      const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "Verification failed" };
      }

      await fetchUser();
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    verify,
    logout,
    refreshUser,
  };
}
