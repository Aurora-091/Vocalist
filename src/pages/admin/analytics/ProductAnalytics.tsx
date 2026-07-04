import { Button } from "@/components/ui/button";

export default function ProductAnalytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Product Analytics</h1>
      <div className="flex items-center justify-center py-12">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center space-y-4 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">This section is coming in v1.1</h2>
            <p className="text-sm text-muted-foreground">
              We're building real-time revenue and retention analytics.
            </p>
          </div>
          <Button disabled className="w-full">
            Notify me
          </Button>
        </div>
      </div>
    </div>
  );
}
