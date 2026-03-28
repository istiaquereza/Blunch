"use client";

import { ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {label && (
        <span className="text-sm text-zinc-500 select-none">{label}</span>
      )}
      <button
        type="button"
        onClick={() => onCheckedChange(!checked)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          checked
            ? "bg-green-500/10 text-green-700 hover:bg-red-500/10 hover:text-red-600"
            : "bg-zinc-500/10 text-zinc-500 hover:bg-green-500/10 hover:text-green-700"
        }`}
      >
        {checked ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
        {checked ? "Active" : "Inactive"}
      </button>
    </div>
  );
}
