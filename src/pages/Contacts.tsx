import { useEffect, useState, useRef } from "react";
import { Plus, Upload, Search, Trash2, ShieldOff } from "lucide-react";
import { listContacts, createContact } from "../lib/db";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody } from "../components/legacy-ui/Card";
import { ConsentBadge } from "../components/legacy-ui/Badge";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";

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
    try {
      await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      setContacts((prev) => prev?.filter((c) => c.id !== id) ?? null);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
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
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <Upload className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add contact</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute top-3 left-3 text-text-muted pointer-events-none" />
        <input
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-surface"
        />
      </div>

      {creating && <CreateForm onClose={() => setCreating(false)} onSaved={() => load(q)} />}
      {importing && <ImportForm onClose={() => setImporting(false)} onDone={() => load(q)} />}
      {dncUploading && <DncUploadForm onClose={() => setDncUploading(false)} onDone={() => load(q)} />}

      {contacts === null ? (
        <Skeleton className="h-64" />
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add a single contact or import a CSV. We'll match consent on the way in."
          cta={
            <Button onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add contact
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-md shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-muted">
                <tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th>Consent</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2 group">
                    <Td>{c.name || <span className="text-text-muted">—</span>}</Td>
                    <Td className="font-mono">{c.e164}</Td>
                    <Td>{c.email || <span className="text-text-muted">—</span>}</Td>
                    <Td className="text-text-muted">{c.source || "—"}</Td>
                    <Td><ConsentBadge status={c.consent_status} /></Td>
                    <Td>
                      {confirmDeleteId === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-muted">Sure?</span>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 py-0.5 rounded border border-border text-text-muted hover:text-text transition-colors"
                          >
                            No
                          </button>
                          <button
                            onClick={() => deleteContact(c.id)}
                            disabled={deletingId === c.id}
                            className="text-xs px-2 py-0.5 rounded border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
                          >
                            {deletingId === c.id ? "…" : "Yes"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                          aria-label="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <ConsentBadge status={c.consent_status} />
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2 py-0.5 rounded border border-border text-text-muted"
                        >
                          No
                        </button>
                        <button
                          onClick={() => deleteContact(c.id)}
                          disabled={deletingId === c.id}
                          className="text-xs px-2 py-0.5 rounded border border-danger/40 bg-danger/10 text-danger disabled:opacity-50"
                        >
                          {deletingId === c.id ? "…" : "Yes"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
    <th className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
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
    <Card>
      <CardBody>
        <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3">
          <input
            required
            placeholder="+1 415 555 0123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface"
          />
          <input
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface"
          />
          {err && <div className="sm:col-span-3 text-sm text-danger">{err}</div>}
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ImportForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let inserted = 0;
    let skipped = 0;
    for (const line of lines) {
      const [phone, name, email] = line.split(",").map((s) => (s || "").trim());
      try {
        await createContact({ phone, name, email, source: "csv" });
        inserted++;
      } catch {
        skipped++;
      }
    }
    setResult(`Inserted ${inserted}. Skipped ${skipped}.`);
    onDone();
    setBusy(false);
  }

  return (
    <Card>
      <CardBody>
        <p className="text-sm text-text-muted mb-3">
          Paste lines like <code className="font-mono">phone,name,email</code>. One per line.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full p-3 rounded-md border border-border bg-surface font-mono text-xs"
            placeholder="+14155550123,Jordan Lee,jordan@example.com"
          />
          {result && <div className="text-sm text-text-muted">{result}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={busy || !text.trim()}>{busy ? "Importing…" : "Import"}</Button>
          </div>
        </form>
      </CardBody>
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
      const res = await api.post("/v1/contacts/dnc-upload", { phones });
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
    <Card>
      <CardBody>
        <p className="text-sm text-text-muted mb-3">
          Paste phone numbers to add to the Do Not Call list. One per line.
          These numbers will be blocked from all outbound campaigns.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full p-3 rounded-md border border-border bg-surface font-mono text-xs"
            placeholder={"+14155550123\n+14155550456\n+14155550789"}
          />
          {result && <div className="text-sm text-text-muted">{result}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={busy || !text.trim()}>{busy ? "Blocking…" : "Block numbers"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
