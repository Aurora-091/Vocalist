import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  ShieldCheck,
  Bot,
  Megaphone,
  ArrowRight,
  Menu,
  X,
  CircleCheck as CheckCircle,
  Mail,
  MapPin,
  ChevronRight,
  ChartBar as BarChart3,
  Globe,
} from "lucide-react";
import { MarketingFooter } from "../components/marketing/MarketingFooter";

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Metrics", href: "#metrics" },
  { label: "Team", href: "#team" },
  { label: "Updates", href: "#news" },
  { label: "Investors", href: "/funding" },
  { label: "About", href: "/about" },
  { label: "Demo", href: "/demo" },
] as const;

const METRICS = [
  { value: "₹2Cr", label: "CEO's ARR", sub: "AdloomX business" },
  { value: "15+", label: "SMBs Queued", sub: "Pre-revenue pipeline" },
  { value: "34.8%", label: "Market CAGR", sub: "Voice AI through 2034" },
  { value: "₹20L", label: "Grant Target", sub: "DPIIT / TIDE 2.0" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "Shopify Recovery Agent",
    body: "Outbound cart recovery + inbound order support. Native order lookup, cancellation, and discount-code application — directly in Shopify.",
    tag: "Ecommerce",
  },
  {
    icon: Phone,
    title: "Clinic Booking Agent",
    body: "Inbound booking, reminders, rescheduling, and no-show follow-up. BAA-ready and DPDP-compliant data handling.",
    tag: "Healthcare",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Layer",
    body: "Consent ledger, opt-out propagation, inbound admission gates. TCPA + DPDP + GDPR shipped as product — not your problem.",
    tag: "Built-in",
  },
  {
    icon: Megaphone,
    title: "Outbound Campaigns",
    body: "Upload a CSV or sync from Shopify. The dialer handles concurrency, retries, voicemail detection, and live progress monitoring.",
    tag: "Campaigns",
  },
  {
    icon: BarChart3,
    title: "Analytics & Outcomes",
    body: "Every call logged with transcript, cost breakdown, and outcome classification. Watch recoveries and opt-out rates live.",
    tag: "Insights",
  },
  {
    icon: Globe,
    title: "India-First Pricing",
    body: "₹4,999/mo Starter, ₹12,999/mo Growth. DPDP-ready, ₹-denominated, designed for the Indian SMB market from day one.",
    tag: "Pricing",
  },
];

const STEPS = [
  { n: "01", title: "Trigger", body: "Cart abandoned, order placed, or appointment due. Native Shopify + clinic events fire your agent automatically." },
  { n: "02", title: "Call", body: "Weeber places or answers the call — human-parity voice, consent gate checked before every single dial." },
  { n: "03", title: "Action", body: "Applies discount, looks up order, books or reschedules — directly in the merchant system. No human needed." },
  { n: "04", title: "Outcome", body: "Recovered revenue logged, no-show prevented, consent and result written to the compliance ledger." },
];

const TEAM = [
  {
    initials: "AT",
    name: "Ashutosh Tiwari",
    role: "Founder & CEO",
    bio: "Founded AdloomX — Google Ad Grants & Helium10 partner at ~₹2 Cr ARR. Hands-on SMB GTM. Focused on automation, voice, and signal products.",
  },
  {
    initials: "RP",
    name: "Rushikesh Pawar",
    role: "Co-Founder & CTO",
    bio: "AI product engineer — React, Python, Supabase, LangChain, Groq. Built Weeber's working agent pipeline from scratch.",
  },
  {
    initials: "AS",
    name: "Amit Singh",
    role: "Advisor",
    bio: "Ex-Oracle Software Developer · SD Team Lead, Express Scripts. Strategic guidance on enterprise engineering.",
  },
];

const NEWS = [
  {
    tag: "Traction",
    date: "June 2026",
    title: "Kyonara.com joins as first Shopify design partner",
    body: "Indian D2C jewellery brand on Shopify — active pilot, recovering carts with Weeber's outbound voice agent.",
  },
  {
    tag: "Product",
    date: "June 2026",
    title: "15+ SMBs signed to waitlist before paid launch",
    body: "Organic demand queue forming before any paid acquisition. 20 structured pilots now planned for Q3 2026.",
  },
  {
    tag: "Compliance",
    date: "May 2026",
    title: "DPDP + TCPA compliance audit underway",
    body: "Weeber is preparing India's first DPDP-compliant outbound voice product, targeting full clearance by August 2026.",
  },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(href: string) {
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
      setMobileOpen(false);
    }
  }

  return (
    <div className="marketing min-h-full bg-[#F8F9FB]">
      {/* ── STICKY NAV ─────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
          scrolled ? "bg-[#F8F9FB] border-b border-[#E2E8F0]" : "bg-transparent"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight text-lg text-[#0F172A]">
            Weeber
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) =>
              item.href.startsWith("#") ? (
                <button
                  key={item.label}
                  onClick={() => scrollTo(item.href)}
                  className="text-sm text-[#475569] hover:text-[#0F172A] transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className="text-sm text-[#475569] hover:text-[#0F172A] transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-sm text-[#475569] hover:text-[#0F172A] transition-colors">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center h-9 px-5 bg-[#0F172A] text-white text-sm font-medium rounded-md hover:bg-[#1E293B] transition-colors"
            >
              Get Early Access
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#0F172A]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-[#F8F9FB] border-b border-[#E2E8F0] px-6 pb-6">
            <nav className="flex flex-col gap-4 mb-6 pt-4">
              {NAV_ITEMS.map((item) =>
                item.href.startsWith("#") ? (
                  <button
                    key={item.label}
                    onClick={() => scrollTo(item.href)}
                    className="text-left text-sm text-[#475569] hover:text-[#0F172A]"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm text-[#475569] hover:text-[#0F172A]"
                  >
                    {item.label}
                  </Link>
                )
              )}
            </nav>
            <div className="flex flex-col gap-3">
              <Link to="/login" className="text-sm text-[#475569]">Sign in</Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-10 px-5 bg-[#0F172A] text-white text-sm font-medium rounded-md"
              >
                Get Early Access
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Grant Pitch · DPIIT · TIDE 2.0 · SIME IIM Bombay
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[0.95] tracking-tight text-[#0F172A] max-w-3xl mb-6">
            Voice workforce
            <br />
            <span className="text-[#64748B]">every Indian SMB can finally afford.</span>
          </h1>
          <p className="text-lg text-[#475569] max-w-2xl leading-relaxed mb-10">
            Vertical voice agents that recover revenue and cut no-shows — compliance built in.
            Designed from day one for the Indian SMB market.
          </p>

          <div className="border-t border-[#E2E8F0] bg-[#F1F5F9] grid grid-cols-3 divide-x divide-[#E2E8F0] mb-10">
            {METRICS.slice(0, 3).map((m) => (
              <div key={m.label} className="px-6 py-5">
                <div className="font-mono text-2xl md:text-3xl font-bold text-[#0F172A]">{m.value}</div>
                <div className="mt-1 text-xs text-[#64748B] tracking-wide uppercase">{m.label}</div>
                <div className="text-xs text-[#888] mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center h-12 px-6 bg-[#0F172A] text-white text-sm font-medium rounded-none hover:bg-[#1E293B] transition-colors"
            >
              Request Demo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <button
              onClick={() => scrollTo("#metrics")}
              className="inline-flex items-center h-12 px-6 border border-[#D9D5CE] text-[#475569] text-sm font-medium rounded-none hover:border-[#0F172A] hover:text-[#0F172A] transition-colors"
            >
              View Investor Metrics
            </button>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section className="bg-[#111]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            How It Works
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Four steps.{" "}
            <span className="text-[#999]">Zero setup.</span>
          </h2>
          <p className="text-[#666] text-sm mb-12 max-w-lg">
            A real event triggers a real call — and ends in a recovered sale or a confirmed booking.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#222]">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-[#111] p-8 hover:bg-[#161B27] transition-colors">
                <div className="font-mono text-2xl font-bold text-[#444] mb-5">{s.n}</div>
                <div className="text-sm font-semibold text-white mb-3">{s.title}</div>
                <div className="text-sm text-[#888] leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE ───────────────────────────────── */}
      <section id="product" className="border-t border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Product
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-end mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A]">
              The complete voice workforce
              <br />
              <span className="text-[#64748B]">for Indian SMBs.</span>
            </h2>
            <p className="text-base text-[#475569] leading-relaxed">
              Compliance-aware vertical agents that place and answer phone calls — recovering
              lost revenue and reducing operational leakage. No setup. Outcomes in Week 1.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white border border-[#D9D5CE] p-6 hover:bg-[#F0EDE4] transition-colors rounded-none"
                >
                  <div className="w-9 h-9 bg-[#F1F5F9] flex items-center justify-center mb-4">
                    <Icon className="w-4 h-4 text-[#0F172A]" />
                  </div>
                  <div className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[#888] mb-2">
                    {f.tag}
                  </div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#475569] leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-[#E2E8F0] pt-5 flex flex-wrap gap-6">
            {["Recovered revenue", "Fewer no-shows", "Compliance as moat"].map((v) => (
              <div key={v} className="flex items-center gap-2 text-sm text-[#475569]">
                <CheckCircle className="w-4 h-4 text-[#16a34a] shrink-0" />
                {v}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINANCIAL METRICS / INVESTOR HIGHLIGHTS ────────── */}
      <section id="metrics" className="bg-[#111]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
            Investor Highlights
          </div>
          <div className="grid lg:grid-cols-2 gap-16 items-start mb-14">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Market{" "}
              <span className="text-[#999]">opportunity</span>
            </h2>
            <p className="text-[#888] text-base leading-relaxed pt-2">
              Voice AI is the fastest-growing enterprise software category. India's 80M+ SMBs
              represent the biggest underserved market — with no compliant, vertical-native
              solution until Weeber.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#222] border border-[#222] mb-8">
            {METRICS.map((m) => (
              <div key={m.label} className="p-6">
                <div className="font-mono text-2xl md:text-3xl font-bold text-white">{m.value}</div>
                <div className="text-xs font-medium text-[#888] mt-1">{m.label}</div>
                <div className="text-xs text-[#555] mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[#222] mb-6">
            {[
              { v: "$47.5B", title: "Voice AI market by 2034", body: "34.8% CAGR — vertical agents are the breakout category" },
              { v: "₹2.2L Cr", title: "Lost to cart abandonment", body: "70.2% avg abandonment. A ₹1Cr store leaks ~₹4.8L/year" },
              { v: "₹1.3L Cr", title: "Missed appointment losses", body: "5–30% no-show rates across India's 4.38L health facilities" },
            ].map((stat) => (
              <div key={stat.title} className="bg-[#111] p-8">
                <div className="font-mono text-3xl font-bold text-white mb-3">{stat.v}</div>
                <div className="text-sm font-semibold text-[#ccc] mb-1">{stat.title}</div>
                <div className="text-xs text-[#666] leading-relaxed">{stat.body}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <p className="text-xs text-[#555] max-w-lg">
              Unit economics: 10% recovery on ₹750 avg cart → ~₹43,000/mo recovered for a ₹50L/yr
              Shopify store. Growth plan ROI = <strong className="text-white">3.3× in Month 1.</strong>
            </p>
            <Link
              to="/funding"
              className="inline-flex items-center gap-2 text-sm text-white border border-[#333] px-4 py-2 hover:border-white transition-colors whitespace-nowrap"
            >
              Full Investor Deck
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TEAM ───────────────────────────────────────────── */}
      <section id="team" className="border-t border-[#E2E8F0] bg-[#F0EDE4]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">Team</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A] mb-12">
            The people behind Weeber
          </h2>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {TEAM.map((member) => (
              <div key={member.name} className="bg-[#FAFAF8] border border-[#D9D5CE] p-6 rounded-none">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-11 h-11 bg-[#E8ECF1] flex items-center justify-center text-[#0F172A] font-bold text-sm shrink-0">
                    {member.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#0F172A]">{member.name}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">{member.role}</div>
                  </div>
                </div>
                <p className="text-sm text-[#475569] leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#D9D5CE] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#0F172A] mb-1">Traction so far</div>
              <div className="text-xs text-[#64748B]">
                Live product · Kyonara.com pilot · 15+ SMBs in queue · 20 structured pilots planned
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {["DPIIT", "TIDE 2.0", "SIME IIM Bombay"].map((g) => (
                <span
                  key={g}
                  className="text-[10px] font-medium tracking-widest uppercase border border-[#D9D5CE] text-[#475569] px-2.5 py-1"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── NEWS / UPDATES ─────────────────────────────────── */}
      <section id="news" className="border-t border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="text-xs font-medium tracking-widest uppercase text-[#64748B] mb-4">
            Latest Updates
          </div>
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F172A]">
              What's happening
            </h2>
            <Link
              to="/demo"
              className="text-sm text-[#475569] hover:text-[#0F172A] flex items-center gap-1 transition-colors"
            >
              See the demo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {NEWS.map((item) => (
              <div
                key={item.title}
                className="bg-white border border-[#D9D5CE] p-6 hover:bg-[#F0EDE4] transition-colors rounded-none"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-semibold tracking-[0.12em] uppercase bg-[#0F172A] text-white px-2.5 py-1">
                    {item.tag}
                  </span>
                  <span className="text-xs text-[#888]">{item.date}</span>
                </div>
                <h3 className="font-semibold text-sm text-[#0F172A] mb-2 leading-snug">{item.title}</h3>
                <p className="text-sm text-[#475569] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT / CTA ──────────────────────────────────── */}
      <section id="contact" className="bg-[#111] text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-4">
                Get in touch
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
                The future{" "}
                <span className="text-[#999]">is spoken.</span>
              </h2>
              <p className="text-[#888] text-base leading-relaxed mb-10 max-w-md">
                Weeber gives every Indian SMB a voice workforce that recovers revenue, reduces
                no-shows, and treats compliance as product. One vertical at a time.
              </p>

              <div className="space-y-3 mb-10">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#888] shrink-0" />
                  <a href="mailto:ashutosh@weeber.ai" className="text-sm text-white hover:text-[#ccc] transition-colors">
                    ashutosh@weeber.ai
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-[#888] shrink-0" />
                  <span className="text-sm text-[#888]">weeber.ai</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#888] shrink-0" />
                  <span className="text-sm text-[#888]">India</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
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
            </div>

            <div className="border border-[#222] p-8">
              <div className="text-xs font-medium tracking-widest uppercase text-[#888] mb-6">
                Send a message
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  window.location.href = "mailto:ashutosh@weeber.ai";
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium tracking-widest uppercase text-[#888] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-10 px-3 bg-[#161B27] border border-[#222] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#555] transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-widest uppercase text-[#888] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full h-10 px-3 bg-[#161B27] border border-[#222] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#555] transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-widest uppercase text-[#888] mb-2">
                    I'm a
                  </label>
                  <select className="w-full h-10 px-3 bg-[#161B27] border border-[#222] text-white text-sm focus:outline-none focus:border-[#555] transition-colors">
                    <option value="smb">SMB owner</option>
                    <option value="investor">Investor / Grant body</option>
                    <option value="partner">Integration partner</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-widest uppercase text-[#888] mb-2">
                    Message
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2.5 bg-[#161B27] border border-[#222] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#555] transition-colors resize-none"
                    placeholder="What would you like to discuss?"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 bg-white text-[#111] text-sm font-medium hover:bg-[#f0f0f0] transition-colors"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
