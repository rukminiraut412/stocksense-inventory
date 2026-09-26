"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: "manager" | "staff") => {
    if (role === "manager") {
      setEmail("admin@stocksense.io");
      setPassword("AdminPass123!");
    } else {
      setEmail("dock.staff@stocksense.io");
      setPassword("StaffPass123!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      {/* Background ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 -z-10" />

      <div className="w-full max-w-md">
        {/* Brand Card */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/25 mb-3">
            <Package className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Sign in to Stock<span className="text-indigo-400">Sense</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Intelligent Inventory &amp; Warehouse Operations
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@stocksense.io"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill for Hackathon Testing */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 text-center mb-2">
              Demo Helper: Auto-fill Credentials
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("manager")}
                className="px-2 py-1.5 rounded bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 font-medium text-center transition-colors"
              >
                Manager Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("staff")}
                className="px-2 py-1.5 rounded bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300 font-medium text-center transition-colors"
              >
                Staff Demo
              </button>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-indigo-400 font-semibold hover:text-indigo-300">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
}
