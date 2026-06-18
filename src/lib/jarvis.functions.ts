import { createServerFn } from "@tanstack/react-start";

// ── Knowledge (always-learning, shared facts) ─────────────────────────────
export const recallKnowledge = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const q = (data.query || "").trim().slice(0, 200);
      if (!q) return { facts: [] as { topic: string; content: string }[] };
      // Simple ILIKE fallback works without tsvector tuning; ordered by recency.
      const { data: rows } = await supabaseAdmin
        .from("knowledge")
        .select("topic, content")
        .or(`topic.ilike.%${q.replace(/[%,]/g, " ")}%,content.ilike.%${q.replace(/[%,]/g, " ")}%`)
        .order("created_at", { ascending: false })
        .limit(data.limit ?? 5);
      return { facts: rows ?? [] };
    } catch (e) {
      console.error("recallKnowledge failed:", e);
      return { facts: [] as { topic: string; content: string }[] };
    }
  });

export const logKnowledge = createServerFn({ method: "POST" })
  .inputValidator((data: { topic: string; content: string; source?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const topic = (data.topic || "").trim().slice(0, 200);
      const content = (data.content || "").trim().slice(0, 2000);
      if (!topic || !content) return { ok: false };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("knowledge").insert({ topic, content, source: data.source?.slice(0, 200) });
      return { ok: true };
    } catch (e) {
      console.error("logKnowledge failed:", e);
      return { ok: false };
    }
  });



// ── Types ────────────────────────────────────────────────────────────────
type TextBlock = { type: "text"; text: string };
type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type ContentBlock = TextBlock | ImageBlock;
export type ApiMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

// ── Shared Anthropic call with fallback to Lovable Gateway ────────────────
const ANTHROPIC_MODELS = ["claude-sonnet-4-5", "claude-sonnet-4-20250514"];

async function anthropicCall(body: Record<string, unknown>): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("NO_ANTHROPIC");
  let lastErr: string | null = null;
  for (const model of ANTHROPIC_MODELS) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...body, model }),
    });
    if (r.ok) return r.json();
    lastErr = await r.text();
    if (r.status !== 404 && r.status !== 400) break;
  }
  throw new Error(`Anthropic failed: ${lastErr}`);
}

// ── Google Gemini direct fallback ─────────────────────────────────────────
async function geminiCall(system: string, messages: ApiMessage[]): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("NO_GEMINI");
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{
      text: typeof m.content === "string"
        ? m.content
        : m.content.map((b) => (b.type === "text" ? b.text : "[image attached]")).join("\n"),
    }],
  }));
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "Anomaly detected, sir.";
}

async function chainedFallback(system: string, messages: ApiMessage[]): Promise<{ reply: string; source: "gemini" | "lovable" }> {
  try {
    const reply = await geminiCall(system, messages);
    return { reply, source: "gemini" };
  } catch (e) {
    console.error("Gemini failed, trying Lovable:", e);
    const reply = await lovableCall(system, messages);
    return { reply, source: "lovable" };
  }
}

// ── ElevenLabs TTS (server-side, uses secret) ─────────────────────────────
const DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel — British

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; voiceId?: string }) => data)
  .handler(async ({ data }) => {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
    const voiceId = data.voiceId || DEFAULT_VOICE_ID;
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
        }),
      },
    );
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
    const buf = await r.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { audioBase64: base64, mimeType: "audio/mpeg" };
  });

async function lovableCall(system: string, messages: ApiMessage[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("NO_LOVABLE");
  // Flatten any image blocks to text fallback for the gateway
  const flat = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string"
      ? m.content
      : m.content.map((b) => (b.type === "text" ? b.text : "[image attached]")).join("\n"),
  }));
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, ...flat],
    }),
  });
  if (!r.ok) throw new Error(`Gateway ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "Anomaly detected, sir.";
}

// ── Intent router ─────────────────────────────────────────────────────────
const ROUTER_SYSTEM = `You are JARVIS's intent router. Analyze the user command and return ONLY a valid JSON object — no explanation, no markdown.

Phone & system actions:
{ "action": "call", "contact": "name", "number": "digits only or null" }
{ "action": "whatsapp", "contact": "name", "number": "digits or null", "message": "text or null" }
{ "action": "sms", "contact": "name", "number": "digits or null", "message": "text or null" }
{ "action": "telegram", "contact": "username or null", "message": "text or null" }
{ "action": "messenger", "contact": "username or null" }
{ "action": "instagram", "query": "username or hashtag or null" }
{ "action": "twitter", "query": "search or null", "message": "tweet text or null" }
{ "action": "spotify", "query": "song/artist" }
{ "action": "uber", "destination": "place name" }
{ "action": "navigate", "destination": "place name" }
{ "action": "youtube", "query": "search terms" }
{ "action": "search", "query": "search terms" }
{ "action": "email", "to": "email", "subject": "text", "body": "text" }
{ "action": "alarm", "hour": 0-23, "minute": 0-59, "label": "text" }
{ "action": "timer", "seconds": number, "label": "text" }
{ "action": "weather", "location": "name or null" }
{ "action": "battery" }


Long-term memory:
{ "action": "remember", "category": "project|client|task|preference", "title": "short title", "content": "details" }

Specialist business agents:
{ "action": "agent", "agent": "developer|marketing|research|sales|pm", "task": "verbatim user request" }

Website builder:
{ "action": "build_website", "description": "the full website brief, verbatim" }

Fallback for general conversation, facts, current events, casual talk, or memory recall:
{ "action": "chat" }

Return ONLY the JSON.`;

export const routeIntent = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string }) => data)
  .handler(async ({ data }) => {
    // Gemini Flash is ~3-5x faster than Anthropic for tiny JSON routing.
    try {
      const raw = await geminiCall(ROUTER_SYSTEM, [{ role: "user", content: data.text }]);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      try {
        const j = await anthropicCall({
          max_tokens: 200,
          system: ROUTER_SYSTEM,
          messages: [{ role: "user", content: data.text }],
        });
        const raw = j.content?.[0]?.text?.replace(/```json|```/g, "").trim() || '{"action":"chat"}';
        return JSON.parse(raw);
      } catch {
        return { action: "chat" };
      }
    }
  });

// ── Agentic chat (with Anthropic server-side web_search tool) ─────────────
export const chatAgentic = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      system: string;
      messages: ApiMessage[];
      useTools?: boolean;
      maxTokens?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { system, messages, useTools = true, maxTokens = 400 } = data;
    // Fast path: no tools needed → skip Anthropic loop, hit Gemini Flash directly.
    if (!useTools) {
      try {
        const { reply, source } = await chainedFallback(system, messages);
        return { reply, searches: [] as string[], source };
      } catch (e) {
        console.error("Fast path failed:", e);
        return { reply: "Apologies, sir. Connection trouble.", searches: [], source: "lovable" as const };
      }
    }
    let current: any[] = [...messages];
    let searches: string[] = [];
    try {
      for (let i = 0; i < 4; i++) {
        const j = await anthropicCall({
          max_tokens: maxTokens,
          system,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: current,
        });
        const texts = (j.content || []).filter((b: any) => b.type === "text");
        const tools_ = (j.content || []).filter((b: any) => b.type === "tool_use");
        if (j.stop_reason === "end_turn" || !tools_.length) {
          const reply =
            texts.map((b: any) => b.text).join(" ").trim() || "Anomaly detected, sir.";
          return { reply, searches, source: "anthropic" as const };
        }
        if (j.stop_reason === "tool_use") {
          current = [...current, { role: "assistant", content: j.content }];
          const results = tools_.map((t: any) => {
            if (t.name === "web_search") searches.push(t.input?.query || "");
            return { type: "tool_result", tool_use_id: t.id, content: "" };
          });
          current = [...current, { role: "user", content: results }];
        }
      }
      return { reply: "Search cycle limit reached, sir.", searches, source: "anthropic" as const };
    } catch (e) {
      console.error("Anthropic failed, falling back:", e);
      const { reply, source } = await chainedFallback(system, messages);
      return { reply, searches, source };
    }
  });

// ── Website builder ───────────────────────────────────────────────────────
const BUILDER_SYSTEM = `You are JARVIS's Website Builder Agent. Given a brief, generate one complete, polished, self-contained HTML file (inline CSS, inline JS if needed) inside a single html code block. Make deliberate, modern design choices — real color palette, real typography, no generic templated look. After the code block, add exactly ONE short sentence in JARVIS's voice (address the user as sir) summarizing what was built. Nothing else outside the code block and that one sentence.`;

export const buildWebsite = createServerFn({ method: "POST" })
  .inputValidator((data: { description: string; memoryContext?: string }) => data)
  .handler(async ({ data }) => {
    const system = BUILDER_SYSTEM + (data.memoryContext ? `\n\n${data.memoryContext}` : "");
    try {
      const j = await anthropicCall({
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: data.description }],
      });
      const text = (j.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");
      const match = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
      const html = match ? match[1].trim() : text.trim();
      const summary =
        (match ? text.replace(match[0], "").trim() : "") ||
        "Your website is ready for preview, sir.";
      return { html, summary };
    } catch (e) {
      console.error("Builder anthropic failed, fallback:", e);
      const { reply } = await chainedFallback(system, [{ role: "user", content: data.description }]);
      const match = reply.match(/```(?:html)?\s*([\s\S]*?)```/i);
      const html = match ? match[1].trim() : reply.trim();
      const summary =
        (match ? reply.replace(match[0], "").trim() : "") ||
        "Your website is ready for preview, sir.";
      return { html, summary };
    }
  });

// ── Legacy single-shot (kept for back-compat) ─────────────────────────────
export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ApiMessage[] }) => data)
  .handler(async ({ data }) => {
    const system = `You are J.A.R.V.I.S. Calm British wit, address user as sir. Concise voice replies, no markdown.`;
    try {
      const j = await anthropicCall({ max_tokens: 1024, system, messages: data.messages });
      const text = j.content?.[0]?.text;
      if (text) return { reply: text, source: "anthropic" as const };
      throw new Error("empty");
    } catch {
      const { reply, source } = await chainedFallback(system, data.messages);
      return { reply, source };
    }
  });
