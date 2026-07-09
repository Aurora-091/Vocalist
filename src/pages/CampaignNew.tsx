import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader as Loader2 } from "lucide-react";
import { listAgents, createCampaign } from "../lib/db";
import { useVertical } from "../lib/VerticalContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";

export default function CampaignNew() {
  const navigate = useNavigate();
  const { t } = useVertical();
  const [agents, setAgents] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [concurrency, setConcurrency] = useState(5);
  const [maxRetries, setMaxRetries] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const all = await listAgents();
      const eligible = all.filter(
        (a: any) => a.persona?.direction !== "inbound"
      );
      setAgents(eligible.length > 0 ? eligible : all);
      if (eligible[0]) setAgentId(eligible[0].id);
      else if (all[0]) setAgentId(all[0].id);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const campaign = await createCampaign({
        name,
        agent_id: agentId,
        concurrency,
        max_retries: maxRetries,
      });
      navigate(`/campaigns/${campaign.id}`);
    } catch (e: any) {
      setErr(e.message || `Couldn't create ${t("campaign")}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to {t("campaigns")}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New {t("campaign")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Weeber dials only {t("contacts")} with consent on file. Opt-outs are honored
          immediately.
        </p>
      </div>

      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Campaign details</div>
        </div>
        <CardContent className="px-6 py-5">
          {agents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              You need an {t("agent")} before creating a {t("campaign")}.{" "}
              <Link to="/agents" className="text-primary hover:text-primary-700">
                Create one
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={submit}>
              <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="campaign-name">Name</FieldLabel>
                <Input
                  id="campaign-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="June recovery push"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="campaign-agent">{t("agent")}</FieldLabel>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger id="campaign-agent" className="w-full">
                    <SelectValue placeholder={`Select an ${t("agent")}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {agents.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="campaign-concurrency">Concurrency</FieldLabel>
                  <Input
                    id="campaign-concurrency"
                    type="number"
                    min={1}
                    max={100}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="campaign-retries">Max retries</FieldLabel>
                  <Input
                    id="campaign-retries"
                    type="number"
                    min={0}
                    max={10}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                  />
                </Field>
              </div>
              {err && (
                <Field data-invalid>
                  <FieldError>{err}</FieldError>
                </Field>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => navigate("/campaigns")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {submitting ? "Creating…" : `Create ${t("campaign")}`}
                </Button>
              </div>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


