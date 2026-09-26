"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import KPICard from "@/components/KPICard";
import { dashboardAPI, DashboardKPIResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Layers,
  ArrowUpRight,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
} from "lucide-react";

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [kpiData, setKpiData] = useState<DashboardKPIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchKPIs = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const data = await dashboardAPI.getKPIs(token);
      setKpiData(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch dashboard metrics.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Inventory Operations Dashboard"
        subtitle={`Welcome back, ${user?.name || "Team Member"} — StockSense Central Intelligence`}
        onRefresh={() => fetchKPIs(true)}
        isRefreshing={refreshing}
      />

      <main className="p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Notice Banner: Safe Default States / Anti-Fake Data */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 backdrop-blur-sm flex items-start gap-3">
          <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold text-indigo-200">
              Team Leader Foundation Active — Safe Default States (0)
            </span>
            <p className="text-slate-300 leading-relaxed">
              In accordance with hackathon anti-overlap rules, no mock or simulated data is fabricated.
              Cards currently show default baseline counts (0) until Member 2, Member 3, and Member 4 connect their business modules.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchKPIs()}
              className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* 5 KPI Cards Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Core Inventory Indicators
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Updated: {kpiData ? new Date(kpiData.timestamp).toLocaleTimeString() : "Syncing..."}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse p-4 flex flex-col justify-between"
                >
                  <div className="h-4 bg-slate-800 rounded w-2/3" />
                  <div className="h-8 bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : kpiData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <KPICard data={kpiData.total_products_in_stock} />
              <KPICard data={kpiData.low_stock_out_of_stock} />
              <KPICard data={kpiData.pending_receipts} />
              <KPICard data={kpiData.pending_deliveries} />
              <KPICard data={kpiData.internal_transfers_scheduled} />
            </div>
          ) : null}
        </div>

        {/* Team Integration Matrix & Quick Operations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Integration Matrix */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-400" />
                Hackathon Module Integration Matrix
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                8-Hour Sprint Target
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[11px]">
                    <th className="pb-2">Developer / Role</th>
                    <th className="pb-2">Assigned Modules</th>
                    <th className="pb-2">Git Branch</th>
                    <th className="pb-2 text-right">Integration Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {/* Team Leader */}
                  <tr>
                    <td className="py-2.5 font-medium text-white flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Team Leader
                    </td>
                    <td className="py-2.5 text-slate-300">Foundation, Auth, Navigation, DB Core</td>
                    <td className="py-2.5 font-mono text-indigo-400 text-[11px]">feature/team-leader</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Live &amp; Ready
                      </span>
                    </td>
                  </tr>

                  {/* Member 2 */}
                  <tr>
                    <td className="py-2.5 font-medium text-slate-300 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Member 2
                    </td>
                    <td className="py-2.5 text-slate-400">Products, Receipts, Stock Increment</td>
                    <td className="py-2.5 font-mono text-slate-400 text-[11px]">feature/member-2</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20">
                        <Clock className="h-3 w-3" /> Ready for Merge
                      </span>
                    </td>
                  </tr>

                  {/* Member 3 */}
                  <tr>
                    <td className="py-2.5 font-medium text-slate-300 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Member 3
                    </td>
                    <td className="py-2.5 text-slate-400">Delivery Orders, Transfers, Stock Decrement</td>
                    <td className="py-2.5 font-mono text-slate-400 text-[11px]">feature/member-3</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20">
                        <Clock className="h-3 w-3" /> Ready for Merge
                      </span>
                    </td>
                  </tr>

                  {/* Member 4 */}
                  <tr>
                    <td className="py-2.5 font-medium text-slate-300 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Member 4
                    </td>
                    <td className="py-2.5 text-slate-400">Inventory Adjustments, Move History, Low-stock</td>
                    <td className="py-2.5 font-mono text-slate-400 text-[11px]">feature/member-4</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20">
                        <Clock className="h-3 w-3" /> Ready for Merge
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Operations Gateway */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Operations Gateway
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Explore the modular navigation routes reserved for the engineering team:
              </p>

              <div className="space-y-2">
                <Link
                  href="/products"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 transition-colors"
                >
                  <span>Products Catalog (Member 2)</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/operations/receipts"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 transition-colors"
                >
                  <span>Inbound Receipts (Member 2)</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/operations/deliveries"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 transition-colors"
                >
                  <span>Outbound Deliveries (Member 3)</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/operations/move-history"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 transition-colors"
                >
                  <span>Stock Ledger &amp; History (Member 4)</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
              StockSense API: v1.0.0
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
