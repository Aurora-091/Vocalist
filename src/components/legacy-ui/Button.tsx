import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button as UiButton } from "@/components/ui/button";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantMap = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
} as const;

const sizeMap = {
  sm: "sm",
  md: "default",
  lg: "lg",
} as const;

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
  return (
    <UiButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={cn(
        // Preserve the legacy solid danger treatment (shadcn destructive is a subtle tint).
        variant === "danger" &&
          "bg-destructive text-white hover:bg-destructive/90",
        className
      )}
      {...rest}
    >
      {children}
    </UiButton>
  );
}
