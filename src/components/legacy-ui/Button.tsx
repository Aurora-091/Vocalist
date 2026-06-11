import { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-700 disabled:bg-primary/60 disabled:text-white/70 disabled:cursor-not-allowed shadow-sm hover:shadow-md",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-2 hover:border-text/20 disabled:text-text-muted disabled:bg-surface-2 disabled:border-border disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-text-muted hover:text-text hover:bg-surface-2 disabled:text-text-muted/60 disabled:cursor-not-allowed",
  danger:
    "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50 disabled:text-white/70 disabled:cursor-not-allowed shadow-sm",
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
