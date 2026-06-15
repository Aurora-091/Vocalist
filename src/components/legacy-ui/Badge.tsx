import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Badge as UiBadge } from "@/components/ui/badge";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

// Tone classes override the base Badge colors while keeping its shape/size/focus styles.
const tones: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  neutral: "bg-muted text-foreground border-border",
  primary: "bg-primary/15 text-primary",
};

const dotColors: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
};

export function Badge({
  tone = "neutral",
  children,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <UiBadge variant="secondary" className={cn(tones[tone])}>
      {dot && <span className={cn("size-1.5 rounded-full", dotColors[tone])} />}
      {children}
    </UiBadge>
  );
}

export function ConsentBadge({
  status,
}: {
  status: "granted" | "none" | "revoked";
}) {
  const map = {
    granted: { tone: "success" as const, label: "granted" },
    none: { tone: "neutral" as const, label: "none" },
    revoked: { tone: "danger" as const, label: "revoked" },
  };
  const { tone, label } = map[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
