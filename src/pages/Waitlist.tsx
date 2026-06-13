import { useState } from "react";
import { ArrowRight, Phone, ShieldCheck, ChartBar as BarChart3 } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { supabase } from "../lib/supabase";
import { USE_CASES, HOW_IT_WORKS, WAITLIST_BENEFITS } from "../config/marketing";

const USE_CASE_ICONS = [Phone, ShieldCheck, BarChart3];

function WaitlistForm({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    setErrorMsg("");
    const { error } = await supabase.from("waitlist").insert({ email, source: "website" });
    if (error) {
      if (error.code === "23505") {
        setState("success");
      } else {
        setState("error");
        setErrorMsg("Something went wrong. Please try again.");
      }
    } else {
      setState("success");
    }
  }

  if (state === "success") {
    return (
      <div className={`p-6 border max-w-md ${variant === "dark" ? "border-white/10 bg-white/5" : "border-[#E2E8F0] bg-[#F1F5F9]"}`}>
        <div className={`font-semibold text-base ${variant === "dark" ? "text-white" : "text-[#0F172A]"}`}>
          You're on the list.
        </div>
        <p className={`mt-1.5 text-sm leading-relaxed ${variant === "dark" ? "text-white/50" : "text-[#64748B]"}`}>
          We'll reach out when your spot opens. First 100 businesses get founder pricing.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={`flex-1 h-12 px-4 text-sm focus:outline-none transition-colors ${
            variant === "dark"
              ? "bg-white/8 border border-white/15 text-white placeholder:text-white/35 focus:border-white/40"
              : "bg-white border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A]"
          }`}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`h-12 px-5 text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
            variant === "dark"
              ? "bg-white text-[#111] hover:bg-[#f0f0f0]"
              : "bg-[#0F172A] text-white hover:bg-[#1E293B]"
          }`}
        >
          {state === "loading" ? "Joining..." : "Get early access"}
        </button>
      </div>
      {state === "error" && (
        <p className={`mt-2 text-xs ${variant === "dark" ? "text-red-400" : "text-red-600"}`}>{errorMsg}</p>
      )}
      <p className={`mt-2.5 text-xs ${variant === "dark" ? "text-white/35" : "text-[#94A3B8]"}`}>
        No credit card. No code. First 100 businesses get founder pricing.
      </p>
    </form>
  );
}

export default function Waitlist() {
  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      {/* Hero */}
      <section id="waitlist" className="pt-32 pb-0 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start pb-20 md:pb-24">
            <div>
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
              <p className="mt-6 text-lg text-[#475569] leading-relaxed max-w-lg">
                Weeber is a voice AI platform built for clinics, local shops, and
                Shopify merchants — with consent compliance baked in at the infrastructure
                level, not bolted on later.
              </p>
              <div className="mt-8">
                <WaitlistForm variant="light" />
              </div>
            </div>

            {/* Live call preview */}
            <div className="hidden md:block">
              <div className="bg-white border border-[#E2E8F0] p-6">
                <div className="flex items-center gap-3 mb-5 pb-5 border-b border-[#F1F5F9]">
                  <div className="w-8 h-8 bg-[#F1F5F9] flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-[#0F172A]" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#0F172A]">Bloom Dental — Appointment recovery</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                      <span className="text-[10px] text-[#64748B] tracking-wide">Live call in progress</span>
                    </div>
                  </div>
                  <div className="ml-auto font-mono text-xs text-[#64748B]">0:43</div>
                </div>
                <div className="space-y-3">
                  {[
                    { role: "agent", text: "Hi Sarah, I'm calling on behalf of Bloom Dental. You have a cleaning scheduled for Thursday at 2pm — are you still able to make it?" },
                    { role: "customer", text: "Actually, can I move it to Friday morning?" },
                    { role: "agent", text: "Of course. I have 9am and 10:30am on Friday. Which works better for you?" },
                    { role: "customer", text: "9am is perfect." },
                    { role: "agent", text: "Done. I've rescheduled you for Friday at 9am. You'll get a text confirmation shortly." },
                  ].map((line, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${line.role === "agent" ? "" : "flex-row-reverse"}`}
                    >
                      <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 ${
                        line.role === "agent"
                          ? "bg-[#0F172A] text-white"
                          : "bg-[#F1F5F9] text-[#64748B]"
                      }`}>
                        {line.role === "agent" ? "W" : "S"}
                      </div>
                      <div className={`text-xs leading-relaxed px-3 py-2 max-w-[80%] ${
                        line.role === "agent"
                          ? "bg-[#F8F9FB] text-[#475569]"
                          : "bg-[#F1F5F9] text-[#0F172A]"
                      }`}>
                        {line.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-[#F1F5F9] grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase tracking-wide">Outcome</div>
                    <div className="mt-0.5 text-xs font-medium text-[#22C55E]">Rescheduled</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase tracking-wide">Consent</div>
                    <div className="mt-0.5 text-xs font-medium text-[#0F172A]">Verified</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase tracking-wide">Duration</div>
                    <div className="mt-0.5 text-xs font-mono text-[#0F172A]">0:43</div>
                  </div>
                </div>
              </div>
            </div>
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
                        {["24/7", "18–24%", "3.2 hrs"][i]}
                      </div>
                      <div className="text-xs text-[#64748B] uppercase tracking-wide">
                        {["calls answered", "cart recovery rate", "saved per day"][i]}
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

      {/* Early access benefits */}
      <section className="border-t border-[#E2E8F0] bg-[#F1F5F9]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Early access
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12">
            Why join now.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {WAITLIST_BENEFITS.map((b) => (
              <div key={b.index} className="flex gap-5">
                <span className="font-mono text-sm text-[#64748B] mt-0.5 shrink-0">{b.index}</span>
                <div>
                  <h3 className="font-semibold text-[#0F172A]">{b.title}</h3>
                  <p className="mt-2 text-sm text-[#475569] leading-relaxed">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#111] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="max-w-xl">
            <div className="text-xs font-medium tracking-widest uppercase text-white/40 mb-4">
              Get early access
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Join 340+ businesses on the waitlist.
            </h2>
            <p className="text-white/50 leading-relaxed mb-8">
              We're onboarding in batches. Reserve your spot now and lock in
              founder pricing before we open to the public.
            </p>
            <WaitlistForm variant="dark" />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
