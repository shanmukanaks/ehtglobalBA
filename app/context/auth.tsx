"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  role: string;
  wallet: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, password: string, wallet?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  linkWallet: (wallet: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function fetchUser(authToken: string) {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // token invalid, clear it
        localStorage.removeItem("auth_token");
        setToken(null);
      }
    } catch (err) {
      console.error("failed to fetch user:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "login failed" };
      }

      localStorage.setItem("auth_token", data.token);
      setToken(data.token);
      setUser(data.user);

      return { ok: true };
    } catch (err) {
      console.error("login error:", err);
      return { ok: false, error: "something went wrong" };
    }
  }

  async function register(email: string, password: string, wallet?: string) {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, wallet }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "registration failed" };
      }

      localStorage.setItem("auth_token", data.token);
      setToken(data.token);
      setUser(data.user);

      return { ok: true };
    } catch (err) {
      console.error("register error:", err);
      return { ok: false, error: "something went wrong" };
    }
  }

  function logout() {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
    router.push("/");
  }

  async function linkWallet(wallet: string) {
    if (!token) {
      return { ok: false, error: "not logged in" };
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/link-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "failed to link wallet" };
      }

      setUser(data.user);
      return { ok: true };
    } catch (err) {
      console.error("link wallet error:", err);
      return { ok: false, error: "something went wrong" };
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, linkWallet }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
