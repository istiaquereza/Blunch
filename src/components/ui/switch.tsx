"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: SwitchProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          checked ? "bg-[#111827]" : "bg-gray-200"
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm",
            "transition-transform duration-200",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </RadixSwitch.Root>
      {label && (
        <span className="text-sm text-gray-700 select-none">{label}</span>
      )}
    </div>
  );
}
