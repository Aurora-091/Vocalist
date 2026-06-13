import { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const tones: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger:  "bg-danger/15 text-danger",
  info:    "bg-info/15 text-info",
  neutral: "bg-surface-2 text-text border border-border",
  primary: "bg-primary/15 text-primary",
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
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            tone === "success"
              ? "bg-success"
              : tone === "warning"
              ? "bg-warning"
              : tone === "danger"
              ? "bg-danger"
              : tone === "info"
              ? "bg-info"
              : tone === "primary"
              ? "bg-primary"
              : "bg-text-muted"
          }`}
        />
      )}
      {children}
    </span>
  );
}

export function ConsentBadge({ status }: { status: "granted" | "none" | "revoked" }) {
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
