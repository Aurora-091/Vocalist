import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  hint?: string;
}) {
  const deltaUp = delta?.startsWith("+") || delta?.startsWith("▲");
  const deltaDown = delta?.startsWith("-") || delta?.startsWith("▼");
  return (
    <div className="bg-surface border border-border rounded-md p-5 shadow-card">
      <div className="text-xs uppercase tracking-widest text-text-muted font-medium">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="font-mono text-3xl font-bold text-text">{value}</div>
        {delta && (
          <span
            className={`text-sm font-medium ${
              deltaUp ? "text-success" : deltaDown ? "text-danger" : "text-text-muted"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}
