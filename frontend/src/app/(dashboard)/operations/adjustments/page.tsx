"use client";

import React, { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import {
  productsAPI,
  warehousesAPI,
  adjustmentsAPI,
  Product,
  Warehouse,
  Adjustment,
} from "@/lib/api";
import {
  Sliders,
  Plus,
  RefreshCw,
  Package,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Clock,
  FileText,
  Search,
  Check,
} from "lucide-react";

export default function AdjustmentsPage() {
  const { token, user } = useAuth();

  // Reference data
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | "">("");
  const [recordedStock, setRecordedStock] = useState<number | null>(null);
  const [fetchingStock, setFetchingStock] = useState(false);
  const [physicalCount, setPhysicalCount] = useState<string>("");
  const [reason, setReason] = useState<string>("Routine Physical Count");
  const [submitting, setSubmitting] = useState(false);

  // Table search & filter
  const [searchTerm, setSearchTerm] = useState("");

  // Load initial data
  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const [prodList, whList, adjList] = await Promise.all([
          productsAPI.list(undefined, token),
          warehousesAPI.list(token),
          adjustmentsAPI.list(undefined, undefined, token),
        ]);

        setProducts(prodList);
        setWarehouses(whList);
        setAdjustments(adjList);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load adjustment data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch recorded stock whenever product or warehouse changes
  useEffect(() => {
    if (selectedProductId && selectedWarehouseId) {
      setFetchingStock(true);
      adjustmentsAPI
        .getRecordedStock(Number(selectedProductId), Number(selectedWarehouseId), token)
        .then((data) => {
          setRecordedStock(data.recorded_quantity);
        })
        .catch(() => {
          setRecordedStock(0.0);
        })
        .finally(() => {
          setFetchingStock(false);
        });
    } else {
      setRecordedStock(null);
    }
  }, [selectedProductId, selectedWarehouseId, token]);

  // Compute live difference
  const countNumber = physicalCount === "" ? null : parseFloat(physicalCount);
  const difference =
    recordedStock !== null && countNumber !== null && !isNaN(countNumber)
      ? Math.round((countNumber - recordedStock) * 10000) / 10000
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setError("Please select a Product.");
      return;
    }
    if (!selectedWarehouseId) {
      setError("Please select a Warehouse location.");
      return;
    }
    if (physicalCount === "" || countNumber === null || isNaN(countNumber)) {
      setError("Please enter a valid physical counted quantity.");
      return;
    }
    if (countNumber < 0) {
      setError("Physical counted quantity cannot be negative (must be >= 0).");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const created = await adjustmentsAPI.create(
        {
          product_id: Number(selectedProductId),
          warehouse_id: Number(selectedWarehouseId),
          counted_quantity: countNumber,
          reason: reason || "Physical Count Reconciliation",
          user: user?.name || "Inventory Specialist",
        },
        token
      );

      setSuccessMsg(
        `Adjustment ${created.reference_id} successfully recorded! Stock adjusted from ${created.recorded_quantity} to ${created.physical_quantity} (${created.difference >= 0 ? "+" : ""}${created.difference} units).`
      );

      // Refresh recorded stock & adjustment log
      setRecordedStock(created.physical_quantity);
      setPhysicalCount("");
      setReason("Routine Physical Count");

      const updatedAdjs = await adjustmentsAPI.list(undefined, undefined, token);
      setAdjustments(updatedAdjs);

      // Also reload products to reflect updated global current_stock
      const updatedProds = await productsAPI.list(undefined, token);
      setProducts(updatedProds);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record adjustment.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter adjustments
  const filteredAdjustments = adjustments.filter((adj) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (adj.reference_id && adj.reference_id.toLowerCase().includes(term)) ||
      (adj.product_name && adj.product_name.toLowerCase().includes(term)) ||
      (adj.product_sku && adj.product_sku.toLowerCase().includes(term)) ||
      (adj.warehouse_name && adj.warehouse_name.toLowerCase().includes(term)) ||
      (adj.reason && adj.reason.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Header
        title="Physical Stock Adjustment"
        subtitle="Reconcile recorded system inventory with physical shelf cycle counts"
        onRefresh={() => loadData(true)}
        isRefreshing={refreshing}
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3 animate-in fade-in duration-200">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in duration-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Top Grid: Form on Left, Live Difference Card on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Adjustment Entry Form */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Create Stock Reconciliation</h2>
                <p className="text-xs text-slate-400">
                  Select a product and facility to compare and adjust inventory levels
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Product Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Product <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="product-select"
                      value={selectedProductId}
                      onChange={(e) =>
                        setSelectedProductId(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    >
                      <option value="">-- Select Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Total: {p.current_stock} {p.unit_of_measure}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Warehouse Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Warehouse / Location <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="warehouse-select"
                      value={selectedWarehouseId}
                      onChange={(e) =>
                        setSelectedWarehouseId(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    >
                      <option value="">-- Select Warehouse / Location --</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code}) {w.location ? `— ${w.location}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Physical Count & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Physical Count Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Physical Counted Quantity <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="counted-quantity-input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter physical count (>= 0)"
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recorded stock will be updated to this exact number.
                  </p>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Adjustment Reason
                  </label>
                  <input
                    id="adjustment-reason-input"
                    type="text"
                    placeholder="e.g. Shrinkage, Found Item, Cycle Count"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  id="submit-adjustment-btn"
                  type="submit"
                  disabled={submitting || !selectedProductId || !selectedWarehouseId || physicalCount === ""}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Applying Adjustment...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Apply & Record Adjustment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Real-Time Difference & Reconciliation Preview */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Live Reconciliation
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  REAL-TIME
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {/* System Recorded Stock */}
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    System Recorded Stock
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {fetchingStock ? (
                      <span className="text-sm text-slate-500 animate-pulse">Checking location...</span>
                    ) : recordedStock !== null ? (
                      `${recordedStock} units`
                    ) : (
                      <span className="text-sm text-slate-500">Select product & facility</span>
                    )}
                  </div>
                </div>

                {/* Physical Count */}
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Physical Counted Quantity
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {countNumber !== null && !isNaN(countNumber) ? (
                      `${countNumber} units`
                    ) : (
                      <span className="text-sm text-slate-500">Awaiting input</span>
                    )}
                  </div>
                </div>

                {/* Calculated Difference */}
                <div
                  className={`p-4 rounded-lg border ${
                    difference === null
                      ? "bg-slate-950/40 border-slate-800/60 text-slate-400"
                      : difference > 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : difference < 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  }`}
                >
                  <div className="text-[11px] font-mono uppercase font-semibold">
                    Calculated Stock Difference
                  </div>
                  <div className="text-3xl font-extrabold font-mono mt-1 flex items-center gap-2">
                    {difference === null ? (
                      "—"
                    ) : (
                      <>
                        {difference > 0 ? (
                          <TrendingUp className="h-6 w-6 text-emerald-400" />
                        ) : difference < 0 ? (
                          <TrendingDown className="h-6 w-6 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-blue-400" />
                        )}
                        <span>
                          {difference > 0 ? `+${difference}` : difference} units
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] mt-1 text-slate-400">
                    {difference !== null && difference !== 0
                      ? difference > 0
                        ? "Discrepancy: Surplus stock found."
                        : "Discrepancy: Deficit / shrinkage detected."
                      : difference === 0
                      ? "Count perfectly matches system record."
                      : "Difference calculates automatically."}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
              Auto-writes to Immutable Stock Ledger (Audit Trail).
            </div>
          </div>
        </div>

        {/* Bottom Section: Historical Adjustments Audit Trail */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-400" />
                Adjustment History & Audit Trail
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete record of all inventory cycle counts and manual adjustments
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="search-adjustments"
                type="text"
                placeholder="Search reference, product, warehouse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Location</th>
                  <th className="px-5 py-3 font-semibold text-right">System Qty</th>
                  <th className="px-5 py-3 font-semibold text-right">Counted Qty</th>
                  <th className="px-5 py-3 font-semibold text-right">Difference</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Date / Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-slate-500">
                      Loading stock adjustment records...
                    </td>
                  </tr>
                ) : filteredAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-slate-500 font-sans">
                      No stock adjustment records found.
                    </td>
                  </tr>
                ) : (
                  filteredAdjustments.map((adj) => (
                    <tr
                      key={adj.id}
                      className="hover:bg-slate-800/30 transition-colors font-mono"
                    >
                      <td className="px-5 py-3 font-bold text-indigo-400">
                        {adj.reference_id}
                      </td>
                      <td className="px-5 py-3 font-sans">
                        <div className="font-semibold text-white">
                          {adj.product_name || `Product #${adj.product_id}`}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {adj.product_sku || `ID: ${adj.product_id}`}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-sans">
                        {adj.warehouse_name || `Warehouse #${adj.warehouse_id}`}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400">
                        {adj.recorded_quantity}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-white">
                        {adj.physical_quantity}
                      </td>
                      <td className="px-5 py-3 text-right font-bold">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${
                            adj.difference > 0
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : adj.difference < 0
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                          }`}
                        >
                          {adj.difference > 0 ? `+${adj.difference}` : adj.difference}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 font-sans text-xs">
                        {adj.reason || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Check className="h-3 w-3" />
                          {adj.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[11px]">
                        {adj.created_at || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
