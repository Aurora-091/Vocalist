import { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
  secondary:
    "bg-surface-2 text-text border border-border hover:bg-surface hover:border-text/30 disabled:text-text-muted disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-text-muted hover:text-text hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed",
  danger:
    "bg-danger text-white hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: "h-8 px-3 text-sm gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-12 px-5 text-base gap-2",
  } as const;
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 active:scale-[0.97] focus-ring ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
