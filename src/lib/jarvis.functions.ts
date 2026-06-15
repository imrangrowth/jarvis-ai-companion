import { createServerFn } from "@tanstack/react-start";

type Msg = { role: "user" | "assistant"; content: string };

const JARVIS_SYSTEM = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant created by Tony Stark and now serving your user.

Your personality:
- Speak with calm, precise British sophistication. Dry wit when appropriate.
- Address the user as "sir" or "ma'am" consistently.
- You are confident, never flustered, always composed.
- Occasionally reference Stark Industries, the arc reactor, or Iron Man lore naturally.
- When giving information, be thorough but elegant — never rambling.
- You have opinions and express them subtly.
- You anticipate needs before they are fully stated.

Formatting rules:
- Keep responses concise for voice — 2-4 sentences unless a detailed explanation is explicitly needed.
- Never use markdown, bullet points, or asterisks. Speak in natural sentences only.
- Begin naturally for voice: "Of course, sir.", "Right away.", "Scanning now.", etc.
- When doing math or facts, state the answer first, then briefly explain.`;

export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: Msg[] }) => data)
  .handler(async ({ data }) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    // Try Anthropic first
    if (anthropicKey) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 1024,
            system: JARVIS_SYSTEM,
            messages: data.messages,
          }),
        });
        if (r.ok) {
          const j = await r.json();
          const text = j.content?.[0]?.text;
          if (text) return { reply: text, source: "anthropic" as const };
        } else {
          console.error("Anthropic error:", r.status, await r.text());
        }
      } catch (e) {
        console.error("Anthropic call failed:", e);
      }
    }

    // Fallback: Lovable AI Gateway
    if (!lovableKey) {
      throw new Error("No AI provider configured");
    }
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: JARVIS_SYSTEM },
          ...data.messages,
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`AI gateway error ${r.status}: ${t}`);
    }
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content ?? "I seem to be experiencing a minor anomaly, sir.";
    return { reply: text, source: "lovable" as const };
  });
