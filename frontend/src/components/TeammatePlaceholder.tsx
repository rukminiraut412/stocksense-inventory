"use client";

import React from "react";
import Header from "@/components/Header";
import { GitBranch, Clock, Code2, ShieldAlert } from "lucide-react";

interface TeammatePlaceholderProps {
  title: string;
  moduleName: string;
  owner: string;
  branch: string;
  responsibilities: string[];
  plannedEndpoints: string[];
}

export default function TeammatePlaceholder({
  title,
  moduleName,
  owner,
  branch,
  responsibilities,
  plannedEndpoints,
}: TeammatePlaceholderProps) {
  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={title}
        subtitle={`Reserved Module Interface — StockSense Architecture`}
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Anti-Overlap Card */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-white">
                  {moduleName} Interface Reserved for {owner}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {branch}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Under the StockSense 8-hour hackathon anti-overlap rules, the Team Leader branch provides
                only the routing shell, layout foundation, and API contracts. The core business logic is
                actively developed by <strong>{owner}</strong> on their dedicated branch.
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Responsibilities & API Contract */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              Assigned Scope &amp; Responsibilities
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {responsibilities.map((resp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-cyan-400" />
              Contracted API Endpoints
            </h3>
            <div className="space-y-1.5 font-mono text-xs text-slate-300">
              {plannedEndpoints.map((ep, i) => (
                <div key={i} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 text-[11px] text-cyan-300">
                  {ep}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integration Instructions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-xs text-slate-400 space-y-2 font-mono">
          <div className="text-slate-300 font-bold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-emerald-400" />
            Integration Instructions for {owner}:
          </div>
          <p>1. Pull the foundation branch: <span className="text-indigo-400">git pull origin feature/team-leader</span></p>
          <p>2. Connect your FastAPI router into: <span className="text-indigo-400">backend/app/api/v1/api.py</span></p>
          <p>3. Mount your React components inside this route view.</p>
        </div>
      </main>
    </div>
  );
}
