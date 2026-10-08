import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names while resolving conflicts (later class wins).
 * Standard shadcn/ui helper so future primitives can be adopted 1:1.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
