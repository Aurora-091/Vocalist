import { Link } from "react-router-dom";
import { Phone, ShieldCheck, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-semibold tracking-tight">Aurora</div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-text-muted hover:text-text">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-white hover:bg-primary-700"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-[1280px] mx-auto px-6 py-24 grid md:grid-cols-12 gap-10 items-center">
        <div className="md:col-span-7">
          <div className="text-xs font-medium tracking-widest uppercase text-primary">
            Voice agents that close
          </div>
          <h1 className="mt-4 text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
            Real customer calls.
            <br />
            Compliant by default.
          </h1>
          <p className="mt-6 text-lg text-text-muted max-w-xl">
            Aurora answers, recovers carts, books appointments, and routes humans
            in — without breaking the consent rules. Built for Shopify merchants
            and clinics.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center h-12 px-6 rounded-md bg-primary text-white hover:bg-primary-700 font-medium"
            >
              Start free
            </Link>
            <Link to="/login" className="text-sm text-text-muted hover:text-text">
              I already have an account
            </Link>
          </div>
          <div className="mt-4 text-xs text-text-muted">
            No credit card. TCPA-aware out of the box.
          </div>
        </div>

        <div className="md:col-span-5 grid gap-4">
          <Feature
            icon={<Phone className="w-4 h-4" />}
            title="Inbound + outbound, one console"
            body="One agent handles answers, recovers carts, books appointments. Live monitor and full transcripts."
          />
          <Feature
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Consent + DNC, enforced"
            body="Every dial passes the can_dial gate. Opt-out propagates instantly. Audit ledger never lies."
          />
          <Feature
            icon={<Sparkles className="w-4 h-4" />}
            title="No prompts. No code."
            body="Pick a template, fill four fields, place a real test call. Power lives behind Advanced."
          />
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-md p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="font-medium">{title}</div>
      </div>
      <p className="mt-3 text-sm text-text-muted">{body}</p>
    </div>
  );
}
