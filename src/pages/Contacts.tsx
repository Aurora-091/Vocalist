import { useEffect, useState, useRef } from "react";
import { Plus, Upload, Search, Trash2, ShieldOff } from "lucide-react";
import { listContacts, createContact, deleteContact as deleteContactDb } from "../lib/db";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useVertical } from "../lib/VerticalContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatPhone } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { Field, FieldGroup, FieldError } from "@/components/ui/field";

type Contact = {
  id: string;
  e164: string;
  name: string | null;
  email: string | null;
  source: string | null;
  consent_status: "granted" | "none" | "revoked";
  created_at: string;
};

export default function Contacts() {
  usePageTitle("Contacts");
  const { t } = useVertical();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dncUploading, setDncUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(query?: string) {
    try {
      setContacts(await listContacts({ q: query || undefined, limit: 100 }));
    } catch {
      toast.error("Failed to load contacts");
      setContacts([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSearch(val: string) {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val), 350);
  }

  async function deleteContact(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    const prev = contacts;
    setContacts((c) => c?.filter((x) => x.id !== id) ?? null);
    try {
      await deleteContactDb(id);
    } catch {
      setContacts(prev);
      toast.error("Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("contacts")}</h1>
          <p className="text-sm text-text-muted mt-1">
            Numbers we can dial. Consent-aware by default.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={() => setDncUploading(true)}>
            <ShieldOff className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">DNC Upload</span>
            <span className="sm:hidden">DNC</span>
          </Button>
          <Button variant="outline" onClick={() => setImporting(true)}>
            <Upload className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add {t("contact").toLowerCase()}</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, email, or phone"
          aria-label="Search contacts"
        />
      </InputGroup>

      {creating && <CreateForm onClose={() => setCreating(false)} onSaved={() => load(q)} />}
      {importing && <ImportForm onClose={() => setImporting(false)} onDone={() => load(q)} />}
      {dncUploading && <DncUploadForm onClose={() => setDncUploading(false)} onDone={() => load(q)} />}

      {contacts === null ? (
        <Skeleton className="h-64" aria-label="Loading contacts" />
      ) : contacts.length === 0 ? (
        <Empty className="bg-card border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Plus className="w-8 h-8" /></EmptyMedia>
            <EmptyTitle>No contacts yet</EmptyTitle>
            <EmptyDescription>Add a single contact or import a CSV. We'll match consent on the way in.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add contact
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-md shadow-card overflow-hidden">
            <Table aria-label="Contacts list">
              <TableCaption srOnly>
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""}{q ? ` matching "${q}"` : ""}
              </TableCaption>
              <TableHeader className="bg-muted">
                <TableRow>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th>Consent</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id} className="group">
                    <Td>{c.name || <span className="text-muted-foreground" aria-label="No name">—</span>}</Td>
                    <Td className="font-mono"><span title={c.e164}>{formatPhone(c.e164)}</span></Td>
                    <Td>{c.email || <span className="text-muted-foreground" aria-label="No email">—</span>}</Td>
                    <Td className="text-muted-foreground">{c.source || "—"}</Td>
                    <Td>
                      {c.consent_status === "granted" && (
                        <Badge variant="secondary" className="bg-success/15 text-success">
                          <span className="size-1.5 rounded-full bg-current mr-1" />granted
                        </Badge>
                      )}
                      {c.consent_status === "revoked" && (
                        <Badge variant="secondary" className="bg-danger/15 text-danger">
                          <span className="size-1.5 rounded-full bg-current mr-1" />revoked
                        </Badge>
                      )}
                      {c.consent_status === "none" && (
                        <Badge variant="secondary" className="bg-muted text-foreground">
                          <span className="size-1.5 rounded-full bg-current mr-1" />none
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                            disabled={deletingId === c.id}
                            aria-label={`Delete ${c.name || c.e164}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete contact {c.name ? `"${c.name}" (${c.e164})` : c.e164}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteContact(c.id)}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              {deletingId === c.id ? "Deleting…" : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="bg-surface border border-border rounded-md shadow-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name || <span className="text-text-muted">No name</span>}</div>
                    <div className="font-mono text-sm text-text-muted mt-0.5">{c.e164}</div>
                    {c.email && <div className="text-xs text-text-muted mt-0.5 truncate">{c.email}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.consent_status === "granted" && (
                      <Badge variant="secondary" className="bg-success/15 text-success">
                        <span className="size-1.5 rounded-full bg-current mr-1" />granted
                      </Badge>
                    )}
                    {c.consent_status === "revoked" && (
                      <Badge variant="secondary" className="bg-danger/15 text-danger">
                        <span className="size-1.5 rounded-full bg-current mr-1" />revoked
                      </Badge>
                    )}
                    {c.consent_status === "none" && (
                      <Badge variant="secondary" className="bg-muted text-foreground">
                        <span className="size-1.5 rounded-full bg-current mr-1" />none
                      </Badge>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                          disabled={deletingId === c.id}
                          aria-label={`Delete ${c.name || c.e164}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete contact {c.name ? `"${c.name}" (${c.e164})` : c.e164}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteContact(c.id)}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          >
                            {deletingId === c.id ? "Deleting…" : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-text-muted text-right">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <TableHead scope="col" className="text-xs uppercase tracking-widest font-medium">
      {children}
    </TableHead>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <TableCell className={className}>{children}</TableCell>;
}

function CreateForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createContact({ phone, name, email, source: "manual" });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <CardContent className="px-6 py-5">
        <form onSubmit={submit}>
          <FieldGroup className="grid sm:grid-cols-3 gap-3">
            <Field>
              <Input
                required
                placeholder="+1 415 555 0123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-label="Phone number"
              />
            </Field>
            <Field>
              <Input
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Name"
              />
            </Field>
            <Field>
              <Input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
              />
            </Field>
            {err && (
              <Field data-invalid className="sm:col-span-3">
                <FieldError>{err}</FieldError>
              </Field>
            )}
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function ImportForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [consentAttested, setConsentAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: Array<{ phone: string; reason: string }> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target?.result as string || "");
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain")) {
      handleFile(file);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentAttested) return;
    setBusy(true);
    setErr(null);
    setResult(null);

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const header = lines[0]?.toLowerCase();
    const isHeader = header?.includes("phone") || header?.includes("name") || header?.includes("email");
    const dataLines = isHeader ? lines.slice(1) : lines;

    const contacts = dataLines.map((line) => {
      const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      return { phone: parts[0] || "", name: parts[1] || undefined, email: parts[2] || undefined };
    }).filter((c) => c.phone);

    if (contacts.length === 0) {
      setErr("No valid rows found. Format: phone,name,email — one per line.");
      setBusy(false);
      return;
    }

    try {
      const res = await api.post<{ inserted: number; skipped: Array<{ phone: string; reason: string }> }>(
        "/v1/contacts/bulk",
        { contacts, source: "csv", default_country: "US" }
      );
      setResult(res);
      onDone();
    } catch (e: any) {
      setErr(e.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <CardContent className="px-6 py-5">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Import contacts from CSV</p>
            <p className="text-xs text-text-muted">
              Columns: <code className="font-mono">phone, name (optional), email (optional)</code>. First row can be a header.
            </p>
          </div>

          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-md p-4 text-center text-sm text-muted-foreground cursor-pointer hover:border-muted-foreground hover:bg-muted transition-colors"
          >
            <Upload className="size-5 mx-auto mb-1.5 opacity-50" />
            {text ? (
              <span className="text-success text-xs">File loaded — {text.split(/\r?\n/).filter(Boolean).length} lines</span>
            ) : (
              <span>Drag a .csv file here or click to browse</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            aria-label="CSV contents"
            placeholder="+14155550123,Jordan Lee,jordan@example.com&#10;+14155550456,Alex Kim"
          />

          <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-muted cursor-pointer">
            <Checkbox
              checked={consentAttested}
              onCheckedChange={(v) => setConsentAttested(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I confirm I have written or verbal consent to contact these individuals by phone. Contacts without consent will be
              imported with <code className="font-mono">consent_status = none</code> and will be excluded from outbound campaigns.
            </span>
          </label>

          {err && <div className="text-sm text-destructive">{err}</div>}
          {result && (
            <div className="text-sm text-muted-foreground">
              Imported {result.inserted} contact{result.inserted !== 1 ? "s" : ""}.
              {result.skipped.length > 0 && ` Skipped ${result.skipped.length} invalid.`}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Close</Button>
            <Button
              onClick={(e) => submit(e as any)}
              disabled={busy || !text.trim() || !consentAttested}
            >
              {busy ? "Importing…" : "Import contacts"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DncUploadForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const phones = text
      .split(/[\r\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (phones.length === 0) {
      setResult("No valid phone numbers found.");
      setBusy(false);
      return;
    }

    try {
      const res = await api.post<{
        total_blocked: number;
        updated: number;
        created: number;
        invalid: number;
      }>("/v1/contacts/dnc-upload", { phones });
      setResult(
        `Blocked ${res.total_blocked} number${res.total_blocked !== 1 ? "s" : ""}. ` +
        `(${res.updated} updated, ${res.created} created, ${res.invalid} invalid)`
      );
      onDone();
    } catch (err: any) {
      setResult(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <CardContent className="px-6 py-5">
        <p className="text-sm text-muted-foreground mb-3">
          Paste phone numbers to add to the Do Not Call list. One per line.
          These numbers will be blocked from all outbound campaigns.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="font-mono text-xs"
            aria-label="Phone numbers to block"
            placeholder={"+14155550123\n+14155550456\n+14155550789"}
          />
          {result && <div className="text-sm text-muted-foreground">{result}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={busy || !text.trim()}>{busy ? "Blocking…" : "Block numbers"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
