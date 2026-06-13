import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, Loader as Loader2 } from "lucide-react";
import { listVerticals, updateOnboardingStep, getOnboardingSteps, createAgent, createKnowledgeSource } from "../lib/db";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";

type Vertical = { id: string; key: string; label: string; config: any; enabled: boolean };

const STEP_KEYS = [
  "pick_vertical",
  "connect_tools",
  "add_knowledge",
  "create_agent",
  "get_number",
  "test_and_golive",
] as const;
type StepKey = (typeof STEP_KEYS)[number];

const stepLabels: Record<StepKey, string> = {
  pick_vertical: "Pick your business",
  connect_tools: "Connect a tool",
  add_knowledge: "Add knowledge",
  create_agent: "Create your agent",
  get_number: "Get a phone number",
  test_and_golive: "Test and go live",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<Record<string, boolean>>({});
  const [verticals, setVerticals] = useState<Vertical[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [v, s] = await Promise.all([
          listVerticals(),
          getOnboardingSteps(),
        ]);
        setVerticals(v || []);
        setSteps(s || {});
        const firstUndone = STEP_KEYS.findIndex((k) => !s?.[k]);
        if (firstUndone > 0) setStepIndex(firstUndone);
      } catch {}
    })();
  }, []);

  function markDone(key: StepKey) {
    setSteps((s) => ({ ...s, [key]: true }));
    updateOnboardingStep(key, true);
  }

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEP_KEYS.length - 1));
  }

  const currentKey = STEP_KEYS[stepIndex];

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
          <div className="px-8 pt-8 pb-4 border-b border-border">
            <div className="flex items-center gap-1.5 mb-3">
              {STEP_KEYS.map((k, i) => (
                <span
                  key={k}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    steps[k]
                      ? "bg-success"
                      : i === stepIndex
                      ? "bg-primary"
                      : "bg-surface-2"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-muted">
                Step {stepIndex + 1} of {STEP_KEYS.length}
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="text-xs text-text-muted hover:text-text"
              >
                Skip onboarding
              </button>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              {stepLabels[currentKey]}
            </h1>
          </div>

          <div className="p-8">
            {currentKey === "pick_vertical" && (
              <PickVertical
                verticals={verticals}
                done={steps.pick_vertical}
                onDone={() => {
                  markDone("pick_vertical");
                  next();
                }}
              />
            )}

            {currentKey === "connect_tools" && (
              <ConnectTools
                onSkip={() => {
                  markDone("connect_tools");
                  next();
                }}
              />
            )}

            {currentKey === "add_knowledge" && (
              <AddKnowledge
                onDone={() => {
                  markDone("add_knowledge");
                  next();
                }}
                onSkip={next}
              />
            )}

            {currentKey === "create_agent" && (
              <CreateAgentStep
                onDone={() => {
                  markDone("create_agent");
                  next();
                }}
                onSkip={next}
              />
            )}

            {currentKey === "get_number" && (
              <GetNumber
                onDone={() => {
                  markDone("get_number");
                  next();
                }}
                onSkip={next}
              />
            )}

            {currentKey === "test_and_golive" && (
              <TestAndGoLive
                onDone={() => {
                  markDone("test_and_golive");
                  navigate("/dashboard");
                }}
              />
            )}
          </div>

          <div className="px-8 pb-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStepIndex((i) => Math.max(i - 1, 0))}
              disabled={stepIndex === 0}
            >
              Back
            </Button>
            {currentKey !== "pick_vertical" && currentKey !== "test_and_golive" && (
              <Button variant="secondary" onClick={next}>
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PickVertical({
  verticals,
  done,
  onDone,
}: {
  verticals: Vertical[];
  done: boolean;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(id: string) {
    setSelected(id);
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const meta = session.session?.user.app_metadata as any;
      const orgId = meta?.org_id;
      if (orgId) {
        await supabase.from("orgs").update({ vertical_config_id: id }).eq("id", orgId);
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-6">
        We'll preconfigure agent personas, segments, and outcomes for your
        industry.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {verticals.length === 0 ? (
          <>
            <button
              onClick={() => onDone()}
              className="text-left p-5 rounded-md border border-border bg-surface hover:bg-surface-2"
            >
              <div className="font-medium">E-commerce (Shopify)</div>
              <p className="mt-2 text-sm text-text-muted">
                Recover carts, support orders, run promo blasts.
              </p>
            </button>
            <button
              onClick={() => onDone()}
              className="text-left p-5 rounded-md border border-border bg-surface hover:bg-surface-2"
            >
              <div className="font-medium">Healthcare / Clinic</div>
              <p className="mt-2 text-sm text-text-muted">
                Book appointments, send reminders, recover no-shows.
              </p>
            </button>
          </>
        ) : (
          verticals.map((v) => (
            <button
              key={v.id}
              onClick={() => pick(v.id)}
              disabled={busy}
              className={`text-left p-5 rounded-md border transition-colors ${
                selected === v.id
                  ? "border-text bg-surface-2 text-text"
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
          ))
        )}
      </div>
      {done && (
        <div className="mt-4 text-sm text-success flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          Saved.
        </div>
      )}
    </div>
  );
}

function ConnectTools({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Connect tools so Weeber can read calendar availability, customer
        records, and order history. You can connect more later from
        Integrations.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { name: "Cal.com", note: "Booking & availability" },
          { name: "HubSpot", note: "Contacts & deal sync" },
          { name: "Shopify", note: "Orders & abandoned carts" },
          { name: "Google Calendar", note: "Schedule reads & writes" },
        ].map((t) => (
          <div
            key={t.name}
            className="border border-border rounded-md p-4 bg-surface flex items-center justify-between"
          >
            <div>
              <div className="font-medium text-sm">{t.name}</div>
              <div className="text-xs text-text-muted">{t.note}</div>
            </div>
            <Button size="sm" variant="secondary" disabled>
              Connect
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function AddKnowledge({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}) {
  const [title, setTitle] = useState("");
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await createKnowledgeSource({ kind: "website", title, uri });
      onDone();
    } catch (e: any) {
      setError(e.message || "Couldn't add source");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Point Weeber at a public help page, FAQ, or product catalog. We'll
        crawl and embed it so the agent answers from your real content.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="FAQ"
          className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
        />
        <input
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="https://example.com/faq"
          className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
        />
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="flex gap-2">
        <Button onClick={add} disabled={!title || !uri || busy}>
          {busy ? "Adding…" : "Add source"}
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function CreateAgentStep({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("Front Desk");
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [objective, setObjective] = useState(
    "Answer questions, book appointments, route to a human if asked."
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await createAgent({
        name,
        persona: { direction, objective, tone: "warm and professional" },
        consent_required: direction === "outbound",
        provider: "elevenlabs",
      });
      onDone();
    } catch (e: any) {
      setError(e.message || "Couldn't create agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          Agent name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-surface w-full max-w-md"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          Direction
        </label>
        <div className="flex gap-1 p-0.5 bg-surface-2 rounded-md w-fit">
          <button
            onClick={() => setDirection("inbound")}
            className={`px-3 h-9 text-sm rounded ${
              direction === "inbound"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted"
            }`}
          >
            Inbound
          </button>
          <button
            onClick={() => setDirection("outbound")}
            className={`px-3 h-9 text-sm rounded ${
              direction === "outbound"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted"
            }`}
          >
            Outbound
          </button>
        </div>
        {direction === "outbound" && (
          <p className="mt-1 text-xs text-text-muted">
            Outbound agents always require consent on file before dialing.
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">
          Context (Objective)
        </label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-md border border-border bg-surface text-sm"
        />
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="flex gap-2">
        <Button onClick={create} disabled={!name || busy}>
          {busy ? "Creating…" : "Create agent"}
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function GetNumber({
  onDone,
  onSkip,
}: {
  onDone: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Phone numbers are provisioned through Twilio once your account is
        connected. You can bring your own (BYO) number or get a new one from Weeber.
      </p>
      <p className="text-sm text-text-muted">
        This step requires your Twilio credentials to be configured in Settings.
        You can skip for now and come back later.
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function TestAndGoLive({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  function done() {
    setBusy(true);
    onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        You're set. Weeber's compliance gates and recording disclosure are on
        by default. Open an agent's detail page to place a test call before
        flipping any live campaigns.
      </p>
      <Button onClick={done} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
        Finish onboarding
      </Button>
    </div>
  );
}
