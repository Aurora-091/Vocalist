import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  hint?: string;
  icon?: ReactNode;
}) {
  const deltaUp = delta?.startsWith("+") || delta?.startsWith("▲");
  const deltaDown = delta?.startsWith("-") || delta?.startsWith("▼");
  return (
    <Card className="gap-0 py-0 shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {label}
          </div>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="font-mono text-3xl font-bold text-foreground">
            {value}
          </div>
          {delta && (
            <span
              className={cn(
                "text-sm font-medium",
                deltaUp
                  ? "text-success"
                  : deltaDown
                    ? "text-danger"
                    : "text-muted-foreground"
              )}
            >
              {delta}
            </span>
          )}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
