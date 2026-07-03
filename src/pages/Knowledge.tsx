import { useEffect, useState, useRef } from "react";
import { Plus, Globe, FileText, Trash2, RefreshCw, Link as LinkIcon, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";

type KnowledgeSource = {
  id: string;
  kind: "document" | "website" | "integration";
  title: string;
  uri: string | null;
  status: "processing" | "ready" | "error" | "syncing" | "pending";
  created_at: string;
  updated_at: string;
};

const STATUS_ICON = {
  ready: <CheckCircle className="w-3.5 h-3.5 text-success" />,
  processing: <Loader2 className="w-3.5 h-3.5 text-info animate-spin" />,
  syncing: <Loader2 className="w-3.5 h-3.5 text-info animate-spin" />,
  pending: <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-danger" />,
};

const STATUS_LABEL = {
  ready: "Ready",
  processing: "Processing",
  syncing: "Syncing",
  pending: "Pending",
  error: "Error",
};

export default function Knowledge() {
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [tab, setTab] = useState<"website" | "document">("website");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.get<{ sources: KnowledgeSource[] }>("/v1/knowledge/sources");
      setSources(res.sources || []);
    } catch {
      setSources([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("knowledge_sources_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "knowledge_sources" },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function deleteSource(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/v1/knowledge/sources/${id}`);
      setSources((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function resync(id: string) {
    try {
      await api.post(`/v1/knowledge/sources/${id}/resync`);
      setSources((prev) =>
        prev?.map((s) => (s.id === id ? { ...s, status: "syncing" } : s)) ?? null
      );
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-text-muted mt-1">
            Docs and websites your agents can reference during calls.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add source
        </Button>
      </div>

      {adding && (
        <AddSourceForm
          defaultTab={tab}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      )}

      {sources === null ? (
        <Skeleton className="h-64" />
      ) : sources.length === 0 ? (
        <EmptyState
          title="No knowledge sources"
          description="Add a website URL or upload a document. Agents will reference it during live calls."
          cta={
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add source
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <Card key={s.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {s.kind === "website" ? (
                      <Globe className="w-5 h-5 text-text-muted" />
                    ) : (
                      <FileText className="w-5 h-5 text-text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{s.title}</span>
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        {STATUS_ICON[s.status]}
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    {s.status === "error" && s.meta?.error && (
                      <div className="mt-1 text-xs text-danger">
                        Failed: {s.meta.error}
                      </div>
                    )}
                    {s.uri && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <LinkIcon className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="text-xs text-text-muted font-mono truncate">{s.uri}</span>
                      </div>
                    )}
                    <div className="text-xs text-text-muted mt-1">
                      Added {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => resync(s.id)}
                      className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                      title="Re-sync to AI"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === s.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2 py-0.5 rounded border border-border text-text-muted hover:text-text"
                        >
                          No
                        </button>
                        <button
                          onClick={() => deleteSource(s.id)}
                          disabled={deletingId === s.id}
                          className="text-xs px-2 py-0.5 rounded border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
                        >
                          {deletingId === s.id ? "…" : "Yes"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          <div className="text-xs text-text-muted text-right">
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function AddSourceForm({
  defaultTab,
  onClose,
  onSaved,
}: {
  defaultTab: "website" | "document";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"website" | "document">(defaultTab);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post("/v1/knowledge/sources", {
        kind: tab,
        title: title || (tab === "website" ? url : "Uploaded document"),
        uri: tab === "website" ? url : undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message || "Failed to add source");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-1 p-1 bg-surface-2 rounded-md border border-border w-fit">
          <button
            type="button"
            onClick={() => setTab("website")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
              tab === "website" ? "bg-surface text-text font-medium border border-border" : "text-text-muted hover:text-text"
            }`}
          >
            <Globe className="w-3 h-3" />
            Website URL
          </button>
          <button
            type="button"
            onClick={() => setTab("document")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
              tab === "document" ? "bg-surface text-text font-medium border border-border" : "text-text-muted hover:text-text"
            }`}
          >
            <FileText className="w-3 h-3" />
            Document
          </button>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            placeholder="Source name (e.g. FAQs, Return Policy)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm"
          />
          {tab === "website" ? (
            <input
              required
              type="url"
              placeholder="https://example.com/faq"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface font-mono text-sm"
            />
          ) : (
            <div className="border-2 border-dashed border-border rounded-md p-6 text-center text-sm text-text-muted">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Document upload coming soon.</p>
              <p className="text-xs mt-1">Use the website URL option to index hosted documents.</p>
            </div>
          )}
          {err && <div className="text-sm text-danger">{err}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={busy || (tab === "website" && !url) || !title}
            >
              {busy ? "Adding…" : "Add source"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
