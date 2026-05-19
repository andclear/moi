import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border-2 px-5 text-sm font-bold tracking-[0.02em] transition-all duration-200 ease-[var(--animal-ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-0.5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "rounded-[var(--animal-radius-pill)] border-[var(--animal-bg)] bg-[var(--animal-bg)] text-[var(--animal-text)] shadow-[0_5px_0_0_var(--animal-shadow-btn)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_var(--animal-shadow-btn)] active:shadow-[0_1px_0_0_var(--animal-shadow-btn)] focus-visible:outline-[var(--animal-primary)]",
        secondary:
          "rounded-[var(--animal-radius-pill)] border-[var(--animal-border)] bg-[var(--animal-bg-content)] text-[var(--animal-text-body)] shadow-[0_4px_0_0_var(--animal-shadow-input)] hover:-translate-y-0.5 hover:border-[var(--animal-border-hover)] hover:shadow-[0_5px_0_0_var(--animal-shadow-input)] active:shadow-[0_1px_0_0_var(--animal-shadow-input)] focus-visible:outline-[var(--animal-primary)]",
        ghost:
          "rounded-[var(--animal-radius-pill)] border-transparent bg-transparent text-[var(--animal-text-muted)] shadow-none hover:bg-[rgba(25,200,185,0.12)] hover:text-[var(--animal-text-body)] focus-visible:outline-[var(--animal-primary)]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-8 rounded-[12px] px-4 text-xs",
        icon: "h-11 w-11 px-0",
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
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  if (asChild) {
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), loading && "animal-button-loading relative")}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "animal-button-loading relative",
      )}
      aria-busy={loading || undefined}
      disabled={disabled}
      data-loading={loading || undefined}
      {...props}
    >
      {loading && !asChild ? (
        <LoaderCircle aria-hidden="true" size={18} className="relative z-10 animate-spin" />
      ) : null}
      {loading ? (
        <span className="relative z-10 inline-flex min-w-0 items-center gap-2 whitespace-nowrap [&>svg]:shrink-0">
          {children}
        </span>
      ) : (
        children
      )}
    </Comp>
  );
}
