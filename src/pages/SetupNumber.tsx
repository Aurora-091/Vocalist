import { useEffect, useState } from "react";
import { Phone, ShieldCheck, CircleAlert as AlertCircle, Link2, Server, Loader as Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { listPhoneNumbers } from "../lib/db";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BuyNumberDialog } from "../components/BuyNumberDialog";
import {
  TwilioAccount,
  TwilioSetupChoice,
  AccountLinked,
  CompliancePreflight,
} from "../components/TwilioAccountSection";

type PhoneNumber = {
  id: string;
  e164: string;
  byo: boolean;
  status: string | null;
  agent_id: string | null;
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
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);

  async function load() {
    try {
      const [n, status] = await Promise.all([
        listPhoneNumbers(),
        api.get<{ account: TwilioAccount | null }>("/v1/twilio/account-status").catch(() => ({ account: null })),
      ]);
      setNumbers(n || []);
      setAccount(status.account);
    } catch {
      // ignore
    } finally {
      setLoadingAccount(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="font-medium">Your numbers</div>
          </div>
          <CardContent className="px-6 py-5">
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
                    <Badge variant="secondary" className="bg-info/15 text-info">bound</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted text-foreground">unassigned</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {account ? (
        <div className="space-y-4">
          <AccountLinked account={account} onUnlink={async () => {
            if (account.account_type !== "byo_linked") return;
            await api.delete("/v1/twilio/link-account");
            setAccount(null);
            toast.success("BYO account unlinked");
          }} />
          <div className="flex justify-start">
            <Button onClick={() => setBuyDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Buy a Phone Number
            </Button>
          </div>
        </div>
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

      <BuyNumberDialog
        open={buyDialogOpen}
        onOpenChange={setBuyDialogOpen}
        onSuccess={load}
      />
    </div>
  );
}

export default function SetupNumberPage() {
  return (
    <div className="max-w-4xl">
      <SetupNumber />
    </div>
  );
}
