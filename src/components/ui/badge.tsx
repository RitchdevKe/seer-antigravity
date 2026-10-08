import * as React from "react";
import { cn } from "../../lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30",
  secondary: "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] border border-[var(--color-border)]",
  outline: "bg-transparent text-[var(--color-foreground)] border border-[var(--color-border)]",
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30",
  warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30",
  destructive: "bg-[var(--color-destructive)]/15 text-[var(--color-destructive)] border border-[var(--color-destructive)]/30",
  info: "bg-[var(--color-info)]/15 text-[var(--color-info)] border border-[var(--color-info)]/30",
  muted: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border border-[var(--color-border)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      variants[variant],
      className,
    )}
    {...props}
  />
);
