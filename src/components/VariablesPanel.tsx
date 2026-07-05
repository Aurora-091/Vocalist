import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
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

export function VariablesPanel({ promptText }: VariablesPanelProps) {
  const usedKeys = useMemo(() => extractVariablesFromText(promptText), [promptText]);

  const categorized = useMemo(() => {
    const groups: Record<VariableCategory, { key: string; def: VariableDefinition | null }[]> = {
      trigger: [],
      settings: [],
      custom: [],
    };

    for (const key of usedKeys) {
      const def = categorizeVariable(key);
      const category = def?.category || "custom";
      groups[category].push({ key, def });
    }

    return groups;
  }, [usedKeys]);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    toast.success(`Copied {{${key}}}`);
  };

  if (usedKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">
          Use <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"{{variable_name}}"}</code> in your prompt to inject dynamic values at call time.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {KNOWN_VARIABLES.slice(0, 4).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => handleCopy(v.key)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-muted hover:bg-muted/80 text-muted-foreground transition-colors cursor-pointer"
            >
              {`{{${v.key}}}`}
              <Copy className="w-2.5 h-2.5 opacity-50" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Variables detected
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {usedKeys.length}
        </Badge>
      </div>

      {(Object.entries(categorized) as [VariableCategory, typeof categorized.trigger][]).map(
        ([category, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={category} className="space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </span>
              <div className="space-y-1">
                {items.map(({ key, def }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono shrink-0 ${CATEGORY_COLORS[def?.category || "custom"]}`}
                      >
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
                    >
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}
