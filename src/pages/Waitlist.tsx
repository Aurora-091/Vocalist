import { useState, useEffect, useRef } from "react";
import { ArrowRight, CircleCheck as CheckCircle2, Circle as XCircle, Mail, Shield, Lock, SlidersHorizontal } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { joinWaitlist } from "../lib/api";
import { useWaitlistCount } from "../lib/useWaitlistCount";
import { trackFormSubmit, trackFormSuccess } from "../lib/analytics";
import {
  STATS,
  VERTICALS,
  HOW_IT_WORKS,
  PLATFORM_FEATURES,
  READY_FLOWS,
  UPCOMING_VERTICALS,
  SECURITY_FEATURES,
  FAQ,
} from "../config/marketing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

const FALLBACK_COUNT = 58;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  if (!phone) return true;
  return /^\+?[\d\s\-()]{7,20}$/.test(phone);
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const targets = el.querySelectorAll("[data-reveal]");
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
  return ref;
}

function AnimatedStat({ value, label, delay }: { value: string; label: string; delay: number }) {
  const [displayed, setDisplayed] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const numeric = parseFloat(value.replace(/[^0-9.]/g, ""));
    if (isNaN(numeric)) return;
    const prefix = value.match(/^[^0-9]*/)?.[0] || "";
    const suffix = value.match(/[^0-9.]*$/)?.[0] || "";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const start = performance.now();
          const duration = 900;
          const from = Math.max(0, numeric - 20);
          function tick(now: number) {
            const p = Math.min(1, (now - start - delay) / duration);
            if (p < 0) {
              requestAnimationFrame(tick);
              return;
            }
            const eased = 1 - Math.pow(1 - p, 3);
            const current = Math.round((from + (numeric - from) * eased) * 10) / 10;
            const display = Number.isInteger(numeric) ? Math.round(current) : current.toFixed(0);
            setDisplayed(`${prefix}${display}${suffix}`);
            if (p < 1) requestAnimationFrame(tick);
            else setDisplayed(value);
          }
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, delay]);

  return (
    <div ref={ref}>
      <span className="block font-display font-extrabold text-[clamp(36px,4.5vw,52px)] leading-none tracking-[-0.04em] text-[var(--m-text)]">
        {displayed}
      </span>
      <p className="mt-2 text-[13.5px] text-[var(--m-text-secondary)] leading-snug">{label}</p>
    </div>
  );
}

function Waveform({ seed = 0 }: { seed?: number }) {
  const bars = Array.from({ length: 18 }, (_, i) =>
    4 + Math.round(11 * Math.abs(Math.sin(i * 1.1 + seed)))
  );
  return (
    <div className="flex items-center gap-[2px] h-5 flex-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className="waveform-bar w-[2px] rounded-sm flex-none"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

function GrainOverlay() {
  return (
    <div className="grain-overlay" aria-hidden="true">
      <svg width="100%" height="100%">
        <filter id="grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-filter)" />
      </svg>
    </div>
  );
}

function HeroBgWaveform() {
  const barCount = 64;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const normalized = i / (barCount - 1);
    const height = 15 + 85 * Math.sin(normalized * Math.PI);
    return height;
  });

  return (
    <div className="hero-bg" aria-hidden="true" style={{ top: "auto", bottom: 0, height: "60%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "5px", padding: "0 3%" }}>
      {bars.map((h, i) => (
        <span
          key={i}
          className="hero-wave-bar"
          style={{
            height: `${h}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

function HeroBadge() {
  const { count } = useWaitlistCount();
  const displayCount = FALLBACK_COUNT + (count ?? 0);
  return (
    <div className="mb-6 inline-flex items-center gap-2 bg-[var(--m-bg-alt)] border border-[var(--m-border)] rounded-full px-3.5 py-1.5 text-[13px] text-[var(--m-text-secondary)]" data-reveal>
      <span className="w-[7px] h-[7px] rounded-full bg-[#22c55e] inline-block hero-pulse-dot" />
      {displayCount} businesses already on the waitlist
    </div>
  );
}


function HeroForm() {
  const { count } = useWaitlistCount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const emailValid = isValidEmail(email);
  const phoneValid = isValidPhone(phone);
  const nameValid = name.trim().length > 0;
  const canSubmit = nameValid && emailValid && phoneValid;
  const displayCount = FALLBACK_COUNT + (count ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState("loading");
    setErrorMsg("");
    trackFormSubmit();

    const payload: { name: string; email: string; phone?: string } = {
      name: name.trim(),
      email: email.trim(),
    };
    if (phone.trim()) payload.phone = phone.trim();

    const result = await joinWaitlist(payload);
    if (result.success) {
      setState("success");
      setShowSuccess(true);
      trackFormSuccess();
    } else {
      setState("error");
      setErrorMsg(result.error || "Something went wrong. Try again or email hello@weeber.ai");
    }
  }

  const inputClass = "w-full h-12 px-4 pr-10 text-[16px] bg-[var(--m-bg)] border-[1.5px] border-[var(--m-text-muted)] text-[var(--m-text)] placeholder:text-[var(--m-text-muted)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[var(--m-text)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(11,11,12,0.12)] transition-all rounded-lg";

  return (
    <div className="max-w-[430px] mx-auto">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="relative">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => { setName(e.target.value); setTouched((t) => ({ ...t, name: true })); }}
            placeholder="Your name"
            className={inputClass}
          />
          {touched.name && name.length >= 1 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {nameValid ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <XCircle className="w-4 h-4 text-red-500" />}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setTouched((t) => ({ ...t, email: true })); }}
              placeholder="you@yourbrand.com"
              className={inputClass}
            />
            {touched.email && email.length >= 3 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {emailValid ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <XCircle className="w-4 h-4 text-red-500" />}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={state === "loading" || !canSubmit}
            className="h-12 px-7 text-[1rem] font-semibold bg-[var(--m-accent-bg)] text-[var(--m-accent-fg)] border-none rounded-lg hover:opacity-[0.85] transition-opacity disabled:opacity-50 btn-press whitespace-nowrap cursor-pointer"
          >
            {state === "loading" ? "Joining..." : "Get early access"}
          </button>
        </div>

        <div className="relative">
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setTouched((t) => ({ ...t, phone: true })); }}
            placeholder="+91 98765 43210 (optional)"
            className={inputClass}
          />
          {touched.phone && phone.length >= 7 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {phoneValid ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <XCircle className="w-4 h-4 text-red-500" />}
            </span>
          )}
        </div>

        {state === "error" && (
          <p className="text-xs text-red-600">{errorMsg}</p>
        )}
      </form>

      <p className="mt-4 text-[13.5px] text-center text-[var(--m-text-secondary)]">
        First 100 customers lock in <span className="font-bold text-[var(--m-text)]">founder pricing.</span>
      </p>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[460px] p-6 bg-[var(--m-bg)] text-[var(--m-text)] border border-[var(--m-border)] shadow-[0_20px_50px_-34px_rgba(0,0,0,0.35)] [&_button[data-slot=dialog-close]]:text-[var(--m-text-secondary)] [&_button[data-slot=dialog-close]]:hover:text-[var(--m-text)]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl font-extrabold tracking-[-0.03em]">
              You're in — you're #{displayCount} in line.
            </DialogTitle>
            <DialogDescription className="text-[var(--m-text-secondary)] mt-2 text-[14.5px]">
              Want in sooner? Share Weeber and move up the list.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-[var(--m-bg-alt)] border border-[var(--m-border)] rounded-[9px]">
            <Mail className="w-4 h-4 text-[var(--m-text-secondary)] flex-shrink-0" />
            <span className="text-sm text-[var(--m-text)] truncate">{email}</span>
          </div>

          <div className="mt-4 flex gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent("I just joined the Weeber waitlist — AI voice agents that answer and make your customer calls. Get early access: https://weeber.ai")}`}
              target="_blank"
              rel="noopener"
              className="flex-1 text-center border border-[var(--m-border)] rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold hover:bg-[var(--m-bg-alt)] transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Just joined the @weeber_ai waitlist — AI voice agents that answer customer calls 24/7. https://weeber.ai")}`}
              target="_blank"
              rel="noopener"
              className="flex-1 text-center border border-[var(--m-border)] rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold hover:bg-[var(--m-bg-alt)] transition-colors"
            >
              Post on X
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("Weeber — early access")}&body=${encodeURIComponent("I just joined the Weeber waitlist — AI voice agents that answer and make your customer calls. Get early access: https://weeber.ai")}`}
              className="flex-1 text-center border border-[var(--m-border)] rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold hover:bg-[var(--m-bg-alt)] transition-colors"
            >
              Email
            </a>
          </div>

          <div className="mt-4 border-t border-[var(--m-border)] pt-4">
            <label className="text-[12.5px] text-[var(--m-text-secondary)] block mb-2">What do you run? (so we prioritize the right fit)</label>
            <select className="w-full bg-[var(--m-bg)] border border-[var(--m-border)] rounded-[9px] text-[var(--m-text)] text-[14.5px] px-3 py-2.5 focus:outline-none focus:border-[var(--m-text-muted)]">
              <option value="">Select your business...</option>
              <option>Clinic / healthcare</option>
              <option>Home & repair services</option>
              <option>Salon / beauty</option>
              <option>D2C / e-commerce</option>
              <option>Enterprise</option>
              <option>Other</option>
            </select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Waitlist() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const revealRef = useReveal();

  return (
    <div className="marketing min-h-full" ref={revealRef}>
      <GrainOverlay />
      <MarketingNav />

      <div className="marketing-content">
        {/* Hero */}
        <section id="waitlist" className="relative pt-28 pb-20 md:pb-24 px-6 text-center overflow-hidden" style={{ minHeight: "100svh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <HeroBgWaveform />
          <div className="hero-fade" aria-hidden="true" />
          <div className="relative z-10 max-w-[900px] mx-auto">
            <HeroBadge />
            <h1 className="font-display text-[clamp(2.8rem,6vw,5.5rem)] font-extrabold leading-[0.93] tracking-[-0.03em] text-[var(--m-text)]" data-reveal>
              Every call you miss<br />is a sale you just lost.
            </h1>
            <p className="mt-6 text-[1.2rem] md:text-[1.3rem] font-medium text-[var(--m-text)] max-w-[520px] mx-auto leading-[1.55] text-pretty" data-reveal>
              Voice AI that books, recovers carts, and follows up. 24/7. No code.
            </p>
            <div className="mt-10" data-reveal>
              <HeroForm />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-t border-b border-[var(--m-border)] bg-[var(--m-bg)]">
          <div className="max-w-[1100px] mx-auto px-6 py-14 md:py-16" data-reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-8">
              {STATS.map((s, i) => (
                <div
                  key={s.value}
                  className={`px-6 ${i > 0 ? "sm:border-l border-[var(--m-border)]" : ""} ${i === 2 ? "sm:border-l-0 md:border-l" : ""}`}
                >
                  <AnimatedStat value={s.value} label={s.label} delay={i * 120} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Verticals */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg-alt)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div className="mb-14" data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                Built for how you sell
              </span>
              <h2 className="mt-4 font-display text-[clamp(28px,3.8vw,46px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--m-text)] max-w-xl">
                Whatever you run, the lost sale is the same — a call that didn't happen.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-px bg-[var(--m-border)] border border-[var(--m-border)] rounded-[18px] overflow-hidden" data-reveal>
              {VERTICALS.map((v, vi) => (
                <div key={v.label} className="bg-[var(--m-bg)] p-7 flex flex-col card-lift">
                  <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">{v.label}</span>
                  <h3 className="mt-3 mb-3 font-display text-[21px] font-bold tracking-[-0.02em] leading-snug text-[var(--m-text)]">{v.headline}</h3>
                  <p className="text-[14.5px] text-[var(--m-text-secondary)] leading-relaxed">{v.problem}</p>
                  <p className="mt-3 text-[14.5px] text-[var(--m-text)] leading-relaxed">{v.solution}</p>
                  <div className="mt-5 flex items-center gap-3 border border-[var(--m-border)] rounded-[11px] p-3 bg-[var(--m-surface)]/60">
                    <button
                      aria-label={`Play ${v.demoLabel} sample`}
                      className="flex-none w-[33px] h-[33px] rounded-full bg-[var(--m-accent-bg)] flex items-center justify-center hover:scale-[1.06] transition-transform"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 12" fill="var(--m-accent-fg)"><path d="M0 0l10 6-10 6z" /></svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--m-text)]">{v.demoLabel}</div>
                      <div className="font-mono text-[11px] text-[var(--m-text-muted)] mt-0.5">{v.demoAccent}</div>
                    </div>
                    <Waveform seed={vi * 2.5} />
                    <span className="font-mono text-[11px] text-[var(--m-text-muted)] flex-none">{v.demoDuration}</span>
                  </div>
                  <div className="mt-auto pt-5">
                    <a href={v.cta.href} className="link-grow text-[14.5px] font-semibold inline-flex items-center gap-1.5 hover:gap-2.5 transition-all">
                      {v.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg-alt)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                How it works
              </span>
              <h2 className="mt-4 mb-12 font-display text-[clamp(28px,3.8vw,46px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--m-text)] max-w-xl">
                Built compliance-first, not bolted on.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-px bg-[var(--m-border)] border border-[var(--m-border)] overflow-hidden" data-reveal>
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.step} className={`p-8 bg-[var(--m-bg)] ${i < HOW_IT_WORKS.length - 1 ? "border-b md:border-b-0 md:border-r border-[var(--m-border)]" : ""}`}>
                  <div className="font-mono text-xs text-[var(--m-text-muted)] mb-5">{step.step}</div>
                  <h3 className="font-display font-bold text-[var(--m-text)] mb-3 text-[17px]">{step.title}</h3>
                  <p className="text-sm text-[var(--m-text-secondary)] leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform + integrations */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div data-reveal>
              <div className="mb-3 inline-flex items-center gap-2 border border-[var(--m-text)] rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold">
                <span className="w-[7px] h-[7px] rounded-full bg-[var(--m-text)] animate-pulse" />
                Beta testing soon — waitlist customers go first
              </div>
              <div className="mt-3">
                <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">Built and ready</span>
              </div>
              <h2 className="mt-3 font-display text-[clamp(28px,3.8vw,46px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--m-text)] max-w-2xl">
                A no-code voice platform that fits the tools you already run.
              </h2>
              <p className="mt-4 text-[17.5px] text-[var(--m-text-secondary)] max-w-xl">
                Everything here is built today. Build and launch call flows yourself — no engineers, no scripts to record.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-5 mb-14" data-reveal>
              {PLATFORM_FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="flex-none mt-0.5 w-[18px] h-[18px] text-[var(--m-text)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
                  </span>
                  <div>
                    <strong className="text-[15.5px] font-semibold text-[var(--m-text)]">{f.title}</strong>
                    <span className="block text-[14px] text-[var(--m-text-secondary)] mt-0.5">{f.body}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mb-10" data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)] justify-center">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                Connected
              </span>
              <h2 className="mt-3 font-display text-[clamp(24px,3vw,38px)] font-extrabold tracking-[-0.03em] leading-[1.1] text-[var(--m-text)] max-w-xl mx-auto">
                Imagine the conversions when everything's connected to Weeber.
              </h2>
              <p className="mt-3 text-[17px] text-[var(--m-text-secondary)] max-w-lg mx-auto">
                Plug in the tools you already run and every order, lead, and missed call becomes a call worth making — automatically.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4" data-reveal>
              <div className="border border-[var(--m-border)] rounded-[16px] p-6 bg-[var(--m-bg)] card-lift">
                <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                  <span className="w-7 h-7 rounded-[8px] border border-[var(--m-border)] flex items-center justify-center text-[var(--m-text)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h16v11H4zM4 8l2-4h12l2 4" /></svg>
                  </span>
                  Store & site
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Shopify", dark: true, letter: "S" },
                    { label: "WordPress", dark: false, letter: "W" },
                    { label: "WooCommerce", dark: true, letter: "Woo" },
                    { label: "Custom site", dark: false, letter: "</>" },
                  ].map((t) => (
                    <div key={t.label} className="flex flex-col items-center gap-2 text-center">
                      <span className={`w-12 h-12 rounded-[13px] border flex items-center justify-center font-display text-[15px] font-extrabold ${t.dark ? "bg-[var(--m-accent-bg)] text-[var(--m-accent-fg)] border-[var(--m-accent-bg)]" : "bg-[var(--m-surface)] text-[var(--m-text)] border-[var(--m-border)]"}`}>
                        {t.letter}
                      </span>
                      <span className="text-[11px] text-[var(--m-text-secondary)]">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[var(--m-border)] rounded-[16px] p-6 bg-[var(--m-bg)] card-lift">
                <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                  <span className="w-7 h-7 rounded-[8px] border border-[var(--m-border)] flex items-center justify-center text-[var(--m-text)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V11M10 19V5M16 19v-7M2 19h20" /></svg>
                  </span>
                  Marketing & data
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Meta", dark: true, letter: "M" },
                    { label: "Google", dark: false, letter: "G" },
                    { label: "Analytics", dark: true, letter: "GA" },
                    { label: "WhatsApp", dark: false, letter: "WA" },
                  ].map((t) => (
                    <div key={t.label} className="flex flex-col items-center gap-2 text-center">
                      <span className={`w-12 h-12 rounded-[13px] border flex items-center justify-center font-display text-[13px] font-extrabold ${t.dark ? "bg-[var(--m-accent-bg)] text-[var(--m-accent-fg)] border-[var(--m-accent-bg)]" : "bg-[var(--m-surface)] text-[var(--m-text)] border-[var(--m-border)]"}`}>
                        {t.letter}
                      </span>
                      <span className="text-[11px] text-[var(--m-text-secondary)]">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[var(--m-border)] rounded-[16px] p-6 bg-[var(--m-bg)] md:col-span-2 card-lift">
                <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                  <span className="w-7 h-7 rounded-[8px] border border-[var(--m-border)] flex items-center justify-center text-[var(--m-text)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12l4 4 10-10" /></svg>
                  </span>
                  Ready-made call flows
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {READY_FLOWS.map((f) => (
                    <div key={f} className="flex items-center gap-2.5 bg-[var(--m-bg-alt)] border border-[var(--m-border)] rounded-[11px] px-4 py-3.5 text-[14.5px] font-semibold text-[var(--m-text)] hover:bg-[var(--m-surface)] hover:border-[var(--m-text)] transition-colors cursor-default">
                      <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] flex-none" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[var(--m-border)] rounded-[16px] p-6 bg-[var(--m-bg)] md:col-span-2">
                <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                  <span className="w-7 h-7 rounded-[8px] border border-[var(--m-border)] flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[var(--m-text)] animate-pulse" />
                  </span>
                  Live now · in private beta
                </div>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {["Clinics & local services", "D2C & e-commerce", "Enterprise"].map((t) => (
                      <span key={t} className="border border-[var(--m-text)] rounded-full px-4 py-1.5 text-[13px] font-semibold">{t}</span>
                    ))}
                  </div>
                  <span className="text-[13.5px] text-[var(--m-text-secondary)]">
                    <strong className="text-[var(--m-text)]">Coming next:</strong> hotels, hospitals, real estate & more ↓
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-5 text-[14.5px] text-[var(--m-text-secondary)]" data-reveal>
              <strong className="text-[var(--m-text)]">Connects to 50+ tools — and counting.</strong> Don't see the one you need?{" "}
              <a href="mailto:hello@weeber.ai" className="link-grow font-semibold text-[var(--m-text)]">Request a connector →</a>
            </p>
          </div>
        </section>

        {/* Upcoming */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg-alt)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                What's next
              </span>
              <h2 className="mt-4 mb-12 font-display text-[clamp(28px,3.8vw,46px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--m-text)] max-w-2xl">
                We started with stores and local shops. We're coming for every phone call.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4" data-reveal>
              {UPCOMING_VERTICALS.map((v) => (
                <div key={v.title} className="bg-[var(--m-bg)] border border-[var(--m-border)] rounded-[15px] p-6 card-lift">
                  <div className="font-mono text-[10px] tracking-[.14em] uppercase text-[var(--m-text-muted)] mb-2">Coming soon</div>
                  <h3 className="font-display text-[17px] font-bold tracking-[-0.02em] text-[var(--m-text)] mb-2">{v.title}</h3>
                  <p className="text-[13.5px] text-[var(--m-text-secondary)] leading-relaxed">{v.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[16px] text-[var(--m-text-secondary)] max-w-[60ch]" data-reveal>
              Our goal is simple — <strong className="text-[var(--m-text)]">automate the manual calling every industry still does by hand.</strong> Want Weeber for yours? Tell us when you join.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                Your data, yours alone
              </span>
              <h2 className="mt-4 mb-12 font-display text-[clamp(28px,3.8vw,46px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--m-text)] max-w-xl">
                Customer conversations are sensitive. We treat them that way.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4" data-reveal>
              {SECURITY_FEATURES.map((f, i) => {
                const Icon = [Shield, Lock, SlidersHorizontal][i];
                return (
                  <div key={f.title} className="bg-[var(--m-bg)] border border-[var(--m-border)] rounded-[15px] p-6 card-lift">
                    <Icon className="w-5 h-5 text-[var(--m-text)]" strokeWidth={1.7} />
                    <h3 className="mt-3 mb-2 font-display text-[16.5px] font-bold text-[var(--m-text)]">{f.title}</h3>
                    <p className="text-[14px] text-[var(--m-text-secondary)] leading-relaxed">{f.body}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-7 text-[14.5px] text-[var(--m-text-secondary)]" data-reveal>
              <strong className="text-[var(--m-text)]">Compliant by design.</strong> Weeber meets the data-protection standards your industry requires, with controls built in from day one.
            </p>
          </div>
        </section>

        {/* Why we exist */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg-alt)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div className="grid md:grid-cols-2 gap-16 items-start" data-reveal>
              <div>
                <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">Why we exist</span>
                <h2 className="mt-3 font-display text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-0.03em] leading-[1.08] text-[var(--m-text)]">
                  Enterprise AI was built for enterprises.{" "}
                  <span className="text-[var(--m-text-secondary)]">We built ours for everyone else.</span>
                </h2>
              </div>
              <div className="space-y-4 text-[var(--m-text-secondary)] leading-relaxed">
                <p>The voice AI market was designed for companies with legal teams and six-figure budgets. Compliance was an afterthought — added after lawsuits, not designed in from day one.</p>
                <p>We watched a Shopify merchant receive a $12,000 TCPA fine for a cart-recovery campaign their vendor told them was "compliant." The consent model was wrong. The opt-out mechanism was broken. The audit trail didn't exist.</p>
                <p>Weeber enforces consent at the infrastructure level. You literally cannot dial a number that hasn't passed our consent gate. That's the product.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Founders */}
        <section className="border-b border-[var(--m-border)] bg-[var(--m-bg)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div className="max-w-[760px]" data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                Why we built Weeber
              </span>
              <blockquote className="mt-5 font-display text-[clamp(20px,2.4vw,28px)] font-bold tracking-[-0.02em] leading-[1.4] text-[var(--m-text)]">
                "We kept watching good businesses lose customers to a phone nobody could answer — and watched 'AI calling' tools that sounded like robots. So we built one that sounds human, sets up in an afternoon, and works for the business you actually run."
              </blockquote>
              <div className="mt-6 flex items-center gap-4">
                <span className="w-11 h-11 rounded-full bg-[var(--m-accent-bg)] text-[var(--m-accent-fg)] flex items-center justify-center font-display font-bold text-sm flex-none">W</span>
                <div className="flex items-center gap-6">
                  <div>
                    <strong className="text-[15px] font-semibold text-[var(--m-text)]">Ashutosh Pawar</strong>
                    <span className="block text-[13.5px] text-[var(--m-text-secondary)]">Co-founder, Weeber</span>
                  </div>
                  <span className="text-[var(--m-border)]">&</span>
                  <div>
                    <strong className="text-[15px] font-semibold text-[var(--m-text)]">Rushikesh Pawar</strong>
                    <span className="block text-[13.5px] text-[var(--m-text-secondary)]">Co-founder, Weeber</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-[var(--m-border)] bg-[var(--m-bg-alt)]">
          <div className="max-w-[1100px] mx-auto px-6 py-24 md:py-28">
            <div data-reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.16em] uppercase text-[var(--m-text-muted)]">
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--m-text)] animate-pulse" />
                Questions
              </span>
              <h2 className="mt-4 mb-10 font-display text-[clamp(28px,3.8vw,46px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--m-text)]">
                Good to know before you join.
              </h2>
            </div>
            <div className="max-w-[760px]" data-reveal>
              {FAQ.map((item, i) => (
                <div key={item.q} className={`border-t border-[var(--m-border)] ${i === FAQ.length - 1 ? "border-b" : ""}`}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                  >
                    <span className="font-display font-bold text-[18px] tracking-[-0.01em] text-[var(--m-text)] group-hover:text-[var(--m-text-secondary)] transition-colors">{item.q}</span>
                    <span className="text-[var(--m-text-secondary)] text-xl flex-none leading-none">{openFaq === i ? "–" : "+"}</span>
                  </button>
                  <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: openFaq === i ? "200px" : "0", opacity: openFaq === i ? 1 : 0 }}>
                    <p className="pb-5 text-[15px] text-[var(--m-text-secondary)] leading-relaxed">{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      <MarketingFooter />
    </div>
  );
}
