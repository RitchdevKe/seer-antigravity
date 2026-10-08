import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Minimal shadcn-compatible Button (no Radix dep). Same variant/size API so
 * we can adopt real shadcn later without touching call sites.
 */
type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success"
  | "link";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
  "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--color-background)] disabled:opacity-50 " +
  "disabled:pointer-events-none select-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  default:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:brightness-110 shadow-[0_6px_24px_-8px_hsl(163_66%_51%_/_0.55)]",
  secondary:
    "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:bg-[hsl(158_47%_24%)] border border-[var(--color-border)]",
  outline:
    "bg-transparent text-[var(--color-foreground)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]",
  ghost:
    "bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]",
  destructive:
    "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:brightness-110",
  success:
    "bg-[var(--color-success)] text-[var(--color-success-foreground)] hover:brightness-110",
  link:
    "bg-transparent text-[var(--color-primary)] hover:text-[var(--color-primary-glow)] underline-offset-4 hover:underline p-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-10 w-10 p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
