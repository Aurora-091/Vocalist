import { Users, Repeat, Filter, Activity } from "lucide-react";

const cards = [
  { label: "User Growth", icon: Users },
  { label: "Retention", icon: Repeat },
  { label: "Funnel", icon: Filter },
  { label: "Engagement", icon: Activity },
];

export default function ProductAnalytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Product Analytics</h1>
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
