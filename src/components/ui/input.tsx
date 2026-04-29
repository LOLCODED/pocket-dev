import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-(--color-border) bg-(--color-panel-2) px-3 text-sm text-(--color-fg) placeholder:text-(--color-fg-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
