"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { receiptsAPI, productsAPI, Receipt, ReceiptCreate, Product } from "@/lib/api";

export default function ReceiptsPage() {
  const { token } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // New receipt form state
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState<{ product_id: number; quantity: number }[]>([
    { product_id: 0, quantity: 1 },
  ]);
  const [validatingId, setValidatingId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recs, prods] = await Promise.all([
        receiptsAPI.list(undefined, token),
        productsAPI.list(undefined, token),
      ]);
      setReceipts(recs);
      setAvailableProducts(prods);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load receipts data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleAddItemRow = () => {
    setItems([...items, { product_id: 0, quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: "product_id" | "quantity", value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);

      // Validate products are selected
      for (const item of items) {
        if (!item.product_id || item.product_id === 0) {
          throw new Error("Please select a product for all item rows.");
        }
        if (item.quantity <= 0) {
          throw new Error("Quantities must be strictly greater than 0.");
        }
      }

      const payload: ReceiptCreate = {
        supplier: supplier.trim(),
        items,
      };

      await receiptsAPI.create(payload, token);
      setSuccessMsg(`Receipt from "${supplier}" created successfully in DRAFT status.`);
      setIsCreateOpen(false);
      setSupplier("");
      setItems([{ product_id: 0, quantity: 1 }]);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create receipt");
    }
  };

  const handleValidateReceipt = async (receipt: Receipt) => {
    try {
      setValidatingId(receipt.id);
      setError(null);
      await receiptsAPI.validate(receipt.id, token);
      setSuccessMsg(`Receipt ${receipt.receipt_number} successfully validated! Product stock updated.`);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidatingId(null);
    }
  };

  const totalReceipts = receipts.length;
  const draftReceipts = receipts.filter((r) => r.status.toUpperCase() === "DRAFT").length;
  const validatedReceipts = receipts.filter((r) => r.status.toUpperCase() === "VALIDATED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbound Receipts Operations</h1>
          <p className="text-sm text-gray-500">
            Process incoming supplier shipments and synchronize inventory stock.
          </p>
        </div>
        <button
          onClick={() => {
            if (availableProducts.length === 0) {
              setError("Please create at least one product before creating a receipt.");
              return;
            }
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          + New Inbound Receipt
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Inbound Receipts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalReceipts}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Pending / Draft (Dock Processing)</p>
          <p className={`text-2xl font-bold mt-1 ${draftReceipts > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {draftReceipts}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Validated / Received</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{validatedReceipts}</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
          {successMsg}
        </div>
      )}

      {/* Receipts Table */}
      <div className="bg-white shadow overflow-hidden border border-gray-200 sm:rounded-lg">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading inbound receipts...</div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-base">No inbound receipts recorded yet.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 text-sm text-indigo-600 font-medium hover:underline"
            >
              Receive your first shipment
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receipts.map((rec) => {
                const isDraft = rec.status.toUpperCase() === "DRAFT";
                return (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-indigo-600">
                      {rec.receipt_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {rec.supplier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(rec.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedReceipt(rec)}
                        className="text-indigo-600 hover:underline"
                      >
                        {rec.items.length} line item{rec.items.length !== 1 ? "s" : ""}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isDraft ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          DRAFT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          VALIDATED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => setSelectedReceipt(rec)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        View
                      </button>
                      {isDraft && (
                        <button
                          onClick={() => handleValidateReceipt(rec)}
                          disabled={validatingId === rec.id}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                        >
                          {validatingId === rec.id ? "Validating..." : "Validate & Receive"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Details Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedReceipt.receipt_number}</h2>
                <p className="text-sm text-gray-500">Supplier: {selectedReceipt.supplier}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedReceipt.status.toUpperCase() === "VALIDATED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {selectedReceipt.status.toUpperCase()}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Line Items</h3>
              <table className="min-w-full divide-y divide-gray-200 border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedReceipt.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-500">{item.product_sku}</td>
                      <td className="px-4 py-2 text-sm font-bold text-right text-gray-900">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              {selectedReceipt.status.toUpperCase() === "DRAFT" && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleValidateReceipt(selectedReceipt);
                    setSelectedReceipt(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                  Validate & Receive Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Inbound Receipt Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Create Inbound Vendor Receipt</h2>
            <p className="text-xs text-gray-500">
              Receipt starts in <span className="font-semibold text-amber-600">DRAFT</span> status. Product stock will NOT be increased until validation.
            </p>

            <form onSubmit={handleCreateReceipt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. Acme Industrial Supplies"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Receipt Line Items *</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Another Item
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto p-1 border rounded-lg bg-gray-50">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border">
                      <div className="flex-1">
                        <select
                          required
                          value={item.product_id}
                          onChange={(e) =>
                            handleItemChange(idx, "product_id", parseInt(e.target.value, 10))
                          }
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value={0}>-- Select Product --</option>
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) [Current: {p.current_stock} {p.unit_of_measure}]
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)
                          }
                          placeholder="Qty"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-right"
                        />
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-red-500 hover:text-red-700 px-2 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Save Draft Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

