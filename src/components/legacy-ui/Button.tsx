import { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-700 disabled:bg-primary/40 disabled:cursor-not-allowed",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-2 disabled:opacity-50",
  ghost:
    "bg-transparent text-text hover:bg-surface-2 disabled:opacity-50",
  danger:
    "bg-danger text-white hover:opacity-90 disabled:opacity-50",
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
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  } as const;
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
