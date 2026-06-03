import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";

type Vertical = { id: string; key: string; label: string; config: any };

const stepLabels = [
  "Pick your business",
  "Connect a tool",
  "Add knowledge",
  "Create your agent",
  "Get a phone number",
  "Test and go live",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await api<{ verticals: Vertical[] }>("/v1/verticals");
        setVerticals(v.verticals || []);
      } catch {
        setVerticals([]);
      }
    })();
  }, []);

  async function pickVertical(id: string) {
    setSelected(id);
    setLoading(true);
    try {
      await api("/v1/verticals/select", {
        method: "POST",
        body: JSON.stringify({ vertical_config_id: id }),
      });
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface border border-border rounded-md shadow-card p-8">
          <div className="flex items-center gap-2 mb-2">
            {stepLabels.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= step ? "bg-primary" : "bg-surface-2"
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-text-muted">
            Step {step + 1} of {stepLabels.length}
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {step === 0 ? "What kind of business is this?" : stepLabels[step]}
          </h1>

          {step === 0 && (
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {verticals.map((v) => (
                <button
                  key={v.id}
                  onClick={() => pickVertical(v.id)}
                  disabled={loading}
                  className={`text-left p-5 rounded-md border transition-colors ${
                    selected === v.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className="font-medium">{v.label}</div>
                  <p className="mt-2 text-sm text-text-muted">
                    {v.key === "shopify"
                      ? "Recover carts, support orders, run promo blasts."
                      : "Book appointments, send reminders, recover no-shows."}
                  </p>
                </button>
              ))}
            </div>
          )}

          {step > 0 && (
            <div className="mt-6 text-sm text-text-muted">
              You can finish setup right from the dashboard. The checklist will
              guide you through connecting a tool, adding knowledge, creating
              your first agent, getting a number, and placing a test call.
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              disabled={step === 0}
            >
              Skip for now
            </Button>
            <Button onClick={() => navigate("/")} disabled={step === 0 && !selected}>
              <Check className="w-4 h-4 mr-2" />
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
