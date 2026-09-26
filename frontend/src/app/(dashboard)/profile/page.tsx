"use client";

import React from "react";
import Header from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import { User, Shield, Mail, Calendar, KeyRound, LogOut, CheckCircle2 } from "lucide-react";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="User Profile"
        subtitle="Manage your authenticated credentials and role permissions"
      />

      <main className="p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* User Profile Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-500/25">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "SS"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-mono border border-indigo-500/20">
                  <Shield className="h-3 w-3" />
                  {user?.role === "inventory_manager" ? "INVENTORY_MANAGER" : "WAREHOUSE_STAFF"}
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Active Session
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                Work Email
              </span>
              <div className="text-sm font-semibold text-white mt-1 break-all">
                {user?.email}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Account Created
              </span>
              <div className="text-sm font-semibold text-white mt-1">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Today"}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-500" />
                Permissions Scope
              </span>
              <div className="text-sm font-semibold text-white mt-1">
                {user?.role === "inventory_manager"
                  ? "Full Access (Warehouse, Audits, Approvals)"
                  : "Floor Access (Receipts, Picking, Transfers)"}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                Password Protection
              </span>
              <div className="text-sm font-semibold text-white mt-1">
                Bcrypt Hashed (Salted)
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Terminate active session and clear authentication token:
            </span>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
