import { useState } from "react";
import { ArrowRight, CircleCheck as CheckCircle2, Circle as XCircle, Mail, Shield, Lock, SlidersHorizontal } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { joinWaitlist } from "../lib/api";
import { useWaitlistCount } from "../lib/useWaitlistCount";
import { trackFormSubmit, trackFormSuccess } from "../lib/analytics";
import {
  STATS,
  VERTICALS,
  VOICES,
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

const BASE_COUNT = 170;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  if (!phone) return true;
  return /^\+?[\d\s\-()]{7,20}$/.test(phone);
}

function Waveform() {
  const bars = Array.from({ length: 18 }, (_, i) =>
    4 + Math.round(11 * Math.abs(Math.sin(i * 1.1)))
  );
  return (
    <div className="flex items-center gap-[2px] h-5 flex-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm bg-[#CBD5E1] flex-none"
          style={{ height: `${h}px` }}
        />
      ))}
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
  const displayCount = count !== null ? count + BASE_COUNT : BASE_COUNT;

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

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => { setName(e.target.value); setTouched((t) => ({ ...t, name: true })); }}
            placeholder="Your name"
            className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E6E5E2] text-[#0B0B0C] placeholder:text-[#9A9AA0] focus:border-[#0B0B0C] focus:outline-none transition-colors rounded-none"
          />
          {touched.name && name.length >= 1 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {nameValid
                ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                : <XCircle className="w-4 h-4 text-red-500" />}
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setTouched((t) => ({ ...t, email: true })); }}
            placeholder="you@yourbrand.com"
            className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E6E5E2] text-[#0B0B0C] placeholder:text-[#9A9AA0] focus:border-[#0B0B0C] focus:outline-none transition-colors rounded-none"
          />
          {touched.email && email.length >= 3 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {emailValid
                ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                : <XCircle className="w-4 h-4 text-red-500" />}
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setTouched((t) => ({ ...t, phone: true })); }}
            placeholder="+91 98765 43210 (optional)"
            className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E6E5E2] text-[#0B0B0C] placeholder:text-[#9A9AA0] focus:border-[#0B0B0C] focus:outline-none transition-colors rounded-none"
          />
          {touched.phone && phone.length >= 7 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {phoneValid
                ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                : <XCircle className="w-4 h-4 text-red-500" />}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={state === "loading" || !canSubmit}
          className="w-full h-12 text-sm font-semibold bg-[#0B0B0C] text-white hover:opacity-90 transition-opacity disabled:opacity-50 rounded-[11px]"
        >
          {state === "loading" ? "Joining..." : "Get early access"}
        </button>

        {state === "error" && (
          <p className="text-xs text-red-600">{errorMsg}</p>
        )}

        <p className="text-xs text-[#9A9AA0] text-center">
          First waitlist customers lock in <span className="font-semibold text-[#0B0B0C] border-b border-[#0B0B0C]">founder pricing — for life.</span>
        </p>
      </form>

      <div className="mt-5 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#0B0B0C] animate-pulse" />
        <span className="text-sm font-medium text-[#0B0B0C]">
          {displayCount}+ businesses already on the waitlist
        </span>
      </div>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[420px] p-6 bg-[#FCFCFB] text-[#0B0B0C] [&_button[data-slot=dialog-close]]:text-[#67676C] [&_button[data-slot=dialog-close]]:hover:text-[#0B0B0C]">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#0B0B0C] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <DialogTitle className="text-xl font-bold text-[#0B0B0C]">
              You're on the list.
            </DialogTitle>
            <DialogDescription className="text-[#67676C] mt-1">
              We'll reach out when your spot is ready.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-[#F3F2EF] border border-[#E6E5E2]">
            <Mail className="w-4 h-4 text-[#67676C] flex-shrink-0" />
            <span className="text-sm text-[#0B0B0C] truncate">{email}</span>
          </div>
          <p className="mt-4 text-xs text-[#9A9AA0] text-center">
            Weeber is coming soon. Built compliance-first to give you back your time.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Waitlist() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="marketing min-h-full bg-[#FCFCFB]">
      <MarketingNav />

      {/* Hero */}
      <section id="waitlist" className="pt-32 pb-20 md:pb-24 px-6 text-center overflow-hidden">
        <div className="max-w-[860px] mx-auto">
          <span className="inline-flex items-center gap-2 font-mono text-[11.5px] tracking-[.2em] uppercase text-[#9A9AA0] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B0B0C] animate-pulse" />
            Live · private beta
          </span>
          <h1 className="text-[clamp(38px,6.2vw,72px)] font-bold leading-[0.97] tracking-[-0.03em] text-[#0B0B0C]">
            Every call you miss is a customer your competitor just won.
          </h1>
          <p className="mt-6 text-[clamp(17px,1.5vw,20px)] text-[#67676C] max-w-[52ch] mx-auto leading-relaxed">
            Weeber is a voice AI that answers and makes your customer calls for you — booking appointments, recovering abandoned carts, and following up on every order. It sounds human, runs 24/7, and never lets a lead go cold. No code.
          </p>
          <div className="mt-10">
            <HeroForm />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-[#E6E5E2] bg-[#FCFCFB]">
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.value}
                className={`px-6 py-2 ${i > 0 ? "border-l border-[#E6E5E2]" : ""} ${i === 2 ? "border-l-0 md:border-l" : ""}`}
              >
                <span className="block font-bold text-[clamp(34px,4vw,48px)] leading-none tracking-[-0.04em] text-[#0B0B0C]">
                  {s.value}
                </span>
                <p className="mt-2 text-[13.5px] text-[#67676C] leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section className="border-b border-[#E6E5E2] bg-[#F3F2EF]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <div className="mb-14">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Built for how you sell</span>
            <h2 className="mt-3 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C] max-w-xl">
              Whatever you run, the lost sale is the same — a call that didn't happen.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-[#E6E5E2] border border-[#E6E5E2] rounded-[18px] overflow-hidden">
            {VERTICALS.map((v) => (
              <div key={v.label} className="bg-[#FCFCFB] p-7 flex flex-col">
                <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">{v.label}</span>
                <h3 className="mt-3 mb-3 text-[21px] font-bold tracking-[-0.02em] leading-snug text-[#0B0B0C]">{v.headline}</h3>
                <p className="text-[14.5px] text-[#67676C] leading-relaxed">{v.problem}</p>
                <p className="mt-3 text-[14.5px] text-[#0B0B0C] leading-relaxed">{v.solution}</p>
                <div className="mt-5 flex items-center gap-3 border border-[#E6E5E2] rounded-[11px] p-3">
                  <button
                    aria-label={`Play ${v.demoLabel} sample`}
                    className="flex-none w-8 h-8 rounded-full bg-[#0B0B0C] flex items-center justify-center hover:opacity-80 transition-opacity"
                  >
                    <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0B0B0C]">{v.demoLabel}</div>
                    <div className="font-mono text-[11px] text-[#9A9AA0] mt-0.5">{v.demoAccent}</div>
                  </div>
                  <Waveform />
                  <span className="font-mono text-[11px] text-[#9A9AA0] flex-none">{v.demoDuration}</span>
                </div>
                <div className="mt-auto pt-5">
                  <a
                    href={v.cta.href}
                    className="text-[14.5px] font-semibold inline-flex items-center gap-1.5 border-b border-[#0B0B0C] pb-px hover:gap-2.5 transition-all"
                  >
                    {v.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voices */}
      <section className="border-b border-[#E6E5E2] bg-[#FCFCFB]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Voices</span>
            <h2 className="mt-3 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C]">
              Pick a voice your customers will trust.
            </h2>
            <p className="mt-3 text-[17.5px] text-[#67676C] max-w-[48ch] mx-auto">
              Natural, real-time speech — not a phone-tree robot. Most callers don't realize it's AI.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {VOICES.map((v) => (
              <div key={v.name} className="border border-[#E6E5E2] rounded-[15px] p-5 bg-[#FCFCFB]">
                <div className="flex items-center gap-3">
                  <button
                    aria-label={`Play ${v.name}`}
                    className="flex-none w-8 h-8 rounded-full bg-[#0B0B0C] flex items-center justify-center hover:opacity-80 transition-opacity"
                  >
                    <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                  </button>
                  <div>
                    <div className="font-semibold text-[15px] text-[#0B0B0C]">{v.name}</div>
                    <div className="font-mono text-[11px] text-[#9A9AA0] mt-0.5">{v.tag}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Waveform />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-7 flex items-center justify-between flex-wrap gap-3">
            <p className="text-[15.5px] text-[#67676C]">
              <strong className="text-[#0B0B0C]">More than 50 voices are live</strong> — across multiple languages and accents.
            </p>
            <a href="/#waitlist" className="text-[15px] font-semibold border-b border-[#0B0B0C] pb-px">
              Browse all voices →
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-[#E6E5E2] bg-[#F3F2EF]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">How it works</span>
          <h2 className="mt-3 mb-12 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C] max-w-xl">
            Built compliance-first, not bolted on.
          </h2>
          <div className="grid md:grid-cols-3 gap-px bg-[#E6E5E2] border border-[#E6E5E2]">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className={`p-8 bg-[#FCFCFB] ${i < HOW_IT_WORKS.length - 1 ? "border-b md:border-b-0 md:border-r border-[#E6E5E2]" : ""}`}
              >
                <div className="font-mono text-xs text-[#9A9AA0] mb-5">{step.step}</div>
                <h3 className="font-semibold text-[#0B0B0C] mb-3">{step.title}</h3>
                <p className="text-sm text-[#67676C] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform features + integrations */}
      <section className="border-b border-[#E6E5E2] bg-[#FCFCFB]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <div className="mb-3 inline-flex items-center gap-2 border border-[#0B0B0C] rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B0B0C] animate-pulse" />
            Beta testing soon — waitlist customers go first
          </div>
          <div className="mt-3">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Built and ready</span>
          </div>
          <h2 className="mt-3 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C] max-w-2xl">
            A no-code voice platform that fits the tools you already run.
          </h2>
          <p className="mt-4 text-[17.5px] text-[#67676C] max-w-xl">
            Everything here is built today. Build and launch call flows yourself — no engineers, no scripts to record.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-5 mb-14">
            {PLATFORM_FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="flex-none mt-0.5 w-5 h-5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                </span>
                <div>
                  <strong className="text-[15.5px] font-semibold text-[#0B0B0C]">{f.title}</strong>
                  <span className="block text-[14px] text-[#67676C] mt-0.5">{f.body}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mb-10">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Connected</span>
            <h2 className="mt-3 text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.03em] leading-[1.1] text-[#0B0B0C] max-w-xl mx-auto">
              Imagine the conversions when everything's connected to Weeber.
            </h2>
            <p className="mt-3 text-[17px] text-[#67676C] max-w-lg mx-auto">
              Plug in the tools you already run and every order, lead, and missed call becomes a call worth making — automatically.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Store & site */}
            <div className="border border-[#E6E5E2] rounded-[16px] p-6 bg-[#FCFCFB]">
              <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                <span className="w-7 h-7 rounded-[8px] border border-[#E6E5E2] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="1.8"><path d="M4 8h16v11H4zM4 8l2-4h12l2 4" /></svg>
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
                    <span className={`w-12 h-12 rounded-[13px] border flex items-center justify-center text-[15px] font-bold ${t.dark ? "bg-[#0B0B0C] text-white border-[#0B0B0C]" : "bg-white text-[#0B0B0C] border-[#E6E5E2]"}`}>
                      {t.letter}
                    </span>
                    <span className="text-[11px] text-[#67676C]">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Marketing & data */}
            <div className="border border-[#E6E5E2] rounded-[16px] p-6 bg-[#FCFCFB]">
              <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                <span className="w-7 h-7 rounded-[8px] border border-[#E6E5E2] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="1.8"><path d="M4 19V11M10 19V5M16 19v-7M2 19h20" /></svg>
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
                    <span className={`w-12 h-12 rounded-[13px] border flex items-center justify-center text-[13px] font-bold ${t.dark ? "bg-[#0B0B0C] text-white border-[#0B0B0C]" : "bg-white text-[#0B0B0C] border-[#E6E5E2]"}`}>
                      {t.letter}
                    </span>
                    <span className="text-[11px] text-[#67676C]">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Call flows */}
            <div className="border border-[#E6E5E2] rounded-[16px] p-6 bg-[#FCFCFB] md:col-span-2">
              <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                <span className="w-7 h-7 rounded-[8px] border border-[#E6E5E2] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="1.8"><path d="M5 12l4 4 10-10" /></svg>
                </span>
                Ready-made call flows
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {READY_FLOWS.map((f) => (
                  <div key={f} className="flex items-center gap-2.5 bg-[#F3F2EF] border border-[#E6E5E2] rounded-[11px] px-4 py-3.5 text-[14.5px] font-semibold text-[#0B0B0C] hover:bg-white hover:border-[#0B0B0C] transition-colors cursor-default">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0B0B0C] flex-none" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Live now */}
            <div className="border border-[#E6E5E2] rounded-[16px] p-6 bg-[#FCFCFB] md:col-span-2">
              <div className="flex items-center gap-2.5 font-semibold text-[14px] mb-5">
                <span className="w-7 h-7 rounded-[8px] border border-[#E6E5E2] flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#0B0B0C] animate-pulse" />
                </span>
                Live now · in private beta
              </div>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex gap-2 flex-wrap">
                  {["Clinics & local services", "D2C & e-commerce", "Enterprise"].map((t) => (
                    <span key={t} className="border border-[#0B0B0C] rounded-full px-4 py-1.5 text-[13px] font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-[13.5px] text-[#67676C]">
                  <strong className="text-[#0B0B0C]">Coming next:</strong> hotels, hospitals, real estate & more ↓
                </span>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[14.5px] text-[#67676C]">
            <strong className="text-[#0B0B0C]">Connects to 50+ tools — and counting.</strong> Don't see the one you need?{" "}
            <a href="mailto:hello@weeber.ai" className="border-b border-[#0B0B0C]">Request a connector →</a>
          </p>
        </div>
      </section>

      {/* Upcoming verticals */}
      <section className="border-b border-[#E6E5E2] bg-[#F3F2EF]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">What's next</span>
          <h2 className="mt-3 mb-12 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C] max-w-2xl">
            We started with stores and local shops. We're coming for every phone call.
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {UPCOMING_VERTICALS.map((v) => (
              <div key={v.title} className="bg-[#FCFCFB] border border-[#E6E5E2] rounded-[15px] p-6">
                <div className="font-mono text-[10px] tracking-[.14em] uppercase text-[#9A9AA0] mb-2">Coming soon</div>
                <h3 className="text-[17px] font-bold tracking-[-0.02em] text-[#0B0B0C] mb-2">{v.title}</h3>
                <p className="text-[13.5px] text-[#67676C] leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[16px] text-[#67676C] max-w-[60ch]">
            Our goal is simple — <strong className="text-[#0B0B0C]">automate the manual calling every industry still does by hand.</strong> Want Weeber for yours? Tell us when you join.
          </p>
        </div>
      </section>

      {/* Security */}
      <section className="border-b border-[#E6E5E2] bg-[#FCFCFB]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Your data, yours alone</span>
          <h2 className="mt-3 mb-12 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C] max-w-xl">
            Customer conversations are sensitive. We treat them that way.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {SECURITY_FEATURES.map((f, i) => {
              const Icon = [Shield, Lock, SlidersHorizontal][i];
              return (
                <div key={f.title} className="bg-[#FCFCFB] border border-[#E6E5E2] rounded-[15px] p-6">
                  <Icon className="w-5 h-5 stroke-[#0B0B0C]" strokeWidth={1.7} />
                  <h3 className="mt-3 mb-2 text-[16.5px] font-bold text-[#0B0B0C]">{f.title}</h3>
                  <p className="text-[14px] text-[#67676C] leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-7 text-[14.5px] text-[#67676C]">
            <strong className="text-[#0B0B0C]">Compliant by design.</strong> Weeber meets the data-protection standards your industry requires, with controls built in from day one.
          </p>
        </div>
      </section>

      {/* Why we exist */}
      <section className="border-b border-[#E6E5E2] bg-[#F3F2EF]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Why we exist</span>
              <h2 className="mt-3 text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.03em] leading-[1.08] text-[#0B0B0C]">
                Enterprise AI was built for enterprises.{" "}
                <span className="text-[#67676C]">We built ours for everyone else.</span>
              </h2>
            </div>
            <div className="space-y-4 text-[#67676C] leading-relaxed">
              <p>The voice AI market was designed for companies with legal teams and six-figure budgets. Compliance was an afterthought — added after lawsuits, not designed in from day one.</p>
              <p>We watched a Shopify merchant receive a $12,000 TCPA fine for a cart-recovery campaign their vendor told them was "compliant." The consent model was wrong. The opt-out mechanism was broken. The audit trail didn't exist.</p>
              <p>Weeber enforces consent at the infrastructure level. You literally cannot dial a number that hasn't passed our consent gate. That's the product.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Founders */}
      <section className="border-b border-[#E6E5E2] bg-[#FCFCFB]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <div className="max-w-[760px]">
            <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Why we built Weeber</span>
            <blockquote className="mt-5 font-bold text-[clamp(20px,2.4vw,28px)] tracking-[-0.02em] leading-[1.4] text-[#0B0B0C]">
              "We kept watching good businesses lose customers to a phone nobody could answer — and watched 'AI calling' tools that sounded like robots. So we built one that sounds human, sets up in an afternoon, and works for the business you actually run."
            </blockquote>
            <div className="mt-6 flex items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-[#0B0B0C] text-white flex items-center justify-center font-bold text-sm flex-none">W</span>
              <div className="flex items-center gap-6">
                <div>
                  <strong className="text-sm font-semibold text-[#0B0B0C]">Ashutosh Pawar</strong>
                  <span className="block text-[13.5px] text-[#67676C]">Co-founder, Weeber</span>
                </div>
                <span className="text-[#E6E5E2]">&amp;</span>
                <div>
                  <strong className="text-sm font-semibold text-[#0B0B0C]">Rushikesh Pawar</strong>
                  <span className="block text-[13.5px] text-[#67676C]">Co-founder, Weeber</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-[#E6E5E2] bg-[#F3F2EF]">
        <div className="max-w-[1100px] mx-auto px-6 py-24">
          <span className="font-mono text-[11px] tracking-[.16em] uppercase text-[#9A9AA0]">Questions</span>
          <h2 className="mt-3 mb-10 text-[clamp(28px,3.8vw,44px)] font-bold tracking-[-0.03em] leading-[1.04] text-[#0B0B0C]">
            Good to know before you join.
          </h2>
          <div className="max-w-[760px]">
            {FAQ.map((item, i) => (
              <div key={item.q} className={`border-t border-[#E6E5E2] ${i === FAQ.length - 1 ? "border-b" : ""}`}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-bold text-[18px] tracking-[-0.01em] text-[#0B0B0C]">{item.q}</span>
                  <span className="text-[#67676C] text-xl flex-none leading-none">{openFaq === i ? "–" : "+"}</span>
                </button>
                {openFaq === i && (
                  <p className="pb-5 text-[15px] text-[#67676C] leading-relaxed">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#FCFCFB] py-28 px-6 text-center">
        <div className="max-w-[640px] mx-auto">
          <span className="inline-flex items-center gap-2 font-mono text-[11.5px] tracking-[.2em] uppercase text-[#9A9AA0] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B0B0C] animate-pulse" />
            Get early access
          </span>
          <h2 className="text-[clamp(32px,4.4vw,54px)] font-bold tracking-[-0.03em] leading-[0.97] text-[#0B0B0C] max-w-[16ch] mx-auto">
            Don't let the next call ring out.
          </h2>
          <div className="mt-10">
            <HeroForm />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
