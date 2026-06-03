import { useEffect, useState } from "react";
import { Plus, Upload, Search } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { ConsentBadge } from "../components/ui/Badge";
import { EmptyState, Skeleton } from "../components/ui/States";

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

  async function load() {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (q) params.set("q", q);
      const r = await api<{ contacts: Contact[] }>(`/v1/contacts?${params}`);
      setContacts(r.contacts || []);
    } catch {
      setContacts([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-text-muted mt-1">
            Numbers we can dial. Consent-aware by default.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add contact
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="relative max-w-md"
      >
        <Search className="w-4 h-4 absolute top-3 left-3 text-text-muted pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-surface"
        />
      </form>

      {creating && <CreateForm onClose={() => setCreating(false)} onSaved={load} />}
      {importing && <ImportForm onClose={() => setImporting(false)} onDone={load} />}

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
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted">
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
                <Th>Source</Th>
                <Th>Consent</Th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                  <Td>{c.name || <span className="text-text-muted">—</span>}</Td>
                  <Td className="font-mono">{c.e164}</Td>
                  <Td>{c.email || <span className="text-text-muted">—</span>}</Td>
                  <Td className="text-text-muted">{c.source || "—"}</Td>
                  <Td>
                    <ConsentBadge status={c.consent_status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function CreateForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
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
      await api("/v1/contacts", {
        method: "POST",
        body: JSON.stringify({ phone, name, email, source: "manual" }),
      });
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
          {err && (
            <div className="sm:col-span-3 text-sm text-danger">{err}</div>
          )}
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ImportForm({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const contacts = lines.map((line) => {
      const [phone, name, email] = line.split(",").map((s) => (s || "").trim());
      return { phone, name, email };
    });
    try {
      const r = await api<any>("/v1/contacts/bulk", {
        method: "POST",
        body: JSON.stringify({ contacts, source: "csv" }),
      });
      setResult(`Inserted ${r.inserted}. Skipped ${r.skipped?.length || 0}.`);
      onDone();
    } catch (e: any) {
      setResult(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <p className="text-sm text-text-muted mb-3">
          Paste lines like <code className="font-mono">phone,name,email</code>.
          One per line.
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
            <Button variant="ghost" type="button" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
