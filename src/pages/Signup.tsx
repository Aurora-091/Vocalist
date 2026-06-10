import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { org_name: orgName },
        },
      });
      if (error) {
        setErr(error.message);
        return;
      }
      if (data.session) {
        navigate("/onboarding");
      } else {
        navigate("/login");
      }
    } catch (error: any) {
      setErr(error.message || "Couldn't create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-md shadow-card p-6">
        <div className="font-semibold tracking-tight text-lg mb-1">Create your account</div>
        <p className="text-sm text-text-muted mb-6">Start placing real calls in under 10 minutes.</p>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Organization">
            <input
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              placeholder="Your company name"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              placeholder="you@company.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              placeholder="8+ characters"
            />
          </Field>
          {err && <div className="text-sm text-danger">{err}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-text-muted text-center">
          No credit card required. TCPA-aware out of the box.
        </p>
        <div className="mt-6 text-sm text-text-muted">
          Have an account?{" "}
          <Link to="/login" className="text-primary hover:text-primary-700">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
