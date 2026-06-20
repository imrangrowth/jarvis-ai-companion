import { createServerFn } from "@tanstack/react-start";

const USER_ID = "imran-001";

type PillarPayload = {
  userId?: string;
  identity?: any;
  goals?: any;
  relationships?: any;
  knowledge?: any;
};

// ── Upload & store all 4 pillars ──────────────────────────────────────────
export const uploadPillars = createServerFn({ method: "POST" })
  .inputValidator((data: PillarPayload) => data)
  .handler(async ({ data }) => {
    const userId = data.userId || USER_ID;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const report: Record<string, { ok: boolean; count?: number; error?: string }> = {};

    // 1. IDENTITY
    if (data.identity) {
      try {
        const { error } = await supabaseAdmin
          .from("jarvis_identity")
          .upsert(
            { user_id: userId, data: data.identity, last_updated: new Date().toISOString() },
            { onConflict: "user_id" },
          );
        report.identity = error ? { ok: false, error: error.message } : { ok: true, count: 1 };
      } catch (e: any) {
        report.identity = { ok: false, error: e?.message ?? "unknown" };
      }
    }

    // 2. GOALS
    if (data.goals) {
      try {
        const g = data.goals;
        const primary =
          g.primary_goal || g.primary || (typeof g === "string" ? g : null) || "";
        const secondary = g.secondary_goals || g.secondary || [];
        const continuous = g.continuous_goals || g.continuous || [];
        const progress = typeof g.progress === "number" ? g.progress : 0;

        // wipe existing top-level goal row for this user, replace
        await supabaseAdmin
          .from("jarvis_goals")
          .delete()
          .eq("user_id", userId)
          .eq("goal_name", "__pillar__");
        const { error } = await supabaseAdmin.from("jarvis_goals").insert({
          user_id: userId,
          goal_name: "__pillar__",
          primary_goal: primary,
          secondary_goals: secondary,
          continuous_goals: continuous,
          progress,
          status: "active",
          last_updated: new Date().toISOString(),
        });
        report.goals = error ? { ok: false, error: error.message } : { ok: true, count: 1 };
      } catch (e: any) {
        report.goals = { ok: false, error: e?.message ?? "unknown" };
      }
    }

    // 3. RELATIONSHIPS
    if (data.relationships) {
      try {
        const list = Array.isArray(data.relationships)
          ? data.relationships
          : Object.entries(data.relationships).map(([key, val]: [string, any]) => ({
              relationship_id: key,
              name: val?.name || key,
              type: val?.type || (key.toLowerCase() === "imran" ? "primary" : "contact"),
              data: val,
            }));
        const rows = list.map((r: any, i: number) => ({
          user_id: userId,
          relationship_id: String(r.relationship_id || r.id || r.name || `rel-${i}`).slice(0, 100),
          name: String(r.name || r.relationship_id || `Unknown ${i}`).slice(0, 200),
          type: String(r.type || "contact").slice(0, 50),
          data: r.data || r,
          interaction_history: r.interaction_history || [],
          last_updated: new Date().toISOString(),
        }));
        const { error } = await supabaseAdmin
          .from("jarvis_relationships")
          .upsert(rows, { onConflict: "user_id,relationship_id" });
        report.relationships = error
          ? { ok: false, error: error.message }
          : { ok: true, count: rows.length };
      } catch (e: any) {
        report.relationships = { ok: false, error: e?.message ?? "unknown" };
      }
    }

    // 4. KNOWLEDGE
    if (data.knowledge) {
      try {
        const list = Array.isArray(data.knowledge)
          ? data.knowledge
          : Object.entries(data.knowledge).map(([key, val]: [string, any]) => ({
              topic: key,
              content: typeof val === "string" ? val : JSON.stringify(val),
            }));
        const rows = list.map((k: any, i: number) => ({
          user_id: userId,
          knowledge_id: String(k.knowledge_id || k.id || `k-${Date.now()}-${i}`).slice(0, 100),
          topic: String(k.topic || k.name || `fact-${i}`).slice(0, 200),
          content: String(k.content || k.fact || JSON.stringify(k)).slice(0, 4000),
          domain: String(k.domain || k.category || "GENERAL").slice(0, 50),
          source: String(k.learned_from || k.source || "upload").slice(0, 200),
          confidence: typeof k.confidence === "number" ? k.confidence : 0.8,
          category: String(k.domain || k.category || "GENERAL").slice(0, 50),
          last_accessed: new Date().toISOString(),
        }));
        const { error } = await supabaseAdmin.from("jarvis_knowledge").insert(rows);
        report.knowledge = error
          ? { ok: false, error: error.message }
          : { ok: true, count: rows.length };
      } catch (e: any) {
        report.knowledge = { ok: false, error: e?.message ?? "unknown" };
      }
    }

    console.log("[uploadPillars]", JSON.stringify(report));
    return { ok: true, report };
  });

// ── Retrieve all 4 pillars ────────────────────────────────────────────────
export const retrievePillars = createServerFn({ method: "POST" })
  .inputValidator((data: { userId?: string; query?: string } = {}) => data)
  .handler(async ({ data }) => {
    const userId = data.userId || USER_ID;
    const query = (data.query || "").trim().toLowerCase();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [idRes, goalRes, relRes, knowRes] = await Promise.all([
        supabaseAdmin.from("jarvis_identity").select("data, last_updated").eq("user_id", userId).maybeSingle(),
        supabaseAdmin
          .from("jarvis_goals")
          .select("primary_goal, secondary_goals, continuous_goals, progress, goal_name, status")
          .eq("user_id", userId)
          .order("last_updated", { ascending: false, nullsFirst: false })
          .limit(10),
        supabaseAdmin
          .from("jarvis_relationships")
          .select("relationship_id, name, type, data")
          .eq("user_id", userId)
          .limit(50),
        supabaseAdmin
          .from("jarvis_knowledge")
          .select("topic, content, domain, confidence")
          .eq("user_id", userId)
          .order("last_accessed", { ascending: false, nullsFirst: false })
          .limit(200),
      ]);

      // Filter knowledge by query if provided
      let knowledge = knowRes.data || [];
      if (query && knowledge.length > 30) {
        const filtered = knowledge.filter(
          (k: any) =>
            k.topic?.toLowerCase().includes(query) ||
            k.content?.toLowerCase().includes(query) ||
            k.domain?.toLowerCase().includes(query),
        );
        knowledge = filtered.length ? filtered.slice(0, 30) : knowledge.slice(0, 20);
      } else {
        knowledge = knowledge.slice(0, 30);
      }

      // Filter relationships by mention in query
      let relationships = relRes.data || [];
      if (query) {
        const mentioned = relationships.filter((r: any) =>
          query.includes(r.name?.toLowerCase() || "") ||
          query.includes(r.relationship_id?.toLowerCase() || ""),
        );
        if (mentioned.length) relationships = mentioned;
      }

      const result = {
        identity: idRes.data?.data ?? null,
        goals: goalRes.data?.find((g: any) => g.goal_name === "__pillar__") ?? goalRes.data?.[0] ?? null,
        relationships,
        knowledge,
        stats: {
          identityLoaded: !!idRes.data,
          goalsCount: goalRes.data?.length ?? 0,
          relationshipsCount: relRes.data?.length ?? 0,
          knowledgeCount: knowRes.data?.length ?? 0,
        },
      };
      console.log("[retrievePillars]", JSON.stringify(result.stats));
      return result;
    } catch (e: any) {
      console.error("[retrievePillars] FAILED:", e?.message);
      return {
        identity: null,
        goals: null,
        relationships: [],
        knowledge: [],
        stats: { error: e?.message ?? "unknown" },
      };
    }
  });

// ── Save a single interaction + extract knowledge ─────────────────────────
export const saveInteraction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      userId?: string;
      userInput: string;
      jarvisResponse: string;
      agent?: string;
      classification?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = data.userId || USER_ID;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("jarvis_conversations").insert({
        user_id: userId,
        user_input: data.userInput.slice(0, 4000),
        jarvis_response: data.jarvisResponse.slice(0, 6000),
        metadata: { agent: data.agent ?? "jarvis", classification: data.classification ?? null },
      });

      // Lightweight knowledge extraction: pull short factual sentences with key markers.
      const sentences = data.jarvisResponse
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 25 && s.length < 280)
        .filter((s) => /\b(is|are|was|were|means|refers|equals|costs|located|founded|launched)\b/i.test(s))
        .slice(0, 3);

      if (sentences.length) {
        const rows = sentences.map((s) => ({
          user_id: userId,
          knowledge_id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          topic: data.userInput.slice(0, 120),
          content: s,
          domain: (data.agent || "GENERAL").toUpperCase(),
          source: "jarvis_response",
          confidence: 0.6,
          category: (data.agent || "GENERAL").toUpperCase(),
          learned_from_query: true,
          last_accessed: new Date().toISOString(),
        }));
        await supabaseAdmin.from("jarvis_knowledge").insert(rows);
      }

      return { ok: true, extracted: sentences.length };
    } catch (e: any) {
      console.error("[saveInteraction] FAILED:", e?.message);
      return { ok: false, error: e?.message };
    }
  });

// ── Build context block from pillars for the system prompt ────────────────
export function buildPillarContext(pillars: {
  identity: any;
  goals: any;
  relationships: any[];
  knowledge: any[];
}): string {
  const parts: string[] = [];

  if (pillars.identity) {
    const i = pillars.identity;
    const traits = [
      i.name && `Name: ${i.name}`,
      i.role && `Role: ${i.role}`,
      Array.isArray(i.values) && i.values.length && `Values: ${i.values.slice(0, 5).join(", ")}`,
      Array.isArray(i.personality) && `Personality: ${i.personality.slice(0, 5).join(", ")}`,
      Array.isArray(i.limitations) && `Limits: ${i.limitations.slice(0, 3).join("; ")}`,
    ]
      .filter(Boolean)
      .join(" | ");
    if (traits) parts.push(`IDENTITY — ${traits}`);
  }

  if (pillars.goals) {
    const g = pillars.goals;
    const txt = [
      g.primary_goal && `Primary: ${g.primary_goal}`,
      Array.isArray(g.secondary_goals) && g.secondary_goals.length && `Secondary: ${g.secondary_goals.slice(0, 3).join("; ")}`,
      typeof g.progress === "number" && `Progress: ${g.progress}%`,
    ]
      .filter(Boolean)
      .join(" | ");
    if (txt) parts.push(`GOALS — ${txt}`);
  }

  if (pillars.relationships?.length) {
    const rels = pillars.relationships
      .slice(0, 8)
      .map((r) => {
        const note = typeof r.data === "object" ? (r.data?.notes || r.data?.role || "") : "";
        return `${r.name}${r.type ? ` (${r.type})` : ""}${note ? `: ${String(note).slice(0, 80)}` : ""}`;
      })
      .join(" | ");
    parts.push(`RELATIONSHIPS — ${rels}`);
  }

  if (pillars.knowledge?.length) {
    const facts = pillars.knowledge
      .slice(0, 12)
      .map((k) => `• ${k.topic}: ${String(k.content).slice(0, 140)}`)
      .join("\n");
    parts.push(`KNOWLEDGE (use silently, do not cite verbatim unless asked):\n${facts}`);
  }

  if (!parts.length) return "";
  return `PILLAR MEMORY (your persistent self — reference naturally):\n${parts.join("\n\n")}`;
}
