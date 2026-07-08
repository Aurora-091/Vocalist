import { useEffect, useState } from "react";
import { Search, Phone, Loader as Loader2, Check, Sparkles, Globe, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { listAgents } from "../lib/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
  monthlyCostUsd: number;
};

type Agent = {
  id: string;
  name: string;
};

type BuyNumberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function BuyNumberDialog({
  open,
  onOpenChange,
  onSuccess,
}: BuyNumberDialogProps) {
  // Common State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("none");
  const [activeTab, setActiveTab] = useState<string>("buy");

  // Tab 1: Search & Buy State
  const [country, setCountry] = useState("US");
  const [kind, setKind] = useState<"local" | "tollfree">("local");
  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [purchasingNumber, setPurchasingNumber] = useState<AvailableNumber | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // Tab 2: Link BYO State
  const [byoPhone, setByoPhone] = useState("");
  const [byoSubmitting, setByoSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      listAgents().then(setAgents).catch(() => {});
      // Reset state
      setResults([]);
      setHasSearched(false);
      setAreaCode("");
      setCountry("US");
      setKind("local");
      setSelectedAgentId("none");
      setPurchasingNumber(null);
      setByoPhone("");
      setActiveTab("buy");
    }
  }, [open]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setResults([]);
    setHasSearched(true);
    try {
      const q = new URLSearchParams();
      q.set("country", country);
      q.set("kind", kind);
      if (kind === "local" && areaCode.trim()) {
        q.set("area_code", areaCode.trim());
      }
      
      const res = await api.get<{ results: AvailableNumber[] }>(
        `/v1/twilio/numbers/search?${q.toString()}`
      );
      setResults(res.results || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to search numbers");
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(num: AvailableNumber) {
    setPurchasingNumber(num);
    setPurchasing(true);
    try {
      const payload: { phone_number: string; agent_id?: string } = {
        phone_number: num.phoneNumber,
      };
      if (selectedAgentId !== "none") {
        payload.agent_id = selectedAgentId;
      }

      await api.post("/v1/twilio/numbers/purchase", payload);
      toast.success(`Successfully purchased ${num.friendlyName}`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to purchase phone number");
    } finally {
      setPurchasing(false);
      setPurchasingNumber(null);
    }
  }

  async function handleLinkByo(e: React.FormEvent) {
    e.preventDefault();
    if (!byoPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    setByoSubmitting(true);
    try {
      const payload: { phone_number: string; agent_id?: string } = {
        phone_number: byoPhone.trim(),
      };
      if (selectedAgentId !== "none") {
        payload.agent_id = selectedAgentId;
      }

      // Try linking with Twilio settings first, if not configured fallback to simple db insert
      try {
        await api.post("/v1/twilio/numbers/byo", payload);
      } catch (twilioErr: any) {
        if (twilioErr.message?.includes("No active Twilio account linked")) {
          // Fallback to general BYO endpoint
          await api.post("/v1/numbers/byo", payload);
        } else {
          throw twilioErr;
        }
      }

      toast.success("BYO Phone number added successfully");
      setByoPhone("");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to link phone number");
    } finally {
      setByoSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Phone className="w-5 h-5 text-primary" />
            Provision Phone Number
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Get a number to receive inbound calls or place outbound campaign calls.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 border-b bg-muted/20">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy">Search & Buy Managed</TabsTrigger>
              <TabsTrigger value="byo">Link BYO Number</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Auto-Assign Agent Selector (Common to both tabs) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Assign Agent
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Assign this number to an active voice agent directly upon acquisition.
                </p>
              </div>
              <div className="w-full sm:w-60">
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't assign (leave unassigned)</SelectItem>
                    {agents.map((ag) => (
                      <SelectItem key={ag.id} value={ag.id}>
                        {ag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="buy" className="space-y-6 mt-0">
              {/* Search Form */}
              <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-muted/40 p-4 rounded-lg border border-border">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="country" className="text-xs font-semibold text-muted-foreground">Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="country" className="bg-background h-9">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">🇺🇸 United States</SelectItem>
                      <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                      <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="kind" className="text-xs font-semibold text-muted-foreground">Type</Label>
                  <Select value={kind} onValueChange={(val: any) => {
                    setKind(val);
                    if (val === "tollfree") setAreaCode("");
                  }}>
                    <SelectTrigger id="kind" className="bg-background h-9">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="tollfree">Toll-Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="areaCode" className="text-xs font-semibold text-muted-foreground">Area Code</Label>
                  <Input
                    id="areaCode"
                    placeholder="e.g. 415"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    disabled={kind === "tollfree"}
                    className="bg-background font-mono h-9"
                  />
                </div>

                <Button type="submit" disabled={searching} className="w-full h-9">
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </form>

              {/* Results Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available Numbers</h3>
                
                {searching ? (
                  <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-sm">Fetching available Twilio numbers...</span>
                  </div>
                ) : results.length > 0 ? (
                  <div className="border border-border rounded-md overflow-hidden bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/45">
                          <TableHead className="h-9 text-xs font-semibold">Number</TableHead>
                          <TableHead className="h-9 text-xs font-semibold">Location</TableHead>
                          <TableHead className="h-9 text-xs font-semibold">Capabilities</TableHead>
                          <TableHead className="h-9 text-xs font-semibold">Cost</TableHead>
                          <TableHead className="h-9 text-right text-xs font-semibold pr-4">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((num) => {
                          const isThisPurchasing = purchasing && purchasingNumber?.phoneNumber === num.phoneNumber;
                          return (
                            <TableRow key={num.phoneNumber} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-mono text-sm py-2">
                                {num.friendlyName}
                              </TableCell>
                              <TableCell className="text-xs py-2">
                                {num.locality ? `${num.locality}, ${num.region}` : "National"}
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex gap-1">
                                  {num.capabilities.voice && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Voice</Badge>
                                  )}
                                  {num.capabilities.SMS && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">SMS</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-mono py-2">
                                ${num.monthlyCostUsd.toFixed(2)}/mo
                              </TableCell>
                              <TableCell className="text-right py-2 pr-4">
                                <Button
                                  size="sm"
                                  disabled={purchasing}
                                  onClick={() => handlePurchase(num)}
                                  className="h-7 text-xs px-3"
                                >
                                  {isThisPurchasing ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Buying...
                                    </>
                                  ) : (
                                    "Buy"
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : hasSearched ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-md bg-muted/20">
                    <Globe className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
                    <p className="text-sm font-medium">No numbers found matching criteria.</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Try searching a different area code or type.</p>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-md bg-muted/10">
                    <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm">Submit the search form above to find phone numbers.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="byo" className="space-y-4 mt-0">
              <form onSubmit={handleLinkByo} className="space-y-4 max-w-md mx-auto py-4">
                <div className="space-y-2">
                  <Label htmlFor="byo-phone">Phone Number</Label>
                  <Input
                    id="byo-phone"
                    placeholder="e.g. +14155551234"
                    value={byoPhone}
                    onChange={(e) => setByoPhone(e.target.value)}
                    className="font-mono"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enter the phone number in E.164 international format (with + prefix).
                  </p>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={byoSubmitting} className="h-9">
                    {byoSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Link BYO Number
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t bg-muted/30">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={purchasing || byoSubmitting} className="h-9">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
