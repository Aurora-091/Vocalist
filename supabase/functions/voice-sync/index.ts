import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EL_BASE = "https://api.elevenlabs.io/v1";
const SHARED_PAGES = 3; // ~300 community voices
const PAGE_SIZE = 100;

type UseCaseId =
  | "customer_support"
  | "sales"
  | "appointment_booking"
  | "receptionist"
  | "collections"
  | "conversational";

const KEYWORDS: Record<Exclude<UseCaseId, "conversational">, string[]> = {
  customer_support: ["support", "service", "help", "warm", "empathetic", "calm", "reassuring", "patient", "friendly", "soothing"],
  sales: ["sales", "sell", "persuasive", "energetic", "upbeat", "confident", "enthusiastic", "advertis", "promo", "outreach", "dynamic", "motivat"],
  appointment_booking: ["appointment", "booking", "schedule", "reminder", "clear", "organiz", "concise", "efficient", "informative"],
  receptionist: ["reception", "professional", "polished", "corporate", "front desk", "greet", "neutral", "articulate", "formal", "news"],
  collections: ["collection", "recovery", "firm", "assertive", "serious", "authoritative", "deep", "stern", "mature", "commanding"],
};

function deriveUseCases(haystack: string, gender: string): UseCaseId[] {
  const h = haystack.toLowerCase();
  const matches: UseCaseId[] = [];
  for (const [id, words] of Object.entries(KEYWORDS) as [Exclude<UseCaseId, "conversational">, string[]][]) {
    if (words.some((w) => h.includes(w))) matches.push(id);
  }
  if (matches.length === 0 && gender === "male" && h.includes("deep")) {
    matches.push("collections");
  }
  if (!matches.includes("conversational")) matches.push("conversational");
  return matches;
}

function normGender(g?: string | null): string | null {
  if (!g) return null;
  const v = g.toLowerCase();
  if (v === "neutral" || v === "non-binary") return "nonbinary";
  if (v === "male" || v === "female") return v;
  return v;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const role = (user.app_metadata as any)?.role;
    if (role !== "admin" && role !== "owner") {
      return json({ error: "Only an admin can sync the voice library." }, 403);
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return json(
        { error: "ELEVENLABS_API_KEY is not set. Add it to your edge function secrets." },
        400,
      );
    }

    const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };

    type Row = {
      voice_id: string;
      name: string;
      gender: string | null;
      accent: string | null;
      language_codes: string[];
      category: string;
      preview_url: string | null;
      description: string | null;
      tags: string[];
      use_cases: string[];
      featured: boolean;
      cached_at: string;
      _popularity: number;
    };

    const byId = new Map<string, Row>();
    const now = new Date().toISOString();

    const normalize = (v: any, sourceCategory: string): Row | null => {
      const voiceId: string | undefined = v.voice_id;
      const name: string | undefined = v.name;
      if (!voiceId || !name) return null;

      const labels = v.labels || {};
      const descriptive = v.descriptive || labels.descriptive || "";
      const useCaseLabel = v.use_case || labels.use_case || "";
      const age = v.age || labels.age || "";
      const accent = v.accent || labels.accent || null;
      const gender = normGender(v.gender || labels.gender);

      const langCodes = new Set<string>();
      if (Array.isArray(v.verified_languages)) {
        for (const l of v.verified_languages) {
          if (l?.language) langCodes.add(String(l.language).toLowerCase());
        }
      }
      if (v.language) langCodes.add(String(v.language).toLowerCase());
      if (v.fine_tuning?.language) langCodes.add(String(v.fine_tuning.language).toLowerCase());
      if (langCodes.size === 0) langCodes.add("en");

      const tags = [descriptive, useCaseLabel, age, accent, v.category]
        .filter(Boolean)
        .map((t: string) => String(t).replace(/_/g, " "));

      const description =
        v.description ||
        [descriptive && cap(descriptive), useCaseLabel && `${cap(useCaseLabel.replace(/_/g, " "))}`, age && `${age} voice`]
          .filter(Boolean)
          .join(" · ") ||
        null;

      const haystack = [descriptive, useCaseLabel, accent, description, sourceCategory, ...tags].join(" ");

      return {
        voice_id: voiceId,
        name,
        gender,
        accent: accent ? cap(String(accent)) : null,
        language_codes: Array.from(langCodes),
        category: useCaseLabel ? String(useCaseLabel).replace(/_/g, " ") : sourceCategory,
        preview_url: v.preview_url || null,
        description,
        tags,
        use_cases: deriveUseCases(haystack, gender || ""),
        featured: false,
        cached_at: now,
        _popularity: Number(v.cloned_by_count || v.usage_character_count_1y || 0),
      };
    };

    // 1) Account voices (premade + custom) — directly usable for TTS.
    try {
      const res = await fetch(`${EL_BASE}/voices`, { headers });
      if (res.ok) {
        const data = await res.json();
        for (const v of data.voices || []) {
          const row = normalize(v, v.category || "premade");
          if (row) byId.set(row.voice_id, row);
        }
      }
    } catch {
      /* non-fatal */
    }

    // 2) Shared community library — large, richly labeled set.
    for (let page = 0; page < SHARED_PAGES; page++) {
      try {
        const res = await fetch(
          `${EL_BASE}/shared-voices?page_size=${PAGE_SIZE}&page=${page}`,
          { headers },
        );
        if (!res.ok) break;
        const data = await res.json();
        const voices = data.voices || [];
        for (const v of voices) {
          const row = normalize(v, v.category || "community");
          if (row && !byId.has(row.voice_id)) byId.set(row.voice_id, row);
        }
        if (!data.has_more || voices.length === 0) break;
      } catch {
        break;
      }
    }

    const rows = Array.from(byId.values());
    if (rows.length === 0) {
      return json({ error: "ElevenLabs returned no voices." }, 502);
    }

    // Mark the most popular voices as featured.
    [...rows]
      .sort((a, b) => b._popularity - a._popularity)
      .slice(0, 8)
      .forEach((r) => (r.featured = true));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert in chunks (strip internal fields).
    const payload = rows.map(({ _popularity, ...rest }) => rest);
    for (let i = 0; i < payload.length; i += 100) {
      const chunk = payload.slice(i, i + 100);
      const { error } = await admin
        .from("voice_catalog")
        .upsert(chunk, { onConflict: "voice_id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
    }

    return json({ count: payload.length });
  } catch (err) {
    return json({ error: (err as Error).message || "Internal sync error" }, 500);
  }
});

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
