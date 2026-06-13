import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { MarketingNav } from "../components/marketing/MarketingNav";

const BUDGET = [
  { cat: "Infrastructure — hosting, telephony, API", amt: "₹7.0L", pct: 35, color: "#374151" },
  { cat: "Product completion — billing, inbound last mile", amt: "₹4.0L", pct: 20, color: "#5DB8A0" },
  { cat: "GTM & pilot acquisition — 20 SMBs", amt: "₹4.0L", pct: 20, color: "#64748B" },
  { cat: "Hiring — engineer + compliance consultant", amt: "₹3.0L", pct: 15, color: "#94A3B8" },
  { cat: "Legal & DPDP / TCPA compliance audit", amt: "₹1.5L", pct: 7, color: "#D68A5A" },
  { cat: "Contingency", amt: "₹0.5L", pct: 3, color: "#CBD5E1" },
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
    <div className="marketing min-h-full bg-[#F8F9FB]">
      <MarketingNav />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Grant Pitch · DPIIT · TIDE 2.0 · SIME IIM Bombay
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#0F172A] max-w-3xl mb-8">
            Voice workforce
            <br />
            <span className="text-[#64748B]">for India.</span>
          </h1>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <p className="text-lg text-[#475569] leading-relaxed max-w-xl">
              Weeber is building the AI voice workforce every Indian SMB can finally afford —
              vertical voice agents that recover revenue and cut no-shows, with compliance built in.
              We're raising <strong className="text-[#0F172A]">₹20,00,000</strong> in non-dilutive
              grant funding to go from working demo to revenue-generating, compliant product.
            </p>
            <div className="border-t border-[#E2E8F0] bg-[#F1F5F9] grid grid-cols-2 divide-x divide-y divide-[#E2E8F0]">
              {[
                { v: "₹20L", l: "Grant Ask", s: "Non-dilutive" },
                { v: "₹2Cr", l: "CEO's ARR", s: "AdloomX" },
                { v: "15+", l: "SMBs Queued", s: "Pre-revenue" },
                { v: "Live", l: "Product Status", s: "In production" },
              ].map((m) => (
                <div key={m.l} className="p-5">
                  <div className="font-mono text-2xl font-bold text-[#0F172A] leading-none mb-1">{m.v}</div>
                  <div className="text-xs font-medium text-[#475569]">{m.l}</div>
                  <div className="text-xs text-[#888] mt-0.5">{m.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────── */}
      <section className="border-t border-[#E2E8F0] bg-[#F0EDE4] px-6 pb-24 pt-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            01 / The Problem
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-4">
            The problem
            <br />
            <span className="text-[#64748B]">Indian SMBs bleed revenue every day.</span>
          </h2>
          <p className="text-base text-[#475569] max-w-xl mb-12">
            And cannot afford to stop the leak.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#D9D5CE] p-8 rounded-none">
              <div className="font-mono text-4xl font-bold text-[#0F172A] leading-none mb-3">₹2.2L Cr</div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">Lost to cart abandonment</div>
              <div className="text-sm text-[#475569] leading-relaxed">
                70.2% avg abandonment. A ₹1Cr Shopify store leaks ~₹4.8L/year — silently.
              </div>
            </div>
            <div className="bg-white border border-[#D9D5CE] p-8 rounded-none">
              <div className="font-mono text-4xl font-bold text-[#0F172A] leading-none mb-3">₹1.3L Cr</div>
              <div className="text-sm font-semibold text-[#0F172A] mb-2">Missed appointments</div>
              <div className="text-sm text-[#475569] leading-relaxed">
                5–30% no-show rates across India's 4.38 lakh health facilities. ₹2,000+ wasted per empty slot.
              </div>
            </div>
            <div className="bg-[#111] border border-[#111] p-8 rounded-none">
              <div className="font-mono text-4xl font-bold text-white leading-none mb-3">0</div>
              <div className="text-sm font-semibold text-white mb-2">Scalable solutions</div>
              <div className="text-sm text-[#888] leading-relaxed">
                Chat and email are automated. Outbound calls — the highest-intent channel — stay manual and unscalable for SMBs.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY NOW ─────────────────────────────────────── */}
      <section className="bg-[#111] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            02 / Why Now
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Three forces{" "}
            <span className="text-[#999]">converged.</span>
          </h2>
          <p className="text-sm text-[#555] mb-12">None existed 24 months ago.</p>

          <div className="grid md:grid-cols-3 gap-px bg-[#222]">
            {[
              { n: "01", title: "Human-parity voice", body: "Real-time AI voice has cleared the human ceiling at scale. The tech barrier is gone — forever." },
              { n: "02", title: "COGS dropped to ₹10–12/min", body: "Per-minute infra fell 80%+ in 24 months. SMB-priced voice is finally economically viable." },
              { n: "03", title: "Compliance is now a moat", body: "DPDP Act + TCPA consent rules make compliant voice a product feature, not legal homework — for whoever ships it first." },
            ].map((f) => (
              <div key={f.n} className="bg-[#111] p-8 hover:bg-[#161B27] transition-colors">
                <div className="font-mono text-2xl font-bold text-[#444] mb-5">{f.n}</div>
                <div className="text-sm font-semibold text-white mb-3">{f.title}</div>
                <div className="text-sm text-[#888] leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET OPPORTUNITY ──────────────────────────── */}
      <section className="border-t border-[#E2E8F0] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            03 / Market Opportunity
          </div>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12">
                Market
                <br />
                <span className="text-[#64748B]">opportunity</span>
              </h2>
              <div className="space-y-0 divide-y divide-[#E2E8F0]">
                {[
                  { v: "$47.5B", title: "Voice AI market by 2034", body: "34.8% CAGR — vertical agents are the breakout category" },
                  { v: "$260B", title: "Recoverable ecommerce revenue", body: "Annual global cart abandonment · India's share ₹2.2L Cr+" },
                  { v: "$150B", title: "Missed appointment losses", body: "US healthcare alone · India's 4.38L facilities multiply this" },
                ].map((stat) => (
                  <div key={stat.title} className="py-6 flex gap-6 items-start">
                    <div className="font-mono text-3xl font-bold text-[#0F172A] leading-none min-w-[120px]">
                      {stat.v}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A] mb-1">{stat.title}</div>
                      <div className="text-sm text-[#64748B]">{stat.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="bg-[#111] p-8 mb-4">
                <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#888] mb-1">
                  Voice AI Market — $B
                </div>
                <div className="text-xs text-[#555] mb-6">$2.4B (2024) → $47.5B (2034) · 34.8% CAGR</div>
                <svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-40">
                  <line x1="48" y1="10" x2="48" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                  <line x1="48" y1="140" x2="465" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                  <line x1="48" y1="10" x2="465" y2="10" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="4,4"/>
                  <line x1="48" y1="47" x2="465" y2="47" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="4,4"/>
                  <line x1="48" y1="84" x2="465" y2="84" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="4,4"/>
                  <text x="42" y="143" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">0</text>
                  <text x="42" y="87" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">25</text>
                  <text x="42" y="50" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">38</text>
                  <text x="42" y="14" fill="#555" fontSize="9" textAnchor="end" fontFamily="monospace">50</text>
                  <text x="70" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2024</text>
                  <text x="236" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2028</text>
                  <text x="401" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2032</text>
                  <text x="455" y="154" fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace">2034</text>
                  <path d="M70,135 C100,133 130,128 153,122 S200,108 236,95 S290,70 319,55 S380,28 401,20 L455,12 L455,140 L70,140 Z" fill="rgba(203,213,225,0.08)"/>
                  <path d="M70,135 C100,133 130,128 153,122 S200,108 236,95 S290,70 319,55 S380,28 401,20 L455,12" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="70" cy="135" r="3.5" fill="#CBD5E1"/>
                  <circle cx="236" cy="95" r="3.5" fill="#CBD5E1"/>
                  <circle cx="401" cy="20" r="3.5" fill="#CBD5E1"/>
                  <circle cx="455" cy="12" r="4.5" fill="#CBD5E1"/>
                  <text x="455" y="8" fill="#CBD5E1" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="700">$47.5B</text>
                </svg>
              </div>
              <div className="bg-[#F1F5F9] border border-[#E2E8F0] p-5 text-sm text-[#475569] leading-relaxed">
                <strong className="text-[#0F172A] block mb-1">India tailwind</strong>
                1,21,600 active Shopify stores in Q1 2026, +32% YoY — the merchant base is already here.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRACTION & TEAM ─────────────────────────────── */}
      <section className="border-t border-[#E2E8F0] bg-[#F0EDE4] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            04 / Traction
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-14">
            Traction{" "}
            <span className="text-[#64748B]">&amp; team</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-6">Traction</div>
              <div className="space-y-0 divide-y divide-[#D9D5CE]">
                {TRACTION.map((t) => (
                  <div key={t.title} className="py-5 flex gap-4">
                    <span className="text-[#0F172A] font-bold text-lg mt-0.5 shrink-0">→</span>
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A] mb-1">{t.title}</div>
                      <div className="text-sm text-[#475569] leading-relaxed">{t.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-6">Team</div>
              <div className="space-y-4">
                {TEAM.map((m) => (
                  <div key={m.name} className="bg-white border border-[#D9D5CE] p-6 rounded-none">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 bg-[#E8ECF1] flex items-center justify-center text-[#0F172A] font-bold text-sm shrink-0">
                        {m.initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#0F172A]">{m.name}</div>
                        <div className="text-xs text-[#64748B] mt-0.5">{m.role}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {m.pts.map((p) => (
                        <div key={p} className="flex gap-2 text-xs text-[#475569]">
                          <span className="text-[#64748B] shrink-0">·</span>
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
      <section className="bg-[#111] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            05 / Why We Win
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-14">
            Why we{" "}
            <span className="text-[#999]">win</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-[10px] font-medium tracking-[0.1em] uppercase text-[#555] border-b border-[#222]" />
                  <th className="py-3 px-4 text-[10px] font-medium tracking-[0.1em] uppercase text-center bg-white text-[#111] border-b border-white">
                    Weeber
                  </th>
                  {["Vapi / Retell / Bland", "PolyAI", "Ringly / Synthflow"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-medium tracking-[0.1em] uppercase text-[#555] border-b border-[#222]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPETITION.map((row) => (
                  <tr key={row.label} className="border-b border-[#1a1a1a]">
                    <td className="py-3 px-4 text-xs text-[#555]">{row.label}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-center bg-white/5">
                      <span className={row.weeber.startsWith("✓") ? "text-[#16a34a]" : row.weeber.startsWith("✗") ? "text-[#dc2626]" : "text-white"}>
                        {row.weeber}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#888]">
                      <span className={row.vapi.startsWith("✗") ? "text-[#dc2626]/70" : ""}>{row.vapi}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#888]">{row.polyai}</td>
                    <td className="py-3 px-4 text-xs text-[#888]">
                      <span className={row.ringly.startsWith("✗") ? "text-[#dc2626]/70" : ""}>{row.ringly}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-5 border border-[#222] text-sm text-[#888]">
            <strong className="text-white">Key moat:</strong>{" "}
            73% of B2B buyers prefer verticalized solutions (Deloitte). Horizontal builders are moving upmarket — the India SMB gap widens.
          </div>
        </div>
      </section>

      {/* ── GRANT ASK ───────────────────────────────────── */}
      <section className="border-t border-[#E2E8F0] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            06 / The Ask
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-14">
            The ask
          </h2>

          <div className="grid lg:grid-cols-2 gap-16 mb-16">
            <div>
              <div className="font-mono text-5xl md:text-6xl font-bold text-[#0F172A] leading-none mb-4">
                ₹20,00,000
              </div>
              <div className="text-sm font-semibold text-[#0F172A] mb-1">Non-dilutive grant · 6-month runway</div>
              <div className="text-sm text-[#64748B] mb-1">No equity. No valuation negotiation.</div>
              <div className="text-sm text-[#64748B] mb-6">Milestone-gated disbursement welcomed.</div>
              <div className="text-sm italic text-[#475569]">
                The grant closes the gap between working demo and revenue-generating, compliant product.
              </div>
            </div>

            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-5">
                Budget Breakdown
              </div>
              <div className="space-y-4">
                {BUDGET.map((b) => (
                  <div key={b.cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#475569]">{b.cat}</span>
                      <span className="text-xs font-semibold text-[#0F172A] ml-4 shrink-0">{b.amt} · {b.pct}%</span>
                    </div>
                    <div className="h-1 bg-[#E2E8F0] overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${b.pct}%`, background: b.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {DELIVERABLES.map((d) => (
              <div key={d.n} className="bg-[#111] border border-[#222] p-8 rounded-none">
                <div className="w-7 h-7 bg-white flex items-center justify-center text-[#111] font-bold text-xs mb-4">
                  {d.n}
                </div>
                <div className="text-sm font-semibold text-white mb-2">{d.title}</div>
                <div className="text-xs text-[#888] leading-relaxed">{d.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROADMAP ─────────────────────────────────────── */}
      <section className="border-t border-[#E2E8F0] bg-[#F1F5F9] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            07 / Roadmap
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-14">
            6-month roadmap
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROADMAP.map((p) => (
              <div
                key={p.phase}
                className={`p-6 border rounded-none ${
                  p.dark
                    ? "bg-[#111] border-[#222]"
                    : "bg-white border-[#D9D5CE]"
                }`}
              >
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#888] mb-2">
                  {p.period}
                </div>
                <div className={`text-base font-semibold mb-4 ${p.dark ? "text-white" : "text-[#0F172A]"}`}>
                  {p.phase}
                </div>
                <div className={`border-t mb-4 ${p.dark ? "border-[#222]" : "border-[#E2E8F0]"}`} />
                <div className="text-[9px] font-medium tracking-[0.16em] uppercase text-[#888] mb-2">Milestones</div>
                {p.milestones.map((m) => (
                  <div key={m} className={`flex gap-1.5 text-xs mb-1.5 ${p.dark ? "text-[#aaa]" : "text-[#475569]"}`}>
                    <span className={`shrink-0 ${p.dark ? "text-[#888]" : "text-[#64748B]"}`}>→</span>
                    {m}
                  </div>
                ))}
                <div className={`border-t my-3 ${p.dark ? "border-[#222]" : "border-[#E2E8F0]"}`} />
                <div className="text-[9px] font-medium tracking-[0.16em] uppercase text-[#888] mb-2">KPIs</div>
                {p.kpis.map((k) => (
                  <div key={k} className={`flex gap-1.5 text-xs mb-1.5 font-medium ${p.dark ? "text-white" : "text-[#0F172A]"}`}>
                    <span className="text-[#888] shrink-0">★</span>
                    {k}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 p-5 bg-white border border-[#D9D5CE] text-xs text-[#475569] leading-relaxed rounded-none">
            <strong className="text-[#0F172A]">Key de-risking event:</strong>{" "}
            Converting Kyonara + 5 more pilots to paying customers with documented recovered-revenue ROI — exactly what this grant funds.
          </div>
        </div>
      </section>

      {/* ── PRICING SUMMARY ──────────────────────────────── */}
      <section className="border-t border-[#E2E8F0] py-20 md:py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            08 / Revenue Model
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-14">
            Revenue model
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
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
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`p-8 relative border rounded-none ${
                  plan.popular ? "bg-[#111] border-[#222]" : "bg-white border-[#D9D5CE]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-[9px] font-medium tracking-widest uppercase px-4 py-1">
                    Most Popular
                  </div>
                )}
                <div className={`text-[10px] font-medium tracking-[0.14em] uppercase mb-3 ${plan.popular ? "text-[#666]" : "text-[#888]"}`}>
                  {plan.tier}
                </div>
                <div className={`font-mono text-4xl font-bold leading-none mb-1 ${plan.popular ? "text-white" : "text-[#0F172A]"}`}>
                  {plan.price}
                </div>
                <div className={`text-xs mb-4 ${plan.popular ? "text-[#666]" : "text-[#888]"}`}>{plan.period}</div>
                <div className={`border-t mb-4 ${plan.popular ? "border-[#222]" : "border-[#E2E8F0]"}`} />
                {plan.features.map((f) => (
                  <div key={f} className={`flex gap-2 items-start text-xs mb-2.5 ${plan.popular ? "text-[#aaa]" : "text-[#475569]"}`}>
                    <span className={`font-bold shrink-0 ${plan.popular ? "text-white" : "text-[#0F172A]"}`}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 p-5 bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#475569] leading-relaxed">
            <strong className="text-[#0F172A]">Unit economics:</strong>{" "}
            10% recovery on ₹750 avg cart → ~₹43,000/mo recovered for a ₹50L/yr Shopify store. Growth plan ROI ={" "}
            <strong className="text-[#0F172A]">3.3× in Month 1.</strong>
          </div>
        </div>
      </section>

      {/* ── CLOSE / CTA ─────────────────────────────────── */}
      <section className="bg-[#111] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex gap-2 flex-wrap mb-8">
                {["DPIIT", "TIDE 2.0", "SIME IIM Bombay"].map((g) => (
                  <span key={g} className="text-[10px] font-medium tracking-widest uppercase border border-[#333] text-[#888] px-3 py-1">
                    {g}
                  </span>
                ))}
              </div>

              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4 leading-[0.95]">
                The future
                <br />
                <span className="text-[#999]">is spoken.</span>
              </h2>

              <p className="text-[#888] text-base leading-relaxed max-w-md mb-10">
                Weeber gives every Indian SMB a voice workforce that recovers revenue, reduces
                no-shows, and treats compliance as product. Prove one vertical, then widen.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <a
                  href="mailto:ashutosh@weeber.ai"
                  className="inline-flex items-center h-12 px-6 bg-white text-[#111] text-sm font-medium rounded-none hover:bg-[#f0f0f0] transition-colors"
                >
                  Request Demo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </a>
                <a
                  href="mailto:ashutosh@weeber.ai?subject=Grant%20Conversation%20—%20Weeber"
                  className="inline-flex items-center h-12 px-6 border border-[#333] text-white text-sm font-medium rounded-none hover:border-white transition-colors"
                >
                  Discuss Grant
                </a>
              </div>

              <div className="pt-6 border-t border-[#222] flex flex-wrap gap-6 items-center text-sm">
                <span className="text-white font-semibold">Ashutosh Tiwari · Founder & CEO</span>
                <a href="mailto:ashutosh@weeber.ai" className="text-[#888] hover:text-white transition-colors">
                  ashutosh@weeber.ai
                </a>
              </div>
            </div>

            <div className="space-y-0 divide-y divide-[#1a1a1a]">
              {[
                { v: "1.21L+", title: "Indian Shopify stores", body: "Addressable in Year 1" },
                { v: "4.38L", title: "Health facilities in India", body: "Clinic vertical TAM" },
                { v: "80Mn+", title: "Indian SMBs", body: "Long-term addressable market" },
              ].map((stat) => (
                <div key={stat.title} className="flex gap-6 items-start py-7">
                  <div className="font-mono text-3xl font-bold text-white leading-none min-w-[110px]">
                    {stat.v}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">{stat.title}</div>
                    <div className="text-xs text-[#666]">{stat.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONFIDENTIAL FOOTER BAR ───────────────────── */}
      <div className="bg-[#07090E] border-t border-[#1a1a1a] py-3 px-6 flex flex-wrap items-center justify-between gap-4 text-[10px] font-medium tracking-[0.08em] uppercase text-[#444]">
        <a href="mailto:ashutosh@weeber.ai" className="text-[#888] hover:text-white transition-colors">
          ashutosh@weeber.ai
        </a>
        <span>weeber.ai</span>
        <span>June 2026 · Pre-Revenue · Confidential</span>
        <Link to="/" className="text-[#555] hover:text-white transition-colors">
          Back to weeber.ai
        </Link>
      </div>
    </div>
  );
}
