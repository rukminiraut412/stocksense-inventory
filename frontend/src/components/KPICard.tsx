"use client";

import React from "react";
import { KPICardData } from "@/lib/api";
import {
  Package,
  AlertTriangle,
  ArrowDownLeft,
  Truck,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface KPICardProps {
  data: KPICardData;
}

export default function KPICard({ data }: KPICardProps) {
  // Choose icon and color scheme based on card key
  const getCardTheme = (key: string) => {
    switch (key) {
      case "total_products_in_stock":
        return {
          icon: <Package className="h-5 w-5 text-indigo-400" />,
          glow: "group-hover:border-indigo-500/40",
          iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
          accent: "text-indigo-400",
        };
      case "low_stock_out_of_stock":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
          glow: "group-hover:border-amber-500/40",
          iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
          accent: "text-amber-400",
        };
      case "pending_receipts":
        return {
          icon: <ArrowDownLeft className="h-5 w-5 text-emerald-400" />,
          glow: "group-hover:border-emerald-500/40",
          iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
          accent: "text-emerald-400",
        };
      case "pending_deliveries":
        return {
          icon: <Truck className="h-5 w-5 text-blue-400" />,
          glow: "group-hover:border-blue-500/40",
          iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
          accent: "text-blue-400",
        };
      case "internal_transfers_scheduled":
        return {
          icon: <ArrowLeftRight className="h-5 w-5 text-purple-400" />,
          glow: "group-hover:border-purple-500/40",
          iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
          accent: "text-purple-400",
        };
      default:
        return {
          icon: <Package className="h-5 w-5 text-slate-400" />,
          glow: "group-hover:border-slate-500/40",
          iconBg: "bg-slate-500/10 border-slate-500/20 text-slate-400",
          accent: "text-slate-400",
        };
    }
  };

  const theme = getCardTheme(data.key);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${theme.glow}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
          {data.title}
        </span>
        <div className={`p-2 rounded-lg border ${theme.iconBg}`}>
          {theme.icon}
        </div>
      </div>

      {/* KPI Value */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
          {data.value}
        </span>
        <span className="text-xs text-slate-400 font-mono">{data.unit}</span>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[32px]">
        {data.description}
      </p>

      {/* Footer Status & Attribution */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          {data.is_connected ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Live Module
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
              <Clock className="h-3 w-3 text-amber-400" />
              Default State (0)
            </span>
          )}
        </div>

        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
          Owner: {data.module_owner}
        </span>
      </div>
    </div>
  );
}
