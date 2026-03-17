import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-orange-500 hover:bg-orange-600 text-white shadow-sm",
  secondary:
    "bg-gray-100 hover:bg-gray-200 text-gray-700",
  ghost:
    "hover:bg-gray-100 text-gray-600",
  danger:
    "bg-red-50 hover:bg-red-100 text-red-600",
  outline:
    "border border-gray-200 hover:bg-gray-50 text-gray-700 bg-white",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={14} className="animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
