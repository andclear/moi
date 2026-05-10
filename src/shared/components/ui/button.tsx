import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 border-2 px-4 text-sm font-bold uppercase tracking-[0.08em] transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5",
  {
    variants: {
      variant: {
        primary:
          "border-[var(--echo-ink)] bg-[var(--echo-paper)] text-[var(--echo-ink)] shadow-[4px_4px_0_var(--echo-sepia)] hover:-translate-y-0.5",
        secondary:
          "border-[var(--echo-line)] bg-[var(--echo-panel)] text-[var(--echo-text)] hover:border-[var(--echo-paper)]",
        ghost: "border-transparent bg-transparent text-[var(--echo-muted)] hover:text-[var(--echo-text)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
