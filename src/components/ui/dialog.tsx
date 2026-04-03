"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  maxWidth?: string;
  fitContent?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
  maxWidth,
  fitContent = false,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <RadixDialog.Content
          className={cn(
            // Mobile: bottom sheet
            "fixed bottom-0 left-0 right-0 z-50",
            "md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto",
            "md:-translate-x-1/2 md:-translate-y-1/2",
            "bg-white",
            "rounded-t-2xl md:rounded-2xl",
            "shadow-xl w-full",
            "md:mx-0",
            maxWidth ? `md:${maxWidth}` : "md:w-[512px]",
            // Mobile: up to 90vh from bottom; desktop: max-h-[90vh]
            fitContent ? "max-h-[92vh] md:max-h-none" : "max-h-[92vh] md:max-h-[90vh]",
            "flex flex-col",
            // Animations — mobile: slide up; desktop: zoom
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=open]:slide-in-from-bottom md:data-[state=open]:slide-in-from-bottom-0",
            "data-[state=closed]:slide-out-to-bottom md:data-[state=closed]:slide-out-to-bottom-0",
            "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
            "focus:outline-none",
            className
          )}
        >
          {/* Drag handle — mobile only */}
          <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-gray-900">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-sm text-gray-500 mt-0.5">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ml-4 shrink-0">
              <X size={15} />
            </RadixDialog.Close>
          </div>

          {/* Body */}
          <div className={fitContent ? "overflow-y-auto p-5" : "flex-1 overflow-y-auto p-5"}>{children}</div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-100 p-4 md:p-5 shrink-0 flex items-center justify-end gap-2 pb-safe">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
