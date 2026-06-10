import { Link } from "react-router-dom";
import { Phone, ShieldCheck, Sparkles, Bot, Megaphone, TrendingUp, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-semibold tracking-tight text-lg">Aurora</div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-text-muted hover:text-text transition-colors">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center h-9 px-4 rounded-md bg-text text-bg font-medium hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-[1280px] mx-auto px-6 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-7">
            <div className="text-xs font-medium tracking-widest uppercase text-text-muted">
              Voice AI for SMBs
            </div>
            <h1 className="mt-4 text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight">
              Real customer calls.
              <br />
              <span className="text-text-muted">Compliant by default.</span>
            </h1>
            <p className="mt-6 text-lg text-text-muted max-w-xl leading-relaxed">
              Aurora answers inbound calls, recovers abandoned carts, books appointments,
              and routes to humans — without breaking TCPA consent rules. Built for
              Shopify merchants and clinics.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center h-12 px-6 rounded-md bg-text text-bg font-medium hover:opacity-90 transition-opacity"
              >
                Start free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link to="/login" className="text-sm text-text-muted hover:text-text transition-colors">
                I have an account
              </Link>
            </div>
            <div className="mt-4 text-xs text-text-muted">
              No credit card required. TCPA-aware out of the box.
            </div>
          </div>

          <div className="md:col-span-5 space-y-4">
            <Feature
              icon={<Phone className="w-4 h-4" />}
              title="Inbound + outbound, one console"
              body="One agent handles answers, recovers carts, books appointments. Live monitor and full transcripts included."
            />
            <Feature
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Consent + DNC, enforced"
              body="Every outbound dial passes the can_dial gate. Opt-outs propagate instantly. The audit ledger is append-only."
            />
            <Feature
              icon={<Sparkles className="w-4 h-4" />}
              title="No prompts. No code."
              body="Pick a template, fill four fields, place a test call. Advanced config exists but you never have to touch it."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-text-muted mb-3">
            How it works
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Live in under 10 minutes
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            <Step
              number="01"
              icon={<Bot className="w-5 h-5" />}
              title="Create your agent"
              body="Pick a vertical template. Set the objective and tone. Aurora handles persona construction, recording disclosure, and compliance gating."
            />
            <Step
              number="02"
              icon={<Megaphone className="w-5 h-5" />}
              title="Import contacts, launch"
              body="Upload a CSV or sync from Shopify. Aurora enforces consent on import. Start a campaign and the dialer handles concurrency, retries, and voicemail."
            />
            <Step
              number="03"
              icon={<TrendingUp className="w-5 h-5" />}
              title="Track outcomes"
              body="Every call has a transcript, cost breakdown, and outcome classification. Watch bookings, recoveries, and opt-out rates in real time."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Plans that scale with you
            </h2>
            <p className="mt-4 text-text-muted">
              Start at $49/mo with 300 minutes included. No per-seat pricing.
              Overage is transparent and metered per-second.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <PlanCard
              name="Starter"
              price="49"
              minutes="300"
              numbers="1"
              features={["1 agent", "Campaigns", "Consent enforcement"]}
            />
            <PlanCard
              name="Growth"
              price="149"
              minutes="1,200"
              numbers="3"
              features={["Unlimited agents", "Knowledge base", "Priority support"]}
              highlighted
            />
            <PlanCard
              name="Pro"
              price="399"
              minutes="4,000"
              numbers="10"
              features={["Whitelabel", "Webhooks", "Dedicated CSM"]}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="max-w-[1280px] mx-auto px-6 py-16 flex flex-col items-center text-center">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Place your first real call today
          </h2>
          <p className="mt-3 text-text-muted max-w-md">
            No credit card. No sales call. Sign up, create an agent, and hear it
            live in under 10 minutes.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center h-12 px-6 rounded-md bg-text text-bg font-medium hover:opacity-90 transition-opacity"
          >
            Start free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-[1280px] mx-auto px-6 py-8 flex items-center justify-between text-xs text-text-muted">
          <div>Aurora Voice AI</div>
          <div className="flex gap-6">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Status</span>
          </div>
        </div>
      </footer>
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
    <div className="bg-surface border border-border rounded-md p-5 transition-colors hover:border-text/20">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-surface-2 text-text">
          {icon}
        </span>
        <div className="font-medium text-sm">{title}</div>
      </div>
      <p className="mt-3 text-sm text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-xs text-text-muted">{number}</span>
        <span className="w-9 h-9 inline-flex items-center justify-center rounded-md bg-surface-2 text-text">
          {icon}
        </span>
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  minutes,
  numbers,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  minutes: string;
  numbers: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-6 border ${
        highlighted
          ? "border-text bg-surface shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
          : "border-border bg-surface"
      }`}
    >
      <div className="font-medium">{name}</div>
      <div className="mt-3 font-mono text-3xl font-bold">
        ${price}
        <span className="text-text-muted text-sm font-sans font-normal"> / mo</span>
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-text-muted">
        <div><span className="font-mono text-text">{minutes}</span> min included</div>
        <div><span className="font-mono text-text">{numbers}</span> phone number{numbers !== "1" ? "s" : ""}</div>
      </div>
      <ul className="mt-5 space-y-2 text-sm border-t border-border pt-4">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-text-muted" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to="/signup"
        className={`mt-6 w-full inline-flex items-center justify-center h-10 rounded-md font-medium text-sm transition-opacity ${
          highlighted
            ? "bg-text text-bg hover:opacity-90"
            : "bg-surface-2 text-text hover:bg-surface-2/80"
        }`}
      >
        Start free
      </Link>
    </div>
  );
}
