"use client";
import { useRestaurant } from "@/contexts/restaurant-context";
import { Header } from "@/components/layout/header";
import { useState } from "react";
import { Copy, Check, ExternalLink, HeartHandshake } from "lucide-react";

export default function StaffSupportAdminPage() {
  const { activeRestaurant } = useRestaurant();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = activeRestaurant ? `${baseUrl}/staff-support/${activeRestaurant.id}` : "";
  const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&margin=10` : "";

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Header title="Staff Support" />
      <div className="p-6 max-w-lg mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-5 shadow-sm">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
            <HeartHandshake size={24} className="text-purple-500" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">Staff Leave Portal</h2>
            <p className="text-sm text-gray-500 mt-1">Share this QR with your staff. They can submit leave requests and view their leave calendar — no login needed.</p>
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

        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-purple-800">How it works</p>
          <ol className="text-sm text-purple-700 space-y-1 list-decimal list-inside">
            <li>Share the QR or link with your team</li>
            <li>Staff select their name — no login required</li>
            <li>They submit leave requests with dates and type</li>
            <li>Leave appears in Leave Calendar automatically</li>
            <li>Staff can view their leave history and monthly allocation</li>
          </ol>
        </div>
      </div>
    </>
  );
}
