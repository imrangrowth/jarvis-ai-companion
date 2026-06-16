import { createServerFn } from "@tanstack/react-start";

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
    try {
      const j = await anthropicCall({
        max_tokens: 220,
        system: ROUTER_SYSTEM,
        messages: [{ role: "user", content: data.text }],
      });
      const raw = j.content?.[0]?.text?.replace(/```json|```/g, "").trim() || '{"action":"chat"}';
      return JSON.parse(raw);
    } catch {
      return { action: "chat" };
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
    const { system, messages, useTools = true, maxTokens = 1000 } = data;
    let current: any[] = [...messages];
    let searches: string[] = [];
    try {
      for (let i = 0; i < 6; i++) {
        const j = await anthropicCall({
          max_tokens: maxTokens,
          system,
          tools: useTools ? [{ type: "web_search_20250305", name: "web_search" }] : undefined,
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
      const reply = await lovableCall(system, messages);
      return { reply, searches, source: "lovable" as const };
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
      const reply = await lovableCall(system, [{ role: "user", content: data.description }]);
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
      const reply = await lovableCall(system, data.messages);
      return { reply, source: "lovable" as const };
    }
  });
