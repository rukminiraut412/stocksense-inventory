"use client";

import React from "react";
import Header from "@/components/Header";
import { Warehouse, MapPin, Layers, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function WarehouseSettingsPage() {
  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Warehouse Configuration"
        subtitle="Facility locations, operational zones, and storage nodes"
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Active Facility Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Warehouse className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Central Logistics Hub – WH-01</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  Primary Automated Distribution Center
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Operational Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Receiving Docks</span>
              <div className="text-xl font-bold text-white font-mono mt-1">4 Docks</div>
              <span className="text-[10px] text-emerald-400">Dock A, B, C, D (Active)</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Storage Zones</span>
              <div className="text-xl font-bold text-white font-mono mt-1">12 Aisles</div>
              <span className="text-[10px] text-slate-400">High-Bay Pallet Racking</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Dispatch Bays</span>
              <div className="text-xl font-bold text-white font-mono mt-1">6 Outbound Bays</div>
              <span className="text-[10px] text-blue-400">Automated Conveyor Fed</span>
            </div>
          </div>
        </div>

        {/* Integration Note */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-400 font-mono">
          <span className="text-indigo-400 font-semibold block mb-1">Architecture Reference:</span>
          Warehouse entities are linked across all teammate operations via the shared database models and foreign keys.
        </div>
      </main>
    </div>
  );
}
