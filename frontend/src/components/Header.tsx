"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, Bell, RefreshCw } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({ title, subtitle, onRefresh, isRefreshing }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Foundation Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Core Foundation Online</span>
        </div>

        {/* Refresh button if provided */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        )}

        {/* Role Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200">{user?.name}</div>
            <div className="text-[10px] text-indigo-400 font-mono">
              {user?.role === "inventory_manager" ? "INVENTORY_MANAGER" : "WAREHOUSE_STAFF"}
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
