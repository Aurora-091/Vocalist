import { useEffect, useState } from "react";
import { Phone, ShieldCheck, CircleAlert as AlertCircle, Link2, Server, Loader as Loader2, Search, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { listPhoneNumbers } from "../lib/db";
import { api } from "../lib/api";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";

type PhoneNumber = {
  id: string;
  e164: string;
  byo: boolean;
  status: string | null;
  agent_id: string | null;
};

type TwilioAccount = {
  subaccount_sid: string;
  status: string;
  account_type: "aurora_managed" | "byo_linked";
  friendly_name: string | null;
  verified_at: string | null;
};

type SetupNumberProps = {
  onComplete?: (number: any) => void;
  onSkip?: () => void;
  embedded?: boolean;
};

export function SetupNumber({ onComplete, onSkip, embedded }: SetupNumberProps) {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [account, setAccount] = useState<TwilioAccount | null | undefined>(undefined);
  const [loadingAccount, setLoadingAccount] = useState(true);

  async function loadData() {
    try {
      const [n, status] = await Promise.all([
        listPhoneNumbers(),
        api.get<{ account: TwilioAccount | null }>("/v1/twilio/account-status").catch(() => ({ account: null })),
      ]);
      setNumbers(n || []);
      setAccount(status.account);
    } catch (e: any) {
      toast.error("Failed to load setup state: " + e.message);
    } finally {
      setLoadingAccount(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleNumberAcquired(newNum: any) {
    const n = await listPhoneNumbers();
    setNumbers(n || []);
    if (onComplete) {
      onComplete(newNum);
    }
  }

  if (loadingAccount) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Twilio account status…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Get a phone number</h2>
        <p className="text-sm text-text-muted mt-1">
          Numbers are provisioned through Twilio. Use your own account or let Weeber manage one for you.
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
                        {n.byo ? "BYO" : "Weeber-managed"} · {n.status || "active"}
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

      {account ? (
        <>
          <AccountLinked
            account={account}
            onUnlink={async () => {
              if (account.account_type !== "byo_linked") return;
              await api.delete("/v1/twilio/link-account");
              setAccount(null);
              toast.success("BYO account unlinked");
            }}
          />

          {account.account_type === "aurora_managed" ? (
            <NumberSearchAndPurchase onNumberAcquired={handleNumberAcquired} />
          ) : (
            <ByoNumberSelector onNumberAcquired={handleNumberAcquired} />
          )}
        </>
      ) : (
        <TwilioSetupChoice
          onAuroraManaged={async () => {
            const result = await api.post<{ subaccount: TwilioAccount }>("/v1/twilio/subaccount");
            setAccount(result.subaccount as TwilioAccount);
            toast.success("Weeber-managed Twilio sub-account provisioned");
          }}
          onByoLinked={(acct) => {
            setAccount(acct);
          }}
        />
      )}

      <CompliancePreflight />

      {embedded && onSkip && (
        <div className="flex justify-end pt-2">
          <button onClick={onSkip} className="text-sm text-text-muted hover:text-text">
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

function NumberSearchAndPurchase({ onNumberAcquired }: { onNumberAcquired: (num: any) => void }) {
  const [areaCode, setAreaCode] = useState("");
  const [kind, setKind] = useState<"local" | "tollfree">("local");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [purchasingSid, setPurchasingSid] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const q = new URLSearchParams({
        country: "US",
        kind,
        ...(areaCode.trim() ? { area_code: areaCode.trim() } : {}),
      });
      const res = await api.get<{ results: any[] }>(`/v1/twilio/numbers/search?${q.toString()}`);
      setResults(res.results || []);
      if (res.results.length === 0) {
        toast.info("No numbers found matching criteria.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to search numbers");
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    setPurchasingSid(phoneNumber);
    try {
      const res = await api.post<{ number: any }>("/v1/twilio/numbers/purchase", {
        phone_number: phoneNumber,
      });
      toast.success(`Purchased number ${phoneNumber} successfully!`);
      onNumberAcquired(res.number);
      setResults((prev) => prev.filter((r) => r.phoneNumber !== phoneNumber));
    } catch (err: any) {
      toast.error(err.message || "Failed to purchase number");
    } finally {
      setPurchasingSid(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <span className="font-medium">Search and Purchase Numbers</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row items-end gap-3 bg-surface-2 p-3 rounded-lg border border-border"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-text-muted mb-1">Area Code (Optional)</label>
            <input
              type="text"
              maxLength={3}
              placeholder="e.g. 415"
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-medium text-text-muted mb-1">Type</label>
            <select
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
            >
              <option value="local">Local</option>
              <option value="tollfree">Toll-Free</option>
            </select>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={searching}
            className="w-full sm:w-auto px-4 py-1.5 h-[34px] flex items-center justify-center"
          >
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>

        {results.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden bg-surface max-h-60 overflow-y-auto">
            {results.map((r) => (
              <div key={r.phoneNumber} className="p-3 flex items-center justify-between hover:bg-surface-2 transition-colors">
                <div>
                  <div className="font-mono text-sm font-semibold text-text">{r.friendlyName || r.phoneNumber}</div>
                  <div className="text-xs text-text-muted">
                    {r.locality ? `${r.locality}, ${r.region}` : r.isoCountry} · {kind === "tollfree" ? "$2.00/mo" : "$1.15/mo"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={purchasingSid !== null}
                  onClick={() => handlePurchase(r.phoneNumber)}
                >
                  {purchasingSid === r.phoneNumber ? "Buying…" : "Buy"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ByoNumberSelector({ onNumberAcquired }: { onNumberAcquired: (num: any) => void }) {
  const [existingNumbers, setExistingNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingNumber, setLinkingNumber] = useState<string | null>(null);

  async function loadExisting() {
    setLoading(true);
    try {
      const res = await api.get<{ numbers: any[] }>("/v1/twilio/numbers/existing");
      setExistingNumbers(res.numbers || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load numbers from your Twilio account");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExisting();
  }, []);

  async function handleLink(numberInfo: any) {
    const phoneNumber = numberInfo.phoneNumber;
    setLinkingNumber(phoneNumber);
    try {
      const res = await api.post<{ number: any }>("/v1/twilio/numbers/byo", {
        phone_number: phoneNumber,
        twilio_sid: numberInfo.sid,
      });
      toast.success(`Linked number ${phoneNumber} successfully!`);
      onNumberAcquired(res.number);
      setExistingNumbers((prev) => prev.filter((n) => n.phoneNumber !== phoneNumber));
    } catch (err: any) {
      toast.error(err.message || "Failed to link number");
    } finally {
      setLinkingNumber(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading available numbers from your Twilio account…
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="font-medium">Link Available BYO Numbers</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {existingNumbers.length === 0 ? (
          <p className="text-sm text-text-muted">
            No unlinked phone numbers found in your linked Twilio account.
          </p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden bg-surface max-h-60 overflow-y-auto">
            {existingNumbers.map((n) => (
              <div key={n.phoneNumber} className="p-3 flex items-center justify-between hover:bg-surface-2 transition-colors">
                <div>
                  <div className="font-mono text-sm font-semibold text-text">{n.friendlyName || n.phoneNumber}</div>
                  <div className="text-xs text-text-muted font-mono">{n.sid}</div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={linkingNumber !== null}
                  onClick={() => handleLink(n)}
                >
                  {linkingNumber === n.phoneNumber ? "Linking…" : "Link"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TwilioSetupChoice({
  onAuroraManaged,
  onByoLinked,
}: {
  onAuroraManaged: () => Promise<void>;
  onByoLinked: (acct: TwilioAccount) => void;
}) {
  const [mode, setMode] = useState<"choose" | "aurora" | "byo">("choose");
  const [loading, setLoading] = useState(false);
  const [byoSid, setByoSid] = useState("");
  const [byoToken, setByoToken] = useState("");
  const [byoName, setByoName] = useState("");

  async function handleAurora() {
    setLoading(true);
    try {
      await onAuroraManaged();
    } catch (e: any) {
      toast.error(e.message || "Failed to provision sub-account");
    } finally {
      setLoading(false);
    }
  }

  async function handleByo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.post<{ account: TwilioAccount }>("/v1/twilio/link-account", {
        account_sid: byoSid.trim(),
        auth_token: byoToken.trim(),
        friendly_name: byoName.trim() || undefined,
      });
      toast.success("Twilio account linked successfully");
      onByoLinked(result.account);
    } catch (e: any) {
      toast.error(e.message || "Failed to link Twilio account");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "byo") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            <span className="font-medium">Link your Twilio account</span>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleByo} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1">Account SID</label>
              <input
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={byoSid}
                onChange={(e) => setByoSid(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Auth Token</label>
              <input
                type="password"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Your Twilio auth token"
                value={byoToken}
                onChange={(e) => setByoToken(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Friendly name (optional)</label>
              <input
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="My Twilio Account"
                value={byoName}
                onChange={(e) => setByoName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={loading}>
                {loading ? "Linking…" : "Link account"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("choose")}>
                Back
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <button
        onClick={() => setMode("byo")}
        className="text-left bg-surface border border-border hover:border-primary rounded-md p-6 transition-colors group"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-surface-2 rounded-md group-hover:bg-primary/10">
            <Link2 className="w-5 h-5 text-text-muted group-hover:text-primary" />
          </div>
          <div className="font-medium">Use your own Twilio account</div>
        </div>
        <p className="text-sm text-text-muted">
          Link an existing Twilio account. Use your own numbers, keep full control, and
          avoid Weeber provisioning your sub-account.
        </p>
      </button>

      <button
        onClick={handleAurora}
        disabled={loading}
        className="text-left bg-surface border border-border hover:border-primary rounded-md p-6 transition-colors group disabled:opacity-50"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-surface-2 rounded-md group-hover:bg-primary/10">
            <Server className="w-5 h-5 text-text-muted group-hover:text-primary" />
          </div>
          <div className="font-medium">
            {loading ? "Provisioning…" : "Let Weeber manage numbers"}
          </div>
        </div>
        <p className="text-sm text-text-muted">
          Weeber provisions a Twilio sub-account for you. Easiest setup — search and
          purchase numbers directly from this dashboard.
        </p>
      </button>
    </div>
  );
}

function AccountLinked({
  account,
  onUnlink,
}: {
  account: TwilioAccount;
  onUnlink: () => Promise<void>;
}) {
  const [unlinking, setUnlinking] = useState(false);

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await onUnlink();
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {account.account_type === "byo_linked" ? (
              <Link2 className="w-4 h-4 text-text-muted" />
            ) : (
              <Server className="w-4 h-4 text-text-muted" />
            )}
            <span className="font-medium">
              {account.account_type === "byo_linked"
                ? "Your Twilio account linked"
                : "Weeber-managed sub-account"}
            </span>
          </div>
          <Badge tone={account.status === "active" ? "success" : "warning"}>
            {account.status}
          </Badge>
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {account.friendly_name && (
              <div className="text-sm font-medium">{account.friendly_name}</div>
            )}
            <div className="font-mono text-xs text-text-muted">{account.subaccount_sid}</div>
            {account.verified_at && (
              <div className="text-xs text-text-muted">
                Verified {new Date(account.verified_at).toLocaleDateString()}
              </div>
            )}
          </div>
          {account.account_type === "byo_linked" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinking}
            >
              {unlinking ? "Unlinking…" : "Unlink"}
            </Button>
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
            <span>Recording disclosure plays at the start of every call by default.</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <span>Outbound calls respect calling-window hours and the consent gate.</span>
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
