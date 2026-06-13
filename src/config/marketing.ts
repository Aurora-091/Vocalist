export const SITE = {
  name: "Weeber",
  tagline: "Voice AI for SMBs",
  description:
    "Weeber answers inbound calls, recovers abandoned carts, books appointments, and routes to humans — without breaking consent regulations.",
};

export const NAV_LINKS = [] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "TCPA Compliance", href: "/terms#tcpa" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Twitter / X", href: "https://x.com/weeber_ai" },
      { label: "LinkedIn", href: "https://linkedin.com/company/weeber-ai" },
    ],
  },
] as const;

export const TRACTION_STATS = [
  { value: "2.4M", label: "Calls handled" },
  { value: "340+", label: "Active businesses" },
  { value: "99.7%", label: "Uptime SLA" },
  { value: "<2s", label: "Avg. pickup time" },
] as const;

export const TEAM = [
  { name: "Marcus Chen", role: "CEO & Co-founder", bio: "Ex-Twilio. Built voice infra at scale." },
  { name: "Sarah Okafor", role: "CTO & Co-founder", bio: "ML engineer. Previously at Deepgram." },
  { name: "James Whitfield", role: "Head of Compliance", bio: "Former TCPA counsel at FCC." },
  { name: "Priya Sharma", role: "VP Engineering", bio: "Distributed systems. Ex-Stripe." },
] as const;

export const VALUES = [
  {
    title: "Compliance is not optional",
    body: "Every feature ships with consent checks. We never sacrifice regulatory safety for speed.",
  },
  {
    title: "Small business first",
    body: "We build for the clinic with 3 staff, the Shopify store with 200 orders/month. Enterprise comes later.",
  },
  {
    title: "Transparent by default",
    body: "Every call is transcribed. Every cost is itemized. Every decision is auditable.",
  },
  {
    title: "Humans in the loop",
    body: "AI handles volume. Humans handle nuance. We make the handoff seamless.",
  },
] as const;

export const INVESTORS_STATS = [
  { value: "$4.2M", label: "ARR" },
  { value: "18%", label: "MoM growth" },
  { value: "92%", label: "Gross margin" },
  { value: "< 3%", label: "Monthly churn" },
] as const;

export const CALL_TRANSCRIPT = [
  { speaker: "agent", text: "Good afternoon, this is Weeber calling on behalf of Bloom Dental. Am I speaking with Sarah?" },
  { speaker: "customer", text: "Yes, this is Sarah." },
  { speaker: "agent", text: "Hi Sarah. I'm reaching out because you have an upcoming cleaning appointment on Thursday at 2pm. I wanted to confirm you're still able to make it." },
  { speaker: "customer", text: "Oh right, Thursday. Actually, can I move it to Friday morning?" },
  { speaker: "agent", text: "Absolutely. I have openings at 9am and 10:30am on Friday. Which works better for you?" },
  { speaker: "customer", text: "9am is perfect." },
  { speaker: "agent", text: "Done. I've rescheduled you for Friday at 9am. You'll get a text confirmation in a moment. Is there anything else I can help with?" },
  { speaker: "customer", text: "No, that's it. Thank you." },
  { speaker: "agent", text: "You're welcome, Sarah. Have a great day." },
] as const;

export const USE_CASES = [
  {
    vertical: "Dental & Medical Clinics",
    headline: "Never miss an appointment booking again.",
    body: "Weeber answers inbound calls 24/7, books appointments directly into your calendar, and sends confirmations — without a receptionist tied to the phone. After-hours calls handled. No voicemails left unanswered.",
    stat: "62% of missed calls happen outside business hours.",
  },
  {
    vertical: "Shopify Stores",
    headline: "Recover abandoned orders automatically.",
    body: "When a cart goes cold, Weeber calls the customer, answers product questions, and closes the sale. Consent-verified before every dial, with a full transcript of every conversation in your dashboard.",
    stat: "Merchants recover 18–24% of abandoned carts on average.",
  },
  {
    vertical: "Local Service Businesses",
    headline: "Handle call volume without adding headcount.",
    body: "Plumbers, salons, repair shops — Weeber qualifies inbound leads, schedules jobs, and routes urgent calls to your team. Your staff focuses on the work, not the ringing phone.",
    stat: "Average 3.2 hours saved per day per business.",
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Consent is verified first.",
    body: "Every number is checked against your consent records before Weeber can dial it. If consent isn't on file, the call does not happen. You cannot accidentally break the law.",
  },
  {
    step: "02",
    title: "Your agent handles the call.",
    body: "A natural-sounding voice agent follows your exact business rules — booking appointments, answering questions, recovering orders, or routing to a human when nuance is needed.",
  },
  {
    step: "03",
    title: "Every outcome is logged.",
    body: "Full transcripts, recordings, and outcome tags appear in your dashboard the moment a call ends. Every decision is auditable. Nothing falls through the cracks.",
  },
] as const;

export const WAITLIST_BENEFITS = [
  {
    index: "01",
    title: "Founder pricing, locked forever.",
    body: "Early waitlist members get our lowest pricing tier permanently. No increases when we raise prices for new customers.",
  },
  {
    index: "02",
    title: "Priority onboarding.",
    body: "Skip the queue. Get a 1-on-1 setup call with our team to configure your first agent in 15 minutes.",
  },
  {
    index: "03",
    title: "Shape what we build.",
    body: "Early users get a direct line to our product team. Your use case drives what ships next.",
  },
] as const;
