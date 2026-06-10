import { useEffect, useState } from "react";
import { Phone, ShieldCheck, CircleAlert as AlertCircle } from "lucide-react";
import { listAgents, listPhoneNumbers } from "../lib/db";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";

type Agent = { id: string; name: string };

type SetupNumberProps = {
  onComplete?: (number: any) => void;
  onSkip?: () => void;
  embedded?: boolean;
};

export function SetupNumber({ onComplete, onSkip, embedded }: SetupNumberProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [a, n] = await Promise.all([listAgents(), listPhoneNumbers()]);
      setAgents(a || []);
      setNumbers(n || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Get a phone number
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Phone numbers are provisioned through Twilio. Connect your Twilio account
          in Settings to search and purchase numbers, or bring your own.
        </p>
      </div>

      {numbers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="font-medium">Your numbers</div>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-border">
              {numbers.map((n) => (
                <div key={n.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-text-muted" />
                    <div>
                      <div className="font-mono text-sm">{n.e164}</div>
                      <div className="text-xs text-text-muted">
                        {n.byo ? "BYO" : "Aurora-managed"} · {n.status || "active"}
                      </div>
                    </div>
                  </div>
                  {n.agent_id ? (
                    <Badge tone="info">bound</Badge>
                  ) : (
                    <Badge tone="neutral">unassigned</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="font-medium">Twilio integration required</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted">
            Number search and purchase requires Twilio credentials to be configured.
            Go to Settings to add your Twilio Account SID and Auth Token. Once connected,
            you'll be able to search for local and toll-free numbers directly from this page.
          </p>
        </CardBody>
      </Card>

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

export default function SetupNumberPage() {
  return (
    <div className="max-w-4xl">
      <SetupNumber />
    </div>
  );
}
