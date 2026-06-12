import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck as CheckCircle } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { CALL_TRANSCRIPT } from "../config/marketing";

const SCENARIOS = [
  {
    title: "Appointment confirmation",
    description: "Confirm, reschedule, or cancel upcoming appointments with natural conversation.",
  },
  {
    title: "Cart recovery",
    description: "Call customers who abandoned checkout. Offer help, answer questions, close the sale.",
  },
  {
    title: "Inbound routing",
    description: "Answer calls, qualify intent, route to the right person or handle it autonomously.",
  },
  {
    title: "Payment reminders",
    description: "Gentle, compliant payment follow-ups that respect consent and timing rules.",
  },
] as const;

export default function Demo() {
  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            Live demo
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#111] max-w-3xl">
            Hear Weeber
            <br />
            <span className="text-[#888]">handle a real call.</span>
          </h1>
          <p className="mt-6 text-lg text-[#555] max-w-2xl leading-relaxed">
            Below is a real transcript from an appointment confirmation call. The entire
            interaction took 47 seconds and required zero human intervention.
          </p>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-[1fr_320px] gap-8">
            <div className="border border-[#D9D5CE] rounded-none overflow-hidden">
              <div className="bg-[#111] px-5 py-3 flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-[#16a34a] rounded-full" />
                <span className="font-mono text-xs text-[#999]">
                  call_transcript_2026-06-09_14:32:07
                </span>
              </div>
              <div className="p-6 space-y-4 bg-white max-h-[500px] overflow-y-auto custom-scrollbar">
                {CALL_TRANSCRIPT.map((line, i) => (
                  <div
                    key={i}
                    className={`flex ${line.speaker === "agent" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
                        line.speaker === "agent"
                          ? "bg-[#F0EDE4] text-[#111]"
                          : "bg-[#111] text-white"
                      }`}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-widest mb-1 opacity-60">
                        {line.speaker === "agent" ? "Weeber" : "Customer"}
                      </div>
                      {line.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="border border-[#D9D5CE] p-5 rounded-none bg-white">
                <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
                  Call metadata
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[#888]">Type</dt>
                    <dd className="text-[#111] font-medium">Outbound</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#888]">Agent</dt>
                    <dd className="text-[#111] font-medium">Bloom Dental</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#888]">Duration</dt>
                    <dd className="font-mono text-[#111]">0:47</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#888]">Outcome</dt>
                    <dd className="text-[#111] font-medium">Rescheduled</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#888]">Cost</dt>
                    <dd className="font-mono text-[#111]">$0.08</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-[#D9D5CE] p-5 rounded-none bg-white">
                <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
                  Compliance checks
                </div>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2 text-[#111]">
                    <CheckCircle className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                    Consent verified
                  </li>
                  <li className="flex items-center gap-2 text-[#111]">
                    <CheckCircle className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                    DNC check passed
                  </li>
                  <li className="flex items-center gap-2 text-[#111]">
                    <CheckCircle className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                    Time-of-day compliant
                  </li>
                  <li className="flex items-center gap-2 text-[#111]">
                    <CheckCircle className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                    Recording disclosed
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#D9D5CE] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            Use cases
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#111] mb-12">
            What Weeber can handle
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {SCENARIOS.map((scenario) => (
              <div
                key={scenario.title}
                className="bg-[#FAFAF8] border border-[#D9D5CE] p-6 rounded-none"
              >
                <h3 className="font-semibold text-[#111]">{scenario.title}</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">{scenario.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Try it yourself
          </h2>
          <p className="mt-4 text-[#999] max-w-md mx-auto">
            Sign up, create an agent, and place a test call in under 10 minutes. No credit card.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center h-12 px-6 bg-white text-[#111] text-sm font-medium rounded-none hover:bg-[#f0f0f0] transition-colors"
          >
            Start free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
