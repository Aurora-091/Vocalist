import { DollarSign, TrendingUp, TrendingDown, Timer } from "lucide-react";

const cards = [
  { label: "MRR", icon: DollarSign },
  { label: "ARR", icon: TrendingUp },
  { label: "Churn", icon: TrendingDown },
  { label: "LTV", icon: Timer },
];

export default function RevenueAnalytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Revenue Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3">
            <c.icon className="w-8 h-8 text-muted-foreground/50" />
            <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
            <span className="text-xs text-muted-foreground/60">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
