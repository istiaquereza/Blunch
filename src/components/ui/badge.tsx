import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variants: Record<BadgeVariant, string> = {
  default:  "bg-zinc-500/10 text-zinc-600",
  success:  "bg-green-500/10 text-green-700",
  warning:  "bg-amber-500/10 text-amber-700",
  danger:   "bg-red-500/10 text-red-600",
  info:     "bg-blue-500/10 text-blue-700",
  purple:   "bg-purple-500/10 text-purple-700",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
