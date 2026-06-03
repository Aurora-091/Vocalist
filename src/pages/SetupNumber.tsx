import { useEffect, useMemo, useState } from "react";
import { Phone, Search, ShieldCheck, ArrowRight, CircleAlert as AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

type Available = {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  capabilities: { voice?: boolean; SMS?: boolean; MMS?: boolean };
  monthlyCostUsd?: number;
  sandbox?: boolean;
};

type Agent = { id: string; name: string };

type SetupNumberProps = {
  onComplete?: (number: any) => void;
  onSkip?: () => void;
  embedded?: boolean;
};

export function SetupNumber({ onComplete, onSkip, embedded }: SetupNumberProps) {
  const [tab, setTab] = useState<"buy" | "byo">("buy");
  const [sandbox, setSandbox] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const sub = await api<{ sandbox: boolean }>("/v1/twilio/subaccount");
        setSandbox(sub.sandbox);
      } catch {
        setSandbox(null);
      }
      try {
        const a = await api<{ agents: Agent[] }>("/v1/agents");
        setAgents(a.agents || []);
        if (a.agents?.[0]) setAgentId(a.agents[0].id);
      } catch {
        setAgents([]);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Get a phone number
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Buy a fresh number through Twilio or bring one you already own.
              Aurora wires the voice URL automatically so calls reach your agent.
            </p>
          </div>
          {sandbox && (
            <Badge tone="warning" dot>
              sandbox mode
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === "buy"} onClick={() => setTab("buy")}>
          Buy a new number
        </TabButton>
        <TabButton active={tab === "byo"} onClick={() => setTab("byo")}>
          Bring your own
        </TabButton>
      </div>

      {agents.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Bind to agent
          </label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface text-sm w-full max-w-md"
          >
            <option value="">Don't bind yet</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === "buy" ? (
        <BuyTab agentId={agentId} onComplete={onComplete} sandbox={!!sandbox} />
      ) : (
        <ByoTab agentId={agentId} onComplete={onComplete} sandbox={!!sandbox} />
      )}

      <CompliancePreflight />

      {embedded && onSkip && (
        <div className="flex justify-end pt-2">
          <button
            onClick={onSkip}
            className="text-sm text-text-muted hover:text-text"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-text"
          : "border-transparent text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function BuyTab({
  agentId,
  onComplete,
  sandbox,
}: {
  agentId: string;
  onComplete?: (n: any) => void;
  sandbox: boolean;
}) {
  const [country] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [kind, setKind] = useState<"local" | "tollfree">("local");
  const [results, setResults] = useState<Available[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  async function search() {
    if (kind === "local" && areaCode && !/^\d{3}$/.test(areaCode)) {
      setError("Area code must be 3 digits");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ country, kind });
      if (kind === "local" && areaCode) params.set("area_code", areaCode);
      const r = await api<{ results: Available[] }>(
        `/v1/twilio/numbers/search?${params}`
      );
      setResults(r.results || []);
    } catch (e: any) {
      setError(e.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function buy(num: Available) {
    setPurchasing(num.phoneNumber);
    setError(null);
    try {
      const r = await api<{ number: any }>("/v1/twilio/numbers/purchase", {
        method: "POST",
        body: JSON.stringify({
          phone_number: num.phoneNumber,
          agent_id: agentId || undefined,
        }),
      });
      onComplete?.(r.number);
    } catch (e: any) {
      setError(e.message || "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Type
              </label>
              <div className="flex gap-1 p-0.5 bg-surface-2 rounded-md">
                <SegBtn active={kind === "local"} onClick={() => setKind("local")}>
                  Local
                </SegBtn>
                <SegBtn
                  active={kind === "tollfree"}
                  onClick={() => setKind("tollfree")}
                >
                  Toll-free
                </SegBtn>
              </div>
            </div>
            {kind === "local" && (
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Area code (optional)
                </label>
                <input
                  value={areaCode}
                  onChange={(e) =>
                    setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))
                  }
                  placeholder="415"
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface font-mono text-sm"
                />
              </div>
            )}
            <Button onClick={search} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-40" />
      ) : results === null ? (
        <div className="text-sm text-text-muted">
          Run a search to see numbers available in your subaccount.
        </div>
      ) : results.length === 0 ? (
        <div className="text-sm text-text-muted">
          No numbers matched. Try a different area code.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {results.map((n) => (
            <div
              key={n.phoneNumber}
              className="border border-border rounded-md p-4 bg-surface flex items-start justify-between"
            >
              <div>
                <div className="font-mono text-base font-medium">
                  {n.friendlyName}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {n.locality || n.region} · {n.isoCountry}
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {n.capabilities.voice && (
                    <Badge tone="neutral">Voice</Badge>
                  )}
                  {n.capabilities.SMS && <Badge tone="neutral">SMS</Badge>}
                  {n.monthlyCostUsd != null && (
                    <Badge tone="info">${n.monthlyCostUsd.toFixed(2)}/mo</Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => buy(n)}
                disabled={purchasing !== null}
              >
                {purchasing === n.phoneNumber ? "Buying…" : "Use this"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {sandbox && (
        <div className="text-xs text-text-muted">
          Numbers shown are sandbox placeholders — purchasing will not charge
          your Twilio account.
        </div>
      )}
    </div>
  );
}

function ByoTab({
  agentId,
  onComplete,
  sandbox,
}: {
  agentId: string;
  onComplete?: (n: any) => void;
  sandbox: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checklist = useMemo(
    () => [
      "Aurora updates the Voice URL on your number",
      "Status callbacks routed to Aurora's webhook",
      "Calls placed against your subaccount",
    ],
    []
  );

  async function attach() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ number: any }>("/v1/twilio/numbers/byo", {
        method: "POST",
        body: JSON.stringify({
          phone_number: phone,
          twilio_sid: twilioSid || undefined,
          agent_id: agentId || undefined,
        }),
      });
      onComplete?.(r.number);
    } catch (e: any) {
      setError(e.message || "Couldn't attach number");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Phone number (E.164)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 415 555 0199"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Twilio number SID (optional)
            </label>
            <input
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="PNxxxxxxxxxxxx"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface font-mono text-sm"
            />
            <p className="mt-1 text-xs text-text-muted">
              If you provide the SID and the number is on your Aurora-managed
              subaccount, we'll re-point its voice URL automatically.
            </p>
          </div>

          <ul className="space-y-1.5 pt-2">
            {checklist.map((c) => (
              <li
                key={c}
                className="flex items-center gap-2 text-sm text-text-muted"
              >
                <ShieldCheck className="w-4 h-4 text-success" />
                {c}
              </li>
            ))}
          </ul>

          {error && (
            <div className="text-sm text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button onClick={attach} disabled={!phone || busy}>
            <Phone className="w-4 h-4 mr-2" />
            {busy ? "Attaching…" : "Attach number"}
          </Button>

          {sandbox && (
            <div className="text-xs text-text-muted">
              In sandbox mode the number is recorded locally without touching
              Twilio.
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function CompliancePreflight() {
  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Compliance preflight</div>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <span>
              Recording disclosure plays at the start of every call by default.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <span>
              Outbound calls respect calling-window hours and the consent gate.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <span>
              For US toll-free outbound, complete A2P 10DLC and toll-free
              verification in your Twilio console before going live.
            </span>
          </li>
        </ul>
      </CardBody>
    </Card>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 text-sm rounded ${
        active ? "bg-surface text-text shadow-sm" : "text-text-muted"
      }`}
    >
      {children}
    </button>
  );
}

export default function SetupNumberPage() {
  return (
    <div className="max-w-4xl">
      <SetupNumber />
    </div>
  );
}
