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

  async function signUpWithGoogle() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setErr(error.message);
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-md shadow-card p-6">
        <div className="font-semibold tracking-tight text-lg mb-1">Create your account</div>
        <p className="text-sm text-text-muted mb-6">Start placing real calls in under 10 minutes.</p>

        <button
          type="button"
          onClick={signUpWithGoogle}
          className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-md border border-border bg-surface hover:bg-surface-2 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-surface text-text-muted">or sign up with email</span>
          </div>
        </div>

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
            {loading ? "Creating..." : "Create account"}
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
