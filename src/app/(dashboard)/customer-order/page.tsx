"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { useRestaurant } from "@/contexts/restaurant-context";
import { QrCode, Copy, ExternalLink, CheckCircle2, Smartphone, Utensils, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function CustomerOrderPage() {
  const { activeRestaurant } = useRestaurant();
  const [copied, setCopied] = useState(false);

  const rid = activeRestaurant?.id;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const orderUrl = rid ? `${baseUrl}/c/${rid}` : "";
  const qrUrl = orderUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(orderUrl)}`
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy the link manually");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="Customer Order" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* How it works */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: QrCode, color: "bg-orange-50 text-orange-500", step: "1", title: "Share QR Code", desc: "Print or display the QR code at each table" },
              { icon: Smartphone, color: "bg-blue-50 text-blue-500", step: "2", title: "Customer Scans", desc: "Customer scans with their phone and browses the menu" },
              { icon: Utensils, color: "bg-green-50 text-green-500", step: "3", title: "Order Arrives", desc: "Order appears in New Order page for your staff to process" },
            ].map(({ icon: Icon, color, step, title, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Step {step}</p>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* QR Code */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center">
            <h2 className="text-sm font-semibold text-gray-900 mb-1 self-start">Your QR Code</h2>
            <p className="text-xs text-gray-500 mb-6 self-start">Display this at your tables so customers can scan and order</p>

            {!rid ? (
              <div className="w-[260px] h-[260px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center px-4">Select a restaurant to generate QR code</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl!}
                alt="Customer Order QR Code"
                width={260}
                height={260}
                className="rounded-xl border border-gray-100 shadow-sm"
              />
            )}

            {rid && (
              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <a
                  href={orderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#111827] hover:bg-black text-white text-sm font-medium transition-colors"
                >
                  <ExternalLink size={15} />
                  Preview
                </a>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">What customers see</h2>
            <p className="text-xs text-gray-500 mb-5">The customer ordering page includes</p>

            <div className="space-y-4">
              {[
                { icon: Utensils, title: "Full Menu", desc: "All available food items organised by category" },
                { icon: Smartphone, title: "Mobile-first cart", desc: "Easy add/remove items with quantity controls" },
                { icon: CreditCard, title: "Cash checkout", desc: "Customer enters name & phone, confirms cash payment" },
                { icon: CheckCircle2, title: "Live order status", desc: "Order progress tracker updates automatically" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-xs text-orange-700 font-medium">Note</p>
              <p className="text-xs text-orange-600 mt-0.5">
                Customer orders appear in <strong>Orders → New Order</strong> with the label{" "}
                <code className="bg-orange-100 px-1 rounded">[CUSTOMER ORDER]</code> so staff can identify and process them.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
