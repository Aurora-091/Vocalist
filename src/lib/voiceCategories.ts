import {
  Headset,
  TrendingUp,
  CalendarCheck,
  ConciergeBell,
  ShieldAlert,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

export type UseCaseId =
  | "customer_support"
  | "sales"
  | "appointment_booking"
  | "receptionist"
  | "collections"
  | "conversational";

export type UseCaseDef = {
  id: UseCaseId;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind tint classes for avatars / accents (soft, category-coded). */
  tint: { bg: string; text: string; ring: string };
};

/**
 * Customer-facing business use cases. Order matters: it drives section order
 * and the "primary" use case shown on a card (first match wins).
 */
export const USE_CASES: UseCaseDef[] = [
  {
    id: "customer_support",
    label: "Customer Support",
    blurb: "Warm, clear voices that resolve issues and keep callers calm.",
    icon: Headset,
    tint: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" },
  },
  {
    id: "sales",
    label: "Sales & Outreach",
    blurb: "Confident, energetic voices that pitch and close.",
    icon: TrendingUp,
    tint: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30" },
  },
  {
    id: "appointment_booking",
    label: "Appointment Booking",
    blurb: "Friendly, organized voices that schedule and confirm.",
    icon: CalendarCheck,
    tint: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  },
  {
    id: "receptionist",
    label: "Receptionist",
    blurb: "Polished, professional voices that greet and route callers.",
    icon: ConciergeBell,
    tint: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", ring: "ring-teal-500/30" },
  },
  {
    id: "collections",
    label: "Collections & Recovery",
    blurb: "Firm, steady voices for reminders and recovery calls.",
    icon: ShieldAlert,
    tint: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30" },
  },
  {
    id: "conversational",
    label: "Conversational",
    blurb: "Natural, all-purpose voices for everyday conversations.",
    icon: MessageCircle,
    tint: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-500/30" },
  },
];

export const USE_CASE_MAP: Record<UseCaseId, UseCaseDef> = USE_CASES.reduce(
  (acc, u) => {
    acc[u.id] = u;
    return acc;
  },
  {} as Record<UseCaseId, UseCaseDef>,
);

type VoiceLike = {
  category?: string | null;
  description?: string | null;
  tags?: string[] | null;
  gender?: string | null;
  accent?: string | null;
  use_cases?: string[] | null;
};

const KEYWORDS: Record<Exclude<UseCaseId, "conversational">, string[]> = {
  customer_support: [
    "support",
    "service",
    "help",
    "warm",
    "empathetic",
    "calm",
    "reassuring",
    "patient",
    "friendly",
    "soothing",
  ],
  sales: [
    "sales",
    "sell",
    "persuasive",
    "energetic",
    "upbeat",
    "confident",
    "enthusiastic",
    "advertis",
    "promo",
    "outreach",
    "dynamic",
    "motivat",
  ],
  appointment_booking: [
    "appointment",
    "booking",
    "schedule",
    "reminder",
    "clear",
    "organiz",
    "concise",
    "efficient",
    "informative",
  ],
  receptionist: [
    "reception",
    "professional",
    "polished",
    "corporate",
    "front desk",
    "greet",
    "neutral",
    "articulate",
    "formal",
  ],
  collections: [
    "collection",
    "recovery",
    "firm",
    "assertive",
    "serious",
    "authoritative",
    "deep",
    "stern",
    "mature",
    "commanding",
  ],
};

/**
 * Derive business use cases for a voice. Prefers an explicit `use_cases`
 * array (set by the ElevenLabs sync); otherwise infers from the voice's
 * tags, description, category, gender and accent so grouping works on
 * existing data without a backfill.
 */
export function deriveUseCases(voice: VoiceLike): UseCaseId[] {
  const explicit = (voice.use_cases || []).filter((u): u is UseCaseId =>
    USE_CASES.some((c) => c.id === u),
  );
  if (explicit.length > 0) return explicit;

  const haystack = [
    voice.category || "",
    voice.description || "",
    voice.accent || "",
    ...(voice.tags || []),
  ]
    .join(" ")
    .toLowerCase();

  const matches: UseCaseId[] = [];
  for (const [id, words] of Object.entries(KEYWORDS) as [
    Exclude<UseCaseId, "conversational">,
    string[],
  ][]) {
    if (words.some((w) => haystack.includes(w))) matches.push(id);
  }

  // Light gender heuristic to spread voices into recovery/collections.
  if (matches.length === 0 && voice.gender === "male" && haystack.includes("deep")) {
    matches.push("collections");
  }

  // Everything is at least conversational.
  if (!matches.includes("conversational")) matches.push("conversational");
  return matches;
}

export function primaryUseCase(voice: VoiceLike): UseCaseDef {
  const ids = deriveUseCases(voice);
  // Pick the most specific (non-conversational) match first.
  const specific = ids.find((id) => id !== "conversational");
  return USE_CASE_MAP[specific ?? "conversational"];
}

export function voiceInitials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
