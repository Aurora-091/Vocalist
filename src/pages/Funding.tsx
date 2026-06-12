import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Mail } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";

const BUDGET = [
  { cat: "Infrastructure — hosting, telephony, API", amt: "₹7.0L", pct: 35, color: "#1d4ed8" },
  { cat: "Product completion — billing, inbound last mile", amt: "₹4.0L", pct: 20, color: "#5DB8A0" },
  { cat: "GTM & pilot acquisition — 20 SMBs", amt: "₹4.0L", pct: 20, color: "#5A8FD6" },
  { cat: "Hiring — engineer + compliance consultant", amt: "₹3.0L", pct: 15, color: "#A87FD6" },
  { cat: "Legal & DPDP / TCPA compliance audit", amt: "₹1.5L", pct: 7, color: "#D68A5A" },
  { cat: "Contingency", amt: "₹0.5L", pct: 3, color: "#8AA6C0" },
];

const ROADMAP = [
  {
    period: "Month 1–2",
    phase: "Foundation",
    milestones: ["Inbound call last mile", "Outbound campaign engine", "Stripe billing end-to-end"],
    kpis: ["Uptime ≥99.5%", "Kyonara pilot live"],
  },
  {
    period: "Month 2–3",
    phase: "First Revenue",
    milestones: ["Kyonara converts to paid", "First 5 paid pilots", "TCPA + DPDP audit begins"],
    kpis: ["MRR ≥ ₹25,000", "Cart recovery ≥8%"],
  },
  {
    period: "Month 3–5",
    phase: "Scale & Validate",
    milestones: ["20 paid pilots live", "DPDP readiness done", "Recovered-revenue studies"],
    kpis: ["CAC < ₹8,000", "No-show ↓ ≥20%"],
  },
  {
    period: "Month 6",
    phase: "Fundable Position",
    milestones: ["20 paying customers", "Proven ROI case studies", "Compliance cleared"],
    kpis: ["MRR ≥ ₹2.5L", "Pre-seed ready"],
    dark: true,
  },
];

const COMPETITION = [
  { label: "Target customer", weeber: "SMBs — Shopify + clinics", vapi: "Developers", polyai: "Enterprise", ringly: "General SMB" },
  { label: "Integration depth", weeber: "Native Shopify + EHR", vapi: "None — BYO", polyai: "Custom enterprise", ringly: "Shallow" },
  { label: "Compliance as product", weeber: "✓ TCPA / DPDP / GDPR", vapi: "✗ No", polyai: "Partial", ringly: "✗ No" },
  { label: "Vertical focus", weeber: "Ecommerce + healthcare", vapi: "Horizontal", polyai: "Enterprise", ringly: "General" },
  { label: "Pricing model", weeber: "SaaS + usage, SMB-priced", vapi: "API usage only", polyai: "Enterprise ACV", ringly: "SaaS" },
  { label: "India-ready", weeber: "✓ DPDP · ₹ pricing", vapi: "✗ No", polyai: "✗ No", ringly: "✗ No" },
];

const DELIVERABLES = [
  { n: "1", title: "20 SMB pilots → validated CAC & LTV", body: "Real acquisition cost and lifetime value from live paying customers — proof of unit economics." },
  { n: "2", title: "Recovered-revenue case studies", body: "Documented ≥8% cart recovery and ≥20% no-show reduction — tangible Indian SMB impact." },
  { n: "3", title: "DPDP compliance clearance", body: "India's first DPDP-compliant outbound voice product, audited and ready to scale." },
];

const TEAM = [
  {
    initials: "AT",
    name: "Ashutosh Tiwari",
    role: "Founder & CEO",
    pts: [
      "Founded AdloomX — Google Ad Grants & Helium10 partner, ~₹2 Cr ARR",
      "Hands-on SMB GTM — source of Weeber's founding insight",
      "Focused on automation, voice & signal products",
    ],
  },
  {
    initials: "RP",
    name: "Rushikesh Pawar",
    role: "Co-Founder & CTO",
    pts: [
      "AI product engineer — React, Python, Supabase, LangChain, Groq",
      "Built Weeber's working agent pipeline from scratch",
    ],
  },
  {
    initials: "AS",
    name: "Amit Singh",
    role: "Advisor",
    pts: ["Ex-Oracle Software Developer · SD Team Lead, Express Scripts"],
  },
];

const TRACTION = [
  { title: "Live product", body: "Places and receives calls today — not a prototype. Fully functional in production." },
  { title: "Kyonara.com pilot", body: "Indian D2C jewellery brand on Shopify — active pilot, our first design partner." },
  { title: "15+ SMBs signed", body: "Organic queue before any paid launch. Pre-revenue, pre-paid." },
  { title: "20 pilots planned", body: "Each producing documented recovered-revenue case studies for grant reporting." },
];

export default function Funding() {
  return (
    <div className="marketing min-h-full bg-[#F8F9FB] overflow-x-hidden">
      <MarketingNav />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto">
          <div className="inline-flex items-center gap-2 border border-[#1d4ed8] px-3 py-1.5 mb-8">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#1d4ed8]">
              Grant Pitch · DPIIT · TIDE 2.0 · SIME IIM Bombay
            </span>
          </div>

          <h1
            className="text-[clamp(56px,9vw,112px)] font-black uppercase leading-[0.88] tracking-tight mb-8"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">Voice</span>
            <br />
            <span className="text-[#1d4ed8]">Workforce</span>
            <br />
            <span className="text-[#0F172A]">for India.</span>
          </h1>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <p className="text-lg text-[#444] leading-relaxed max-w-xl">
              Weeber is building the AI voice workforce every Indian SMB can finally afford —
              vertical voice agents that recover revenue and cut no-shows, with compliance built in.
              We're raising <strong className="text-[#1d4ed8]">₹20,00,000</strong> in non-dilutive
              grant funding to go from working demo to revenue-generating, compliant product.
            </p>
            <div className="grid grid-cols-2 gap-0 border-2 border-[#0F172A]">
              {[
                { v: "₹20L", l: "Grant Ask", s: "Non-dilutive" },
                { v: "₹2Cr", l: "CEO's ARR", s: "AdloomX" },
                { v: "15+", l: "SMBs Queued", s: "Pre-revenue" },
                { v: "Live", l: "Product Status", s: "In production" },
              ].map((m, i) => (
                <div
                  key={m.l}
                  className={`p-6 ${i % 2 === 0 ? "border-r-2" : ""} ${i < 2 ? "border-b-2" : ""} border-[#0F172A]`}
                >
                  <div
                    className="text-3xl font-black text-[#1d4ed8] leading-none mb-1"
                    style={{ fontFamily: "'Geist Variable', sans-serif" }}
                  >
                    {m.v}
                  </div>
                  <div className="text-xs font-bold text-[#0F172A] mb-0.5">{m.l}</div>
                  <div className="text-[10px] text-[#888]">{m.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────── */}
      <section className="bg-[#F8F9FB] pb-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            01 / The Problem
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-4"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">The</span>
            <br />
            <span className="text-[#1d4ed8]">Problem</span>
          </h2>
          <p className="text-base text-[#555] max-w-xl mb-12">
            Indian SMBs bleed revenue every day — and cannot afford to stop the leak.
          </p>

          <div className="grid md:grid-cols-3 border-2 border-[#0F172A]">
            <div className="p-10 border-b-2 md:border-b-0 md:border-r-2 border-[#0F172A] hover:bg-[#F1F3F7] transition-colors">
              <div className="text-5xl font-black text-[#1d4ed8] leading-none mb-3 font-mono">₹2.2L Cr</div>
              <div className="text-sm font-bold uppercase tracking-wide mb-2">Lost to cart abandonment</div>
              <div className="text-sm text-[#555] leading-relaxed">
                70.2% avg abandonment. A ₹1Cr Shopify store leaks ~₹4.8L/year — silently.
              </div>
            </div>
            <div className="p-10 border-b-2 md:border-b-0 md:border-r-2 border-[#0F172A] hover:bg-[#F1F3F7] transition-colors">
              <div className="text-5xl font-black text-[#1d4ed8] leading-none mb-3 font-mono">₹1.3L Cr</div>
              <div className="text-sm font-bold uppercase tracking-wide mb-2">Missed appointments</div>
              <div className="text-sm text-[#555] leading-relaxed">
                5–30% no-show rates across India's 4.38 lakh health facilities. ₹2,000+ wasted per empty slot.
              </div>
            </div>
            <div className="p-10 bg-[#0F172A] hover:bg-[#161B27] transition-colors">
              <div className="text-5xl font-black text-[#1d4ed8] leading-none mb-3 font-mono">0</div>
              <div className="text-sm font-bold uppercase tracking-wide mb-2 text-white">Scalable solutions</div>
              <div className="text-sm text-[#888] leading-relaxed">
                Chat and email are automated. Outbound calls — the highest-intent channel — stay manual and unscalable for SMBs.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY NOW ─────────────────────────────────────── */}
      <section className="bg-[#0F172A] py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            02 / Why Now
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight text-white mb-4"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            Three Forces
            <br />
            <span className="text-[#1d4ed8]">Converged</span>
          </h2>
          <p className="text-sm text-[#555] mb-14">None existed 24 months ago.</p>

          <div className="grid md:grid-cols-3 border border-[#1E293B]">
            {[
              { n: "01", title: "Human-parity voice", body: "Real-time AI voice has cleared the human ceiling at scale. The tech barrier is gone — forever." },
              { n: "02", title: "COGS dropped to ₹10–12/min", body: "Per-minute infra fell 80%+ in 24 months. SMB-priced voice is finally economically viable." },
              { n: "03", title: "Compliance is now a moat", body: "DPDP Act + TCPA consent rules make compliant voice a product feature, not legal homework — for whoever ships it first." },
            ].map((f, i) => (
              <div key={f.n} className={`p-10 hover:bg-[#161B27] transition-colors ${i < 2 ? "border-b md:border-b-0 md:border-r border-[#1E293B]" : ""}`}>
                <div className="text-5xl font-black text-[#1d4ed8] leading-none mb-5" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
                  {f.n}
                </div>
                <div className="text-sm font-bold text-white uppercase tracking-wide mb-3">{f.title}</div>
                <div className="text-sm text-[#888] leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET OPPORTUNITY ──────────────────────────── */}
      <section className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            03 / Market Opportunity
          </div>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2
                className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-12"
                style={{ fontFamily: "'Geist Variable', sans-serif" }}
              >
                <span className="text-[#0F172A]">Market</span>
                <br />
                <span className="text-[#1d4ed8]">Opportunity</span>
              </h2>
              <div className="space-y-0 divide-y-2 divide-[#E4E7EE]">
                {[
                  { v: "$47.5B", title: "Voice AI market by 2034", body: "34.8% CAGR — vertical agents are the breakout category" },
                  { v: "$260B", title: "Recoverable ecommerce revenue", body: "Annual global cart abandonment · India's share ₹2.2L Cr+" },
                  { v: "$150B", title: "Missed appointment losses", body: "US healthcare alone · India's 4.38L facilities multiply this" },
                ].map((stat) => (
                  <div key={stat.title} className="py-7 flex gap-6 items-start">
                    <div className="text-4xl font-black text-[#1d4ed8] leading-none min-w-[130px]" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
                      {stat.v}
                    </div>
                    <div>
                      <div className="text-sm font-bold mb-1">{stat.title}</div>
                      <div className="text-sm text-[#888]">{stat.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="bg-[#0F172A] p-8 mb-4">
                <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#1d4ed8] mb-1">
                  Voice AI Market — $B
                </div>
                <div className="text-xs text-[#555] mb-6">$2.4B (2024) → $47.5B (2034) · 34.8% CAGR</div>
                <svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-40">
                  <line x1="48" y1="10" x2="48" y2="140" stroke="#1E293B" strokeWidth="1"/>
                  <line x1="48" y1="140" x2="465" y2="140" stroke="#1E293B" strokeWidth="1"/>
                  <line x1="48" y1="10" x2="465" y2="10" stroke="#131B26" strokeWidth="0.5" strokeDasharray="4,4"/>
                  <line x1="48" y1="47" x2="465" y2="47" stroke="#131B26" strokeWidth="0.5" strokeDasharray="4,4"/>
                  <line x1="48" y1="84" x2="465" y2="84" stroke="#131B26" strokeWidth="0.5" strokeDasharray="4,4"/>
                  <text x="42" y="143" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">0</text>
                  <text x="42" y="87" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">25</text>
                  <text x="42" y="50" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">38</text>
                  <text x="42" y="14" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">50</text>
                  <text x="70" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2024</text>
                  <text x="236" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2028</text>
                  <text x="401" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2032</text>
                  <text x="455" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2034</text>
                  <path d="M70,135 C100,133 130,128 153,122 S200,108 236,95 S290,70 319,55 S380,28 401,20 L455,12 L455,140 L70,140 Z" fill="rgba(29,78,216,0.12)"/>
                  <path d="M70,135 C100,133 130,128 153,122 S200,108 236,95 S290,70 319,55 S380,28 401,20 L455,12" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="70" cy="135" r="4" fill="#1d4ed8"/>
                  <circle cx="236" cy="95" r="4" fill="#1d4ed8"/>
                  <circle cx="401" cy="20" r="4" fill="#1d4ed8"/>
                  <circle cx="455" cy="12" r="5" fill="#1d4ed8"/>
                  <text x="455" y="8" fill="#1d4ed8" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="700">$47.5B</text>
                </svg>
              </div>
              <div className="bg-[#1d4ed8] p-5 text-white text-sm font-semibold leading-relaxed">
                <strong className="block mb-1">India tailwind</strong>
                1,21,600 active Shopify stores in Q1 2026, +32% YoY — the merchant base is already here.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRACTION ────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            04 / Traction
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-14"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">Traction</span>
            <br />
            <span className="text-[#1d4ed8]">&amp; Team</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-16">
            {/* Traction */}
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#1d4ed8] mb-6">Traction</div>
              <div className="space-y-0 divide-y divide-[#E4E7EE]">
                {TRACTION.map((t) => (
                  <div key={t.title} className="py-6 flex gap-4">
                    <span className="text-[#1d4ed8] font-bold text-lg mt-0.5 shrink-0">→</span>
                    <div>
                      <div className="text-sm font-bold mb-1">{t.title}</div>
                      <div className="text-sm text-[#555] leading-relaxed">{t.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team */}
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#1d4ed8] mb-6">Team</div>
              <div className="space-y-4">
                {TEAM.map((m) => (
                  <div key={m.name} className="border-2 border-[#0F172A] p-6 hover:bg-[#F1F3F7] transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-11 h-11 bg-[#0F172A] flex items-center justify-center text-[#1d4ed8] font-black tracking-wider shrink-0" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
                        {m.initials}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{m.name}</div>
                        <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#1d4ed8]">{m.role}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {m.pts.map((p) => (
                        <div key={p} className="flex gap-2 text-xs text-[#555]">
                          <span className="text-[#1d4ed8] shrink-0">·</span>
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPETITION ─────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#0F172A]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            05 / Why We Win
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight text-white mb-14"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            Why We
            <br />
            <span className="text-[#1d4ed8]">Win</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-[10px] font-bold tracking-[0.1em] uppercase text-[#555] border-b border-[#131B26]" />
                  <th className="py-3 px-4 text-[10px] font-bold tracking-[0.1em] uppercase text-white text-center bg-[#1d4ed8] border-b border-[#1d4ed8]">
                    Weeber
                  </th>
                  {["Vapi / Retell / Bland", "PolyAI", "Ringly / Synthflow"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-bold tracking-[0.1em] uppercase text-[#555] border-b border-[#131B26]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPETITION.map((row) => (
                  <tr key={row.label} className="border-b border-[#161B27]">
                    <td className="py-3 px-4 text-xs text-[#555] tracking-wide">{row.label}</td>
                    <td className="py-3 px-4 text-xs text-white font-semibold text-center bg-[#1d4ed8]/10">
                      <span className={row.weeber.startsWith("✓") ? "text-green-400" : row.weeber.startsWith("✗") ? "text-red-400" : "text-white"}>
                        {row.weeber}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#888]">
                      <span className={row.vapi.startsWith("✗") ? "text-red-500" : ""}>{row.vapi}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#888]">{row.polyai}</td>
                    <td className="py-3 px-4 text-xs text-[#888]">
                      <span className={row.ringly.startsWith("✗") ? "text-red-500" : ""}>{row.ringly}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-5 border border-[#1E293B] text-sm text-[#666]">
            <strong className="text-[#1d4ed8]">Key moat:</strong>{" "}
            73% of B2B buyers prefer verticalized solutions (Deloitte). Horizontal builders are moving upmarket — the India SMB gap widens.
          </div>
        </div>
      </section>

      {/* ── GRANT ASK ───────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            06 / The Ask
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-14"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">The</span>
            <br />
            <span className="text-[#1d4ed8]">Ask</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-16 mb-16">
            <div>
              <div
                className="text-[clamp(48px,7vw,80px)] font-black text-[#1d4ed8] leading-none mb-4"
                style={{ fontFamily: "'Geist Variable', sans-serif" }}
              >
                ₹20,00,000
              </div>
              <div className="text-sm font-bold mb-1">Non-dilutive grant · 6-month runway</div>
              <div className="text-sm text-[#666] mb-1">No equity. No valuation negotiation.</div>
              <div className="text-sm text-[#666] mb-6">Milestone-gated disbursement welcomed.</div>
              <div className="text-sm italic text-[#1d4ed8]">
                The grant closes the gap between working demo and revenue-generating, compliant product.
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#888] mb-5">
                Budget Breakdown
              </div>
              <div className="space-y-4">
                {BUDGET.map((b) => (
                  <div key={b.cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#555]">{b.cat}</span>
                      <span className="text-xs font-bold text-[#1d4ed8] ml-4 shrink-0">{b.amt} · {b.pct}%</span>
                    </div>
                    <div className="h-1 bg-[#E4E7EE] overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${b.pct}%`, background: b.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Deliverables */}
          <div className="grid md:grid-cols-3 gap-0 border-2 border-[#0F172A]">
            {DELIVERABLES.map((d, i) => (
              <div key={d.n} className={`p-8 bg-[#0F172A] hover:bg-[#161B27] transition-colors ${i < DELIVERABLES.length - 1 ? "border-b-2 md:border-b-0 md:border-r-2 border-[#1E293B]" : ""}`}>
                <div className="w-7 h-7 bg-[#1d4ed8] flex items-center justify-center text-white font-black text-xs mb-4">
                  {d.n}
                </div>
                <div className="text-sm font-bold text-white mb-2">{d.title}</div>
                <div className="text-xs text-[#777] leading-relaxed">{d.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ─────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            07 / Roadmap
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-14"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">6-Month</span>
            <br />
            <span className="text-[#1d4ed8]">Roadmap</span>
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-2 border-[#0F172A]">
            {ROADMAP.map((p, i) => (
              <div
                key={p.phase}
                className={`p-7 transition-colors ${
                  p.dark ? "bg-[#0F172A] hover:bg-[#161B27]" : "hover:bg-[#F1F3F7]"
                } ${i < ROADMAP.length - 1 ? "border-b-2 sm:border-b-0 " : ""}${
                  i % 2 === 0 && i < ROADMAP.length - 1 ? "sm:border-r-2 " : ""
                }${i === 1 && i < ROADMAP.length - 1 ? "sm:border-r-0 lg:border-r-2 " : ""
                }border-[#0F172A]`}
              >
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#1d4ed8] mb-2">
                  {p.period}
                </div>
                <div className={`text-base font-bold mb-4 ${p.dark ? "text-white" : ""}`}>
                  {p.phase}
                </div>
                <div className={`border-t mb-4 ${p.dark ? "border-[#1E293B]" : "border-[#E4E7EE]"}`} />
                <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-[#888] mb-2">Milestones</div>
                {p.milestones.map((m) => (
                  <div key={m} className={`flex gap-1.5 text-xs mb-1.5 ${p.dark ? "text-[#aaa]" : "text-[#444]"}`}>
                    <span className="text-[#1d4ed8] shrink-0">→</span>
                    {m}
                  </div>
                ))}
                <div className={`border-t my-3 ${p.dark ? "border-[#1E293B]" : "border-[#E4E7EE]"}`} />
                <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-[#888] mb-2">KPIs</div>
                {p.kpis.map((k) => (
                  <div key={k} className={`flex gap-1.5 text-xs mb-1.5 font-semibold ${p.dark ? "text-[#1d4ed8]" : ""}`}>
                    <span className="text-[#1d4ed8] shrink-0">★</span>
                    {k}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="p-5 bg-[#0F172A] border-2 border-[#0F172A] border-t-0 text-xs text-[#555] leading-relaxed">
            <strong className="text-[#1d4ed8]">Key de-risking event:</strong>{" "}
            Converting Kyonara + 5 more pilots to paying customers with documented recovered-revenue ROI — exactly what this grant funds.
          </div>
        </div>
      </section>

      {/* ── PRICING SUMMARY ──────────────────────────────── */}
      <section className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8] mb-4">
            08 / Revenue Model
          </div>
          <h2
            className="text-[clamp(36px,5vw,64px)] font-black uppercase leading-[0.9] tracking-tight mb-14"
            style={{ fontFamily: "'Geist Variable', sans-serif" }}
          >
            <span className="text-[#0F172A]">Revenue</span>
            <br />
            <span className="text-[#1d4ed8]">Model</span>
          </h2>

          <div className="grid md:grid-cols-3 border-2 border-[#0F172A]">
            {[
              {
                tier: "Starter", price: "₹4,999", period: "per month · up to 500 calls",
                features: ["Shopify recovery agent", "Basic inbound support", "Consent ledger included", "Email support"],
              },
              {
                tier: "Growth", price: "₹12,999", period: "per month · up to 2,000 calls",
                features: ["Shopify + clinic agents", "Full outbound campaigns", "DPDP / TCPA compliance", "Priority support"],
                popular: true,
              },
              {
                tier: "Scale", price: "Custom", period: "Unlimited calls · white-label",
                features: ["All agents + white-label", "Custom integrations", "Dedicated compliance audit", "Success manager"],
              },
            ].map((plan, i) => (
              <div
                key={plan.tier}
                className={`p-8 relative ${plan.popular ? "bg-[#0F172A]" : "hover:bg-[#F1F3F7]"} transition-colors ${
                  i < 2 ? "border-b-2 md:border-b-0 md:border-r-2 border-[#0F172A]" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-[#1d4ed8] text-white text-[9px] font-bold tracking-widest uppercase px-4 py-1">
                    Most Popular
                  </div>
                )}
                <div className={`text-[10px] font-bold tracking-[0.14em] uppercase mb-3 ${plan.popular ? "text-[#666]" : "text-[#888]"}`}>
                  {plan.tier}
                </div>
                <div className="text-4xl font-black text-[#1d4ed8] leading-none mb-1" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
                  {plan.price}
                </div>
                <div className={`text-xs mb-4 ${plan.popular ? "text-[#666]" : "text-[#888]"}`}>{plan.period}</div>
                <div className={`border-t mb-4 ${plan.popular ? "border-[#1E293B]" : "border-[#E4E7EE]"}`} />
                {plan.features.map((f) => (
                  <div key={f} className={`flex gap-2 items-start text-xs mb-2.5 ${plan.popular ? "text-[#aaa]" : "text-[#444]"}`}>
                    <span className="text-[#1d4ed8] font-bold shrink-0">✓</span>
                    {f}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="p-5 bg-[#0F172A] border-2 border-[#0F172A] border-t-0 text-xs text-[#666]">
            <strong className="text-[#1d4ed8]">Unit economics:</strong>{" "}
            10% recovery on ₹750 avg cart → ~₹43,000/mo recovered for a ₹50L/yr Shopify store. Growth plan ROI ={" "}
            <strong className="text-[#1d4ed8]">3.3× in Month 1.</strong>
          </div>
        </div>
      </section>

      {/* ── CLOSE / CTA ─────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#0F172A]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex gap-2 flex-wrap mb-8">
                {["DPIIT", "TIDE 2.0", "SIME IIM Bombay"].map((g) => (
                  <span key={g} className="text-[10px] font-bold tracking-widest uppercase border border-[#1d4ed8] text-[#1d4ed8] px-3 py-1">
                    {g}
                  </span>
                ))}
              </div>

              <h2
                className="text-[clamp(48px,7vw,88px)] font-black uppercase leading-[0.88] tracking-tight text-white mb-6"
                style={{ fontFamily: "'Geist Variable', sans-serif" }}
              >
                The Future
                <br />
                Is
                <br />
                <span className="text-[#1d4ed8]">Spoken.</span>
              </h2>

              <p className="text-[#888] text-base leading-relaxed max-w-md mb-10">
                Weeber gives every Indian SMB a voice workforce that recovers revenue, reduces
                no-shows, and treats compliance as product. Prove one vertical, then widen.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <a
                  href="mailto:ashutosh@weeber.ai"
                  className="inline-flex items-center h-12 px-7 bg-[#1d4ed8] text-white text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Request Demo
                </a>
                <a
                  href="mailto:ashutosh@weeber.ai?subject=Grant%20Conversation%20—%20Weeber"
                  className="inline-flex items-center h-12 px-7 border-2 border-white text-white text-xs font-bold tracking-widest uppercase hover:bg-white hover:text-[#0F172A] transition-colors"
                >
                  Discuss Grant
                </a>
              </div>

              <div className="pt-6 border-t border-[#1E293B] flex flex-wrap gap-6 items-center text-sm">
                <span className="text-white font-semibold">Ashutosh Tiwari · Founder & CEO</span>
                <a href="mailto:ashutosh@weeber.ai" className="text-[#1d4ed8] hover:underline">
                  ashutosh@weeber.ai
                </a>
              </div>
            </div>

            <div className="space-y-0 divide-y divide-[#131B26]">
              {[
                { v: "1.21L+", title: "Indian Shopify stores", body: "Addressable in Year 1" },
                { v: "4.38L", title: "Health facilities in India", body: "Clinic vertical TAM" },
                { v: "80Mn+", title: "Indian SMBs", body: "Long-term addressable market" },
              ].map((stat) => (
                <div key={stat.title} className="flex gap-6 items-start py-7">
                  <div
                    className="text-4xl font-black text-[#1d4ed8] leading-none min-w-[120px]"
                    style={{ fontFamily: "'Geist Variable', sans-serif" }}
                  >
                    {stat.v}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white mb-1">{stat.title}</div>
                    <div className="text-xs text-[#666]">{stat.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STICKY FOOTER BAR ─────────────────────────── */}
      <div className="bg-[#0A0A0A] border-t border-[#161B27] py-3 px-6 flex flex-wrap items-center justify-between gap-4 text-[10px] font-semibold tracking-[0.08em] uppercase text-[#555]">
        <a href="mailto:ashutosh@weeber.ai" className="text-[#1d4ed8] hover:underline">
          ashutosh@weeber.ai
        </a>
        <span>weeber.ai</span>
        <span>June 2026 · Pre-Revenue · Confidential</span>
        <Link to="/" className="text-[#444] hover:text-[#1d4ed8] transition-colors">
          Back to weeber.ai
        </Link>
      </div>
    </div>
  );
}
