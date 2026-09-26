"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  ArrowDownLeft,
  Truck,
  Sliders,
  History,
  Warehouse,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 select-none">
      {/* Top Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                Stock<span className="text-indigo-400">Sense</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400/90 block leading-none">
                INTELLIGENT WMS
              </span>
            </div>
          </Link>
        </div>

        {/* Branch / Role Pill */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-400">Branch:</span>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            team-leader
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 text-sm overflow-y-auto max-h-[calc(100vh-220px)]">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all ${
              isActive("/dashboard")
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          {/* Products (Member 2) */}
          <Link
            href="/products"
            className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-all ${
              isActive("/products")
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-emerald-400" />
              <span>Products</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              M2
            </span>
          </Link>

          {/* Operations Collapsible */}
          <div className="pt-2">
            <button
              onClick={() => setOperationsOpen(!operationsOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" />
                Operations
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  operationsOpen ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>

            {operationsOpen && (
              <div className="mt-1 space-y-1 pl-2">
                {/* Receipts (Member 2) */}
                <Link
                  href="/operations/receipts"
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive("/operations/receipts")
                      ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Receipts</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">M2</span>
                </Link>

                {/* Delivery Orders (Member 3) */}
                <Link
                  href="/operations/deliveries"
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive("/operations/deliveries")
                      ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="h-3.5 w-3.5 text-blue-400" />
                    <span>Delivery Orders</span>
                  </div>
                  <span className="text-[9px] font-mono text-blue-400">M3</span>
                </Link>

                {/* Inventory Adjustment (Member 4) */}
                <Link
                  href="/operations/adjustments"
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive("/operations/adjustments")
                      ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="h-3.5 w-3.5 text-purple-400" />
                    <span>Adjustment</span>
                  </div>
                  <span className="text-[9px] font-mono text-purple-400">M4</span>
                </Link>

                {/* Move History / Ledger (Member 4) */}
                <Link
                  href="/operations/move-history"
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive("/operations/move-history")
                      ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <History className="h-3.5 w-3.5 text-purple-400" />
                    <span>Move History</span>
                  </div>
                  <span className="text-[9px] font-mono text-purple-400">M4</span>
                </Link>
              </div>
            )}
          </div>

          {/* Settings Collapsible */}
          <div className="pt-2">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
            >
              <span>Settings</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  settingsOpen ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>

            {settingsOpen && (
              <div className="mt-1 space-y-1 pl-2">
                <Link
                  href="/settings/warehouse"
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive("/settings/warehouse")
                      ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <Warehouse className="h-3.5 w-3.5 text-amber-400" />
                  <span>Warehouse</span>
                </Link>
              </div>
            )}
          </div>

          {/* Profile Section */}
          <div className="pt-2">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Profile
            </div>
            <div className="mt-1 space-y-1 pl-2">
              <Link
                href="/profile"
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive("/profile")
                    ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                }`}
              >
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>My Profile</span>
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "TL"}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-white truncate">{user?.name || "Loading..."}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.role === "inventory_manager" ? "Inventory Manager" : "Warehouse Staff"}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
