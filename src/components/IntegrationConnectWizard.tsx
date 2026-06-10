import { useState } from "react";
import { Check, ArrowRight, ExternalLink, Loader, Eye, EyeOff, CircleAlert } from "lucide-react";
import { Button } from "./legacy-ui/Button";

export type WizardStep = {
  key: string;
  label: string;
};

export type SetupInstruction = {
  step: number;
  text: string;
};

interface Props {
  providerName: string;
  providerIcon: React.ReactNode;
  authType: "api_key" | "oauth2" | "webhook";
  steps: WizardStep[];
  setupInstructions: SetupInstruction[];
  fields: FieldConfig[];
  adminUrl?: string;
  onSubmit: (values: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
  onOAuth?: () => void;
  onComplete?: () => void;
  onBack?: () => void;
}

export type FieldConfig = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  helpText?: string;
  required?: boolean;
  prefix?: string;
  suffix?: string;
};

export function IntegrationConnectWizard({
  providerName,
  providerIcon,
  authType,
  steps,
  setupInstructions,
  fields,
  adminUrl,
  onSubmit,
  onOAuth,
  onComplete,
  onBack,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function toggleSecret(key: string) {
    setShowSecret((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await onSubmit(values);
      if (result.success) {
        setDone(true);
        setCurrentStep(steps.length - 1);
      } else {
        setError(result.error || "Connection failed. Please check your credentials.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthClick() {
    if (onOAuth) onOAuth();
  }

  const isInstructions = currentStep === 0 && setupInstructions.length > 0;
  const isFields = authType === "api_key" && (currentStep === 1 || (currentStep === 0 && setupInstructions.length === 0));
  const isOAuthPrompt = authType === "oauth2" && currentStep === 0;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full text-xs font-medium inline-flex items-center justify-center ${
                done && i === steps.length - 1
                  ? "bg-success/15 text-success"
                  : i === currentStep
                  ? "bg-primary text-white"
                  : i < currentStep || done
                  ? "bg-success/15 text-success"
                  : "bg-surface-2 text-text-muted"
              }`}
            >
              {i < currentStep || done ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </span>
            {i < steps.length - 1 && <span className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
        {/* Done state */}
        {done && (
          <div className="p-6 text-center py-12">
            <span className="w-14 h-14 rounded-full bg-success/10 text-success inline-flex items-center justify-center mb-4">
              <Check className="w-7 h-7" />
            </span>
            <div className="font-medium text-lg">{providerName} connected</div>
            <p className="mt-2 text-sm text-text-muted">
              Your agents can now access {providerName} data during calls.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              {onComplete && (
                <Button onClick={onComplete}>Done</Button>
              )}
              {onBack && (
                <Button variant="secondary" onClick={onBack}>
                  Back to integrations
                </Button>
              )}
            </div>
          </div>
        )}

        {/* OAuth prompt */}
        {!done && isOAuthPrompt && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                {providerIcon}
              </span>
              <div>
                <div className="font-medium">Connect {providerName}</div>
                <div className="text-xs text-text-muted">Sign in with your {providerName} account to authorize access</div>
              </div>
            </div>

            {setupInstructions.length > 0 && (
              <div className="bg-surface-2 rounded-md p-4 space-y-2">
                <div className="text-xs font-medium text-text-muted mb-2">What happens next:</div>
                {setupInstructions.map((inst) => (
                  <div key={inst.step} className="flex gap-2 text-sm">
                    <span className="font-mono text-xs text-primary bg-primary/10 w-5 h-5 rounded flex items-center justify-center shrink-0">
                      {inst.step}
                    </span>
                    <span>{inst.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleOAuthClick}>
                Connect with {providerName}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              {onBack && (
                <Button variant="ghost" onClick={onBack}>Back</Button>
              )}
            </div>
          </div>
        )}

        {/* Instructions step (API key flow) */}
        {!done && isInstructions && authType === "api_key" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                {providerIcon}
              </span>
              <div>
                <div className="font-medium">Connect {providerName}</div>
                <div className="text-xs text-text-muted">Follow these steps to get your API credentials</div>
              </div>
            </div>

            <div className="bg-surface-2 rounded-md p-4 space-y-3">
              {setupInstructions.map((inst) => (
                <div key={inst.step} className="flex gap-2 text-sm">
                  <span className="font-mono text-xs text-primary bg-primary/10 w-5 h-5 rounded flex items-center justify-center shrink-0">
                    {inst.step}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: inst.text }} />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              {adminUrl && (
                <Button onClick={() => window.open(adminUrl, "_blank", "noopener")}>
                  Open {providerName}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
              <Button variant={adminUrl ? "secondary" : "primary"} onClick={() => setCurrentStep(1)}>
                I have my credentials
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Fields step (API key flow) */}
        {!done && isFields && (
          <div className="p-6">
            <div className="font-medium mb-1">Enter your {providerName} credentials</div>
            <p className="text-xs text-text-muted mb-4">
              Credentials are encrypted and stored securely. Never displayed again.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    {field.label}
                    {field.required !== false && <span className="text-danger ml-0.5">*</span>}
                  </label>
                  <div className="relative">
                    {field.prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                        {field.prefix}
                      </span>
                    )}
                    <input
                      required={field.required !== false}
                      type={field.type === "password" && !showSecret[field.key] ? "password" : "text"}
                      value={values[field.key] || ""}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`w-full h-10 px-3 rounded-md border border-border bg-surface text-sm font-mono ${
                        field.prefix ? "pl-16" : ""
                      } ${field.type === "password" ? "pr-10" : ""}`}
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        onClick={() => toggleSecret(field.key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      >
                        {showSecret[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {field.helpText && (
                    <p className="mt-1.5 text-xs text-text-muted">{field.helpText}</p>
                  )}
                </div>
              ))}

              {error && (
                <div className="flex items-start gap-2 text-sm text-danger">
                  <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setCurrentStep(0)}>
                  Back
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Loading state */}
        {loading && !isFields && (
          <div className="p-6 flex flex-col items-center py-12">
            <Loader className="w-8 h-8 text-primary animate-spin" />
            <div className="mt-4 font-medium">Connecting to {providerName}...</div>
            <p className="mt-1 text-sm text-text-muted">Validating your credentials</p>
          </div>
        )}
      </div>
    </div>
  );
}
