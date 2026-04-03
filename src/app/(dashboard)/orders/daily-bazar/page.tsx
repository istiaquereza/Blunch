"use client";
import { useRestaurant } from "@/contexts/restaurant-context";
import { Header } from "@/components/layout/header";
import { useState } from "react";
import { Copy, Check, ExternalLink, ShoppingBasket, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useProductRequisitions, shortReqId } from "@/hooks/use-product-requisitions";
import { toast } from "sonner";

export default function DailyBazarAdminPage() {
  const { activeRestaurant } = useRestaurant();
  const [copied, setCopied] = useState(false);
  const { requisitions, loading, approve, reject, refresh } = useProductRequisitions(activeRestaurant?.id);
  const [processing, setProcessing] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = activeRestaurant ? `${baseUrl}/daily-bazar/${activeRestaurant.id}` : "";
  const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&margin=10` : "";

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    const { error } = await approve(id);
    if (error) toast.error("Failed to approve: " + error.message);
    else toast.success("Requisition approved and expenses recorded");
    setProcessing(null);
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    const { error } = await reject(id);
    if (error) toast.error("Failed to reject");
    else toast.success("Requisition rejected");
    setProcessing(null);
  };

  // Show submitted requisitions — filter by source if possible
  const pendingReqs = requisitions.filter((r) => r.status === "submitted");

  return (
    <>
      <Header title="Daily Bazar" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* QR Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-5 shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
            <ShoppingBasket size={24} className="text-orange-500" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">Daily Bazar Requisitions</h2>
            <p className="text-sm text-gray-500 mt-1">Share this QR or link. Anyone can submit a requisition — no login needed. You approve here and it hits inventory & expenses automatically.</p>
          </div>
          {activeRestaurant ? (
            <>
              <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                <img src={qrUrl} alt="QR Code" width={220} height={220} className="rounded-lg" />
              </div>
              <div className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="flex-1 text-sm text-gray-600 truncate font-mono">{url}</span>
                <button onClick={copy} className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors">
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
                  <ExternalLink size={14} />
                </a>
              </div>
              <p className="text-xs text-gray-400 text-center">Specific to <strong>{activeRestaurant.name}</strong></p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select a restaurant to generate the link.</p>
          )}
        </div>

        {/* Pending Requisitions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Pending Approval</h3>
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{pendingReqs.length}</span>
          </div>
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : pendingReqs.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingBasket size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No pending requisitions</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pendingReqs.map((req) => {
                const total = (req.product_requisition_items ?? []).reduce((s, i) => s + i.total_price, 0);
                return (
                  <div key={req.id} className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-gray-700">{shortReqId(req.id)}</span>
                      {(req as any).submitter_name && (
                        <span className="text-xs text-gray-500">by {(req as any).submitter_name}</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{req.requisition_date}</span>
                    </div>
                    <div className="space-y-1">
                      {(req.product_requisition_items ?? []).map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate">{item.ingredients?.name ?? item.ingredient_id}</span>
                          <span className="shrink-0 ml-2 text-gray-400">
                            {item.quantity} {item.unit ?? ""} × ৳{item.unit_price} = ৳{item.total_price?.toFixed(2) ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {req.notes && <p className="text-xs text-gray-400 italic">{req.notes}</p>}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-sm font-semibold text-gray-800">৳{total.toFixed(2)}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processing === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={processing === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {processing === req.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-orange-800">How it works</p>
          <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
            <li>Share the QR code or link with your bazar team</li>
            <li>They add items they need to buy with quantities and prices</li>
            <li>You review the list here and approve or reject</li>
            <li>On approval: inventory is updated and expense is recorded automatically</li>
          </ol>
        </div>
      </div>
    </>
  );
}
