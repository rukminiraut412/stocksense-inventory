"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User, authAPI } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem("stocksense_token");
        if (storedToken) {
          setToken(storedToken);
          const currentUser = await authAPI.getMe(storedToken);
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Auth session restore failed:", err);
        localStorage.removeItem("stocksense_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("stocksense_token", res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const signup = async (name: string, email: string, password: string, role: string) => {
    const res = await authAPI.signup({ name, email, password, role });
    localStorage.setItem("stocksense_token", res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const logout = async () => {
    if (token) {
      try {
        await authAPI.logout(token);
      } catch (err) {
        console.error("Logout error:", err);
      }
    }
    localStorage.removeItem("stocksense_token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
