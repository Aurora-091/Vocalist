import { useState } from "react";
import { ArrowRight, Phone, ShieldCheck, ChartBar as BarChart3, CircleCheck as CheckCircle2, Circle as XCircle } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { joinWaitlist, submitWaitlistPhone } from "../lib/api";
import { useWaitlistCount } from "../lib/useWaitlistCount";
import { trackFormSubmit, trackFormSuccess } from "../lib/analytics";
import { USE_CASES, HOW_IT_WORKS } from "../config/marketing";

const USE_CASE_ICONS = [ShieldCheck, BarChart3, Phone];
const BASE_COUNT = 170;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return /^\+?[\d\s\-()]{7,20}$/.test(phone);
}

function HeroForm() {
  const { count } = useWaitlistCount();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneState, setPhoneState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const valid = isValidEmail(email);
  const showValidation = touched && email.length >= 3;
  const displayCount = count !== null ? count + BASE_COUNT : BASE_COUNT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !valid) return;
    setState("loading");
    setErrorMsg("");
    trackFormSubmit();

    const result = await joinWaitlist(email);
    if (result.success) {
      setState("success");
      trackFormSuccess();
    } else {
      setState("error");
      setErrorMsg(result.error || "Something went wrong. Try again or email hello@weeber.ai");
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !isValidPhone(phone)) return;
    setPhoneState("loading");

    const result = await submitWaitlistPhone(email, phone);
    if (result.success) {
      setPhoneState("success");
    } else {
      setPhoneState("error");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      {state !== "success" ? (
        <>
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setTouched(true); }}
                  placeholder="you@company.com"
                  className="w-full h-12 px-4 pr-10 text-sm bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:outline-none transition-colors"
                />
                {showValidation && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {valid ? (
                      <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={state === "loading" || !valid}
                className="h-12 px-5 text-sm font-medium bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {state === "loading" ? "Joining..." : "Get early access"}
              </button>
            </div>
            {state === "error" && (
              <p className="mt-2 text-xs text-red-600">{errorMsg}</p>
            )}
            <p className="mt-2.5 text-xs text-[#94A3B8]">
              No credit card. No code. First 100 businesses get founder pricing.
            </p>
          </form>

          {/* Live counter */}
          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-sm font-medium text-[#0F172A]">
              {displayCount}+ businesses on the waitlist
            </span>
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <div className="p-6 border border-[#E2E8F0] bg-[#F1F5F9]">
            <div className="font-semibold text-base flex items-center gap-2 text-[#0F172A]">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
              You're on the list.
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
              Check your email! We've sent you early access details. First 100 businesses get founder pricing.
            </p>
          </div>

          {/* Live counter */}
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-sm font-medium text-[#0F172A]">
              {displayCount}+ businesses on the waitlist
            </span>
          </div>

          {/* Phone opt-in */}
          {phoneState !== "success" ? (
            <form onSubmit={handlePhoneSubmit} className="mt-2">
              <p className="text-xs text-[#64748B] mb-2">
                Want a text when your spot opens? Add your number (optional).
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneTouched(true); }}
                    placeholder="+1 (555) 123-4567"
                    className="w-full h-10 px-4 pr-10 text-sm bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:outline-none transition-colors"
                  />
                  {phoneTouched && phone.length >= 7 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isValidPhone(phone) ? (
                        <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={phoneState === "loading" || !isValidPhone(phone)}
                  className="h-10 px-4 text-sm font-medium bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {phoneState === "loading" ? "Saving..." : "Opt in"}
                </button>
              </div>
              {phoneState === "error" && (
                <p className="mt-1.5 text-xs text-red-600">Could not save number. Try again.</p>
              )}
              <p className="mt-1.5 text-[10px] text-[#94A3B8]">
                We'll only text you once when your invite is ready. No spam.
              </p>
            </form>
          ) : (
            <div className="p-4 border border-[#E2E8F0] bg-[#F1F5F9]">
              <div className="text-sm flex items-center gap-2 text-[#0F172A] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                Phone saved. We'll text you when your spot opens.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Waitlist() {
  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      {/* Hero with form */}
      <section id="waitlist" className="pt-32 pb-20 md:pb-24 px-6">
        <div className="max-w-[640px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            <span className="text-xs font-medium tracking-widest uppercase text-[#64748B]">
              Now accepting early access
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#0F172A]">
            Your business
            <br />
            never misses
            <br />
            <span className="text-[#64748B]">a call again.</span>
          </h1>
          <p className="mt-6 text-lg text-[#475569] leading-relaxed max-w-lg mx-auto">
            The only voice agent built with compliance first. TCPA-verified. Works in minutes.
          </p>
          <div className="mt-8">
            <HeroForm />
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            What Weeber does
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-0 max-w-xl">
            Three problems. One voice agent.
          </h2>
          <div>
            {USE_CASES.map((uc, i) => {
              const Icon = USE_CASE_ICONS[i];
              const isEven = i % 2 === 0;
              return (
                <div
                  key={uc.vertical}
                  className={`grid md:grid-cols-2 gap-12 items-center py-16 border-t border-[#E2E8F0] mt-12 first:mt-12 ${
                    !isEven ? "md:[&>*:first-child]:order-last" : ""
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-3">
                      {uc.vertical}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#0F172A] mb-4">
                      {uc.headline}
                    </h3>
                    <p className="text-[#475569] leading-relaxed">{uc.body}</p>
                    <div className="mt-6 inline-flex items-center gap-3 bg-[#F0EDE4] border border-[#D9D5CE] px-4 py-2.5">
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0" />
                      <span className="text-sm text-[#475569]">{uc.stat}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] p-8 aspect-[4/3] flex flex-col justify-between">
                    <div className="w-10 h-10 bg-[#F1F5F9] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#0F172A]" />
                    </div>
                    <div>
                      <div className="font-mono text-3xl font-bold text-[#0F172A] mb-1">
                        {["18\u201324%", "3.2 hrs", "24/7"][i]}
                      </div>
                      <div className="text-xs text-[#64748B] uppercase tracking-wide">
                        {["cart recovery rate", "saved per day", "calls answered"][i]}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#E2E8F0] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            How it works
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12 max-w-xl">
            Built compliance-first, not bolted on.
          </h2>
          <div className="grid md:grid-cols-3 gap-0 border border-[#D9D5CE]">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className={`p-8 bg-white ${i < HOW_IT_WORKS.length - 1 ? "border-b md:border-b-0 md:border-r border-[#D9D5CE]" : ""}`}
              >
                <div className="font-mono text-xs text-[#64748B] mb-5">{step.step}</div>
                <h3 className="font-semibold text-[#0F172A] mb-3">{step.title}</h3>
                <p className="text-sm text-[#475569] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why compliance matters */}
      <section className="border-t border-[#E2E8F0] bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
                Why we exist
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A]">
                Enterprise AI was built for enterprises.
                <span className="text-[#64748B]"> We built ours for everyone else.</span>
              </h2>
            </div>
            <div className="space-y-4 text-[#475569] leading-relaxed">
              <p>
                The voice AI market was designed for companies with legal teams and
                six-figure budgets. Compliance was an afterthought — added after lawsuits,
                not designed in from day one.
              </p>
              <p>
                We watched a Shopify merchant receive a $12,000 TCPA fine for a
                cart-recovery campaign their vendor told them was "compliant." The consent
                model was wrong. The opt-out mechanism was broken. The audit trail
                didn't exist.
              </p>
              <p>
                Weeber enforces consent at the infrastructure level. You literally cannot
                dial a number that hasn't passed our consent gate. That's the product.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
