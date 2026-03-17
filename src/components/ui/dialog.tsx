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
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <RadixDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "bg-white rounded-2xl shadow-xl w-full mx-4 sm:mx-0",
            maxWidth ?? "max-w-lg",
            "max-h-[90vh] flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "focus:outline-none",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
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
          <div className="flex-1 overflow-y-auto p-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-100 p-5 shrink-0 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
