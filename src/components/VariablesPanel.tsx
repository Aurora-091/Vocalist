import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Copy, TriangleAlert as AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  extractVariablesFromText,
  categorizeVariable,
  KNOWN_VARIABLES,
  type VariableCategory,
  type VariableDefinition,
} from "@/config/agent-variables";

type VariablesPanelProps = {
  promptText: string;
  onInsert?: (snippet: string) => void;
};

const CATEGORY_LABELS: Record<VariableCategory, string> = {
  trigger: "Call-time",
  settings: "Settings",
  custom: "Custom",
};

const CATEGORY_COLORS: Record<VariableCategory, string> = {
  trigger: "bg-amber-500/10 text-amber-700 border-amber-200",
  settings: "bg-blue-500/10 text-blue-700 border-blue-200",
  custom: "bg-zinc-500/10 text-zinc-600 border-zinc-200",
};

const UNKNOWN_COLORS = "bg-red-500/10 text-red-700 border-red-200";

export function VariablesPanel({ promptText, onInsert }: VariablesPanelProps) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  const usedKeys = useMemo(() => extractVariablesFromText(promptText), [promptText]);

  const categorized = useMemo(() => {
    const groups: Record<VariableCategory | "unknown", { key: string; def: VariableDefinition | null }[]> = {
      trigger: [],
      settings: [],
      custom: [],
      unknown: [],
    };

    for (const key of usedKeys) {
      const def = categorizeVariable(key);
      if (!def) {
        groups.unknown.push({ key, def: null });
      } else {
        groups[def.category].push({ key, def });
      }
    }

    return groups;
  }, [usedKeys]);

  function handleCopy(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`);
    toast.success(`Copied {{${key}}}`);
  }

  function handleInsert(key: string) {
    if (onInsert) {
      onInsert(`{{${key}}}`);
    } else {
      handleCopy(key);
    }
  }

  if (usedKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">
          Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"{{variable_name}}"}</code> in your prompt to inject dynamic values at call time.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {KNOWN_VARIABLES.slice(0, 5).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => handleInsert(v.key)}
              title={`${v.description} — e.g. ${v.example}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-muted hover:bg-muted/80 text-muted-foreground transition-colors cursor-pointer"
            >
              {`{{${v.key}}}`}
              {onInsert ? <Plus className="w-2.5 h-2.5 opacity-50" /> : <Copy className="w-2.5 h-2.5 opacity-50" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const sections: Array<{ id: VariableCategory | "unknown"; label: string; badgeClass: string }> = [
    { id: "unknown", label: "Unknown", badgeClass: UNKNOWN_COLORS },
    { id: "trigger", label: CATEGORY_LABELS.trigger, badgeClass: CATEGORY_COLORS.trigger },
    { id: "settings", label: CATEGORY_LABELS.settings, badgeClass: CATEGORY_COLORS.settings },
    { id: "custom", label: CATEGORY_LABELS.custom, badgeClass: CATEGORY_COLORS.custom },
  ];

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Variables detected
        </span>
        <div className="flex items-center gap-1.5">
          {categorized.unknown.length > 0 && (
            <Badge variant="outline" className={`text-[10px] ${UNKNOWN_COLORS}`}>
              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
              {categorized.unknown.length} unknown
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {usedKeys.length}
          </Badge>
        </div>
      </div>

      {sections.map(({ id, label, badgeClass }) => {
        const items = categorized[id];
        if (items.length === 0) return null;
        return (
          <div key={id} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              {id === "unknown" && (
                <span className="text-[10px] text-danger">
                  — not recognized, check spelling
                </span>
              )}
            </div>
            <div className="space-y-1">
              {items.map(({ key, def }) => (
                <div
                  key={key}
                  className="relative flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/50 group"
                  onMouseEnter={() => def && setTooltip(key)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono shrink-0 ${id === "unknown" ? UNKNOWN_COLORS : badgeClass}`}
                    >
                      {id === "unknown" && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
                      {`{{${key}}}`}
                    </Badge>
                    {def && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {def.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(key)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    title="Copy"
                  >
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>

                  {/* Tooltip */}
                  {tooltip === key && def && (
                    <div className="absolute left-0 bottom-full mb-1.5 z-50 w-56 rounded-md border border-border bg-popover shadow-lg px-3 py-2 pointer-events-none">
                      <p className="text-xs font-medium text-foreground mb-0.5">{def.label}</p>
                      <p className="text-[11px] text-muted-foreground">{def.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        e.g. <span className="font-mono text-foreground">{def.example}</span>
                      </p>
                      <div className="mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
                          {id === "trigger" ? "Auto-filled at call time" : "From agent settings"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
