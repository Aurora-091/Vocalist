export const SITE = {
  name: "Weeber",
  tagline: "Voice AI for SMBs",
  description:
    "Weeber answers inbound calls, recovers abandoned carts, books appointments, and routes to humans — without breaking consent regulations.",
};

export const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [];

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
      { label: "Twitter / X", href: "https://x.com/weeberai" },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/weeberai" },
      { label: "Instagram", href: "https://www.instagram.com/weeberai" },
    ],
  },
] as const;

export const TEAM = [
  { name: "Ashutosh Tiwari", role: "Founder", bio: "Built and scaled AdloomX. Performance marketing to voice AI." },
  { name: "Rushikesh Pawar", role: "Co-founder", bio: "AI/ML engineer. Building the voice and compliance infrastructure." },
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
  {
    vertical: "Dental & Medical Clinics",
    headline: "Never miss an appointment booking again.",
    body: "Weeber answers inbound calls 24/7, books appointments directly into your calendar, and sends confirmations — without a receptionist tied to the phone. After-hours calls handled. No voicemails left unanswered.",
    stat: "62% of missed calls happen outside business hours.",
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

export const STATS = [
  { value: "62%", label: "of calls to small businesses go unanswered" },
  { value: "85%", label: "of those callers never ring back — they call a competitor" },
  { value: "~70%", label: "of online carts are abandoned before checkout" },
  { value: "21×", label: "more likely to win a lead if you reply within 5 minutes" },
] as const;

export const VERTICALS = [
  {
    label: "Local & service",
    headline: "Clinics, plumbers, salons & repair shops",
    problem: "You're with a customer or closed for the night, so the phone rings out. Six of ten callers never reach you — and book the next name on Google.",
    solution: "Weeber picks up every call on the first ring, qualifies the job, books into your calendar, and texts the confirmation.",
    demoLabel: "Appointment booking",
    demoAccent: "English · warm",
    demoDuration: "0:22",
    cta: { label: "Join the waitlist", href: "/#waitlist" },
  },
  {
    label: "D2C & e-commerce",
    headline: "Shopify, WordPress & custom stores",
    problem: "Seven of ten carts get abandoned and ad leads go cold in minutes. Every step — order, shipping, delivery, review — leaks revenue.",
    solution: "Weeber calls at every step automatically, then follows up on WhatsApp if the call's missed. Built by clicking, not coding.",
    demoLabel: "Shopify cart recovery",
    demoAccent: "English · friendly",
    demoDuration: "0:25",
    cta: { label: "Join the waitlist", href: "/#waitlist" },
  },
  {
    label: "Enterprise",
    headline: "High-volume & regulated teams",
    problem: "Thousands of calls across locations and queues, legacy systems that don't talk, and compliance you can't bend on.",
    solution: "A voice agent built to your scripts, systems and security bar — custom integrations, audit logs, SLAs. Our engineers, not a help doc.",
    demoLabel: "Support triage",
    demoAccent: "English · neutral",
    demoDuration: "0:21",
    cta: { label: "Talk to our team", href: "mailto:hello@weeber.ai" },
  },
] as const;

export const VOICES = [] as const;

export const PLATFORM_FEATURES = [
  {
    title: "No-code agent builder",
    body: "Configure voice, tone, and business rules — no engineers needed.",
  },
  {
    title: "Voices powered by ElevenLabs",
    body: "Natural-sounding AI voices in multiple languages, tuned to your brand.",
  },
  {
    title: "Every call in one dashboard",
    body: "Recorded and transcribed, with full audit trail.",
  },
  {
    title: "Shopify + WhatsApp sync",
    body: "Orders, carts, and messages stay connected automatically.",
  },
] as const;

export const READY_FLOWS = [
  "Abandoned cart recovery",
  "Appointment booking",
  "Order & shipping updates",
  "Review & feedback calls",
] as const;

export const UPCOMING_VERTICALS = [
  {
    title: "Hotels & hospitality",
    body: "Booking confirmations, pre-arrival concierge, and review calls.",
  },
  {
    title: "Hospitals & healthcare",
    body: "Appointment reminders, no-show recovery, and follow-ups at scale.",
  },
  {
    title: "Real estate",
    body: "Instant lead callbacks, viewings, and status updates.",
  },
  {
    title: "Logistics & delivery",
    body: "Delivery windows, failed-attempt rescheduling, and confirmations.",
  },
] as const;

export const SECURITY_FEATURES = [
  {
    title: "End-to-end encrypted",
    body: "Every call and record, in transit and at rest.",
  },
  {
    title: "Used only for your flows",
    body: "Never sold, never shared, never used to train anyone else's models.",
  },
  {
    title: "You control access",
    body: "Role-based permissions and full audit logs on every action.",
  },
] as const;

export const FAQ = [
  {
    q: "Will it actually sound human?",
    a: "Yes — natural voices powered by ElevenLabs with real back-and-forth, not a phone-tree robot. Most callers don't realize it's AI.",
  },
  {
    q: "Do I need a developer?",
    a: "No. You configure your agent with simple rules and prompts. Most setups take under an hour.",
  },
  {
    q: "Which platforms does it work with?",
    a: "Launching with Shopify and WhatsApp. WordPress, WooCommerce, and more connectors follow based on waitlist demand.",
  },
  {
    q: "What will it cost?",
    a: "The first waitlist customers lock in founder pricing for life. Full pricing is set at launch.",
  },
  {
    q: "Is my customers' data safe?",
    a: "Encrypted end to end, used only to run the flows you build, never sold or shared.",
  },
  {
    q: "When does the beta open?",
    a: "We're onboarding in small batches soon. Join the list and we'll reach out by industry.",
  },
] as const;

export const DEMOS = [
  {
    id: "cod-confirmation",
    title: "COD Confirmation",
    subtitle: "Shopify order verification in Hindi + English",
    agentName: "Amit",
    orbColor: "#E8A84C",
    audioSrc: "/audio/webber-cod-converstaion_FWQnrw94.mp3",
    transcript: [
      { pct: 3, speaker: "agent" as const, text: "Hello, my name is Amit, and I'm calling from Weeber Retail Store. Can I have two minutes of your time?" },
      { pct: 15, speaker: "customer" as const, text: "Yes." },
      { pct: 20, speaker: "agent" as const, text: "Before we begin, would you like to continue this conversation in Hindi or English?" },
      { pct: 30, speaker: "customer" as const, text: "Hindi please." },
      { pct: 36, speaker: "agent" as const, text: "जी, call आपके Cash on Delivery order को confirm करने के लिए है, जो आपने हाल ही में place करी थी. इसमें एक winter cap है और आपको delivery के time ₹550 का payment करना होगा। तो just to check, क्या आप ये delivery confirm करना चाहते हैं?" },
      { pct: 68, speaker: "customer" as const, text: "हां confirm करो।" },
      { pct: 75, speaker: "agent" as const, text: "Alright, मैंने आपका order confirm कर दिया है, जो की 7–10 दिनों में deliver हो जाएगी। Weeber Retail Store के customer बनने के लिए thanks. अगर कोई और help चाहिए तो please contact जरूर करें। आपका दिन शुभ हो।" },
    ],
  },
  {
    id: "appointment-booking",
    title: "Appointment Booking",
    subtitle: "Dental clinic rescheduling in English",
    agentName: "Sarah",
    orbColor: "#00C9A7",
    audioSrc: "/audio/webber-cod-converstaion_FWQnrw94.mp3",
    transcript: [
      { pct: 3, speaker: "agent" as const, text: "Good afternoon, this is Weeber calling on behalf of Bloom Dental. Am I speaking with Sarah?" },
      { pct: 12, speaker: "customer" as const, text: "Yes, this is Sarah." },
      { pct: 18, speaker: "agent" as const, text: "Hi Sarah. I'm reaching out because you have an upcoming cleaning appointment on Thursday at 2pm. I wanted to confirm you're still able to make it." },
      { pct: 35, speaker: "customer" as const, text: "Oh right, Thursday. Actually, can I move it to Friday morning?" },
      { pct: 48, speaker: "agent" as const, text: "Absolutely. I have openings at 9am and 10:30am on Friday. Which works better for you?" },
      { pct: 60, speaker: "customer" as const, text: "9am is perfect." },
      { pct: 70, speaker: "agent" as const, text: "Done. I've rescheduled you for Friday at 9am. You'll get a text confirmation in a moment. Is there anything else I can help with?" },
      { pct: 85, speaker: "customer" as const, text: "No, that's it. Thank you." },
      { pct: 92, speaker: "agent" as const, text: "You're welcome, Sarah. Have a great day." },
    ],
  },
  {
    id: "cart-recovery",
    title: "Cart Recovery",
    subtitle: "Abandoned checkout follow-up call",
    agentName: "Priya",
    orbColor: "#FF6B6B",
    audioSrc: "/audio/webber-cod-converstaion_FWQnrw94.mp3",
    transcript: [
      { pct: 3, speaker: "agent" as const, text: "Hi, this is Priya calling from StyleHouse. I noticed you left some items in your cart earlier — a cotton kurta set and matching dupatta. Just wanted to check if you had any questions." },
      { pct: 20, speaker: "customer" as const, text: "Oh yeah, I was looking at those. I wasn't sure about the sizing." },
      { pct: 30, speaker: "agent" as const, text: "Totally understand! The cotton kurta runs true to size — if you normally wear a Medium, that would work perfectly. We also offer free exchanges within 7 days if it doesn't fit." },
      { pct: 50, speaker: "customer" as const, text: "That's helpful. And what about delivery time?" },
      { pct: 60, speaker: "agent" as const, text: "Standard delivery is 3–5 business days. I can also apply a 10% discount on your cart since you're a first-time buyer — that brings it down to ₹1,890." },
      { pct: 75, speaker: "customer" as const, text: "Oh nice, yeah go ahead and place it. Medium size." },
      { pct: 85, speaker: "agent" as const, text: "Done! Your order is confirmed — ₹1,890 COD, Medium size. You'll receive an SMS confirmation shortly. Thank you for shopping with StyleHouse!" },
    ],
  },
] as const;
